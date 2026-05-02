import { useEffect, useRef, useState } from 'react'
import {
  approvePendingAttendance,
  getAllUsers,
  getAttendance,
  getKioskSession,
  getMultiWeekAttendance,
  getThisWeekId,
  getWeekList,
  markAttendance,
  onPendingAttendanceChange,
  rejectPendingAttendance,
  setActiveWeek,
  setKioskOpen,
} from '../../lib/firestore'
import type { AppUser, AttendanceRecord, PendingRequest } from '../../types'

const GRADE_ORDER = ['중1', '중2', '중3', '고1', '고2', '고3']

type View = 'today' | 'history'

export default function TeacherAttendancePage() {
  const [students, setStudents] = useState<AppUser[]>([])
  const [attendance, setAttendance] = useState<Record<string, AttendanceRecord>>({})
  const [weekId, setWeekId] = useState(getThisWeekId())
  const [weekList, setWeekList] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [kioskOpen, setKioskOpenState] = useState(false)
  const [kioskToggling, setKioskToggling] = useState(false)
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([])
  const [processingUids, setProcessingUids] = useState<Set<string>>(new Set())
  const [confirmTarget, setConfirmTarget] = useState<{ student: AppUser; currentPresent: boolean } | null>(null)
  const [approvalModalOpen, setApprovalModalOpen] = useState(false)
  const [view, setView] = useState<View>('today')
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyData, setHistoryData] = useState<Record<string, Record<string, boolean>>>({})
  const [historyWeeks, setHistoryWeeks] = useState<string[]>([])
  const [activeWeekInput, setActiveWeekInput] = useState(getThisWeekId())
  const [activeWeekSaving, setActiveWeekSaving] = useState(false)
  const [activeWeekSaved, setActiveWeekSaved] = useState(false)

  const studentsRef = useRef<AppUser[]>([])
  const prevPendingUidsRef = useRef<Set<string>>(new Set())

  useEffect(() => { studentsRef.current = students }, [students])

  // 알림 권한 요청
  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      void Notification.requestPermission()
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [list, kioskSession] = await Promise.all([getWeekList(), getKioskSession()])
      if (cancelled) return
      const activeId = kioskSession.activeWeekId ?? getThisWeekId()
      setWeekList(Array.from(new Set([activeId, ...list])).sort().reverse())
      setKioskOpenState(kioskSession.isOpen)
      setActiveWeekInput(activeId)
      setWeekId(activeId)
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [users, records] = await Promise.all([getAllUsers(), getAttendance(weekId)])
      if (cancelled) return
      setStudents(users.filter(u => u.role === 'student'))
      const map: Record<string, AttendanceRecord> = {}
      records.forEach(r => { map[r.uid] = r })
      setAttendance(map)
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [weekId])

  // 실시간 대기 목록 + 알림
  useEffect(() => {
    const unsubscribe = onPendingAttendanceChange(weekId, requests => {
      const pending = requests.filter(r => r.status === 'pending')

      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        pending.forEach(req => {
          if (!prevPendingUidsRef.current.has(req.uid)) {
            const student = studentsRef.current.find(s => s.uid === req.uid)
            new Notification('출석 대기', {
              body: student ? `${student.name}(${student.grade ?? ''}) 출석 요청` : '새 출석 요청',
            })
          }
        })
      }

      prevPendingUidsRef.current = new Set(pending.map(r => r.uid))
      setPendingRequests(pending)
    })
    return () => unsubscribe()
  }, [weekId])

  // 이력 뷰 데이터 로드
  useEffect(() => {
    if (view !== 'history' || weekList.length === 0 || students.length === 0) return
    setHistoryLoading(true)
    const today = getThisWeekId()
    const recentWeeks = weekList.filter(w => w <= today).slice(0, 8)
    setHistoryWeeks(recentWeeks)
    void getMultiWeekAttendance(recentWeeks).then(data => {
      setHistoryData(data)
      setHistoryLoading(false)
    })
  }, [view, weekList, students])

  const toggle = async (uid: string) => {
    const current = attendance[uid]?.present ?? false
    await markAttendance(weekId, uid, !current)
    setAttendance(prev => ({
      ...prev,
      [uid]: { uid, present: !current, timestamp: !current ? new Date() : null },
    }))
  }

  const toggleAttendanceLink = async () => {
    setKioskToggling(true)
    const next = !kioskOpen
    await setKioskOpen(next)
    setKioskOpenState(next)
    setKioskToggling(false)
  }

  const handleSetActiveWeek = async () => {
    if (!activeWeekInput) return
    setActiveWeekSaving(true)
    await setActiveWeek(activeWeekInput)
    setActiveWeekSaving(false)
    setActiveWeekSaved(true)
    setTimeout(() => setActiveWeekSaved(false), 2000)
  }

  const handleApprove = async (uid: string) => {
    setProcessingUids(prev => new Set(prev).add(uid))
    await approvePendingAttendance(weekId, uid)
    setAttendance(prev => ({ ...prev, [uid]: { uid, present: true, timestamp: new Date() } }))
    setProcessingUids(prev => { const n = new Set(prev); n.delete(uid); return n })
  }

  const handleReject = async (uid: string) => {
    setProcessingUids(prev => new Set(prev).add(uid))
    await rejectPendingAttendance(weekId, uid)
    setProcessingUids(prev => { const n = new Set(prev); n.delete(uid); return n })
  }

  const studentMap = Object.fromEntries(students.map(s => [s.uid, s]))
  const presentCount = students.filter(s => attendance[s.uid]?.present).length
  const grouped = students.reduce<Record<string, AppUser[]>>((acc, s) => {
    const g = s.grade ?? '기타'
    if (!acc[g]) acc[g] = []
    acc[g].push(s); return acc
  }, {})
  const attendanceUrl = `${window.location.origin}/attend`
  const PENDING_PREVIEW = 3

  const PendingRow = ({ req }: { req: PendingRequest }) => {
    const student = studentMap[req.uid]
    const processing = processingUids.has(req.uid)
    return (
      <li className="flex items-center justify-between px-5 py-4 gap-3">
        <div className="flex-1 min-w-0">
          <span className="font-semibold text-gray-900 text-sm">{student ? student.name : req.uid}</span>
          {student?.baptismalName && (
            <span className="ml-2 text-xs text-blue-400">{student.baptismalName}</span>
          )}
          <span className="ml-2 text-xs text-gray-400">{student?.grade}</span>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => void handleApprove(req.uid)}
            disabled={processing}
            className="bg-green-50 text-green-600 text-xs font-semibold px-4 py-2 rounded-xl disabled:opacity-50 transition"
          >승인</button>
          <button
            onClick={() => void handleReject(req.uid)}
            disabled={processing}
            className="bg-red-50 text-red-400 text-xs font-semibold px-4 py-2 rounded-xl disabled:opacity-50 transition"
          >거절</button>
        </div>
      </li>
    )
  }

  return (
    <>
    <div className="px-4 pt-6 pb-8 space-y-4">
      <h2 className="text-xl font-bold text-gray-900 px-1">출석 관리</h2>

      {/* 출석 링크 카드 */}
      <div className="bg-white rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-900">학생 출석 링크</p>
            <p className={`text-xs mt-0.5 ${kioskOpen ? 'text-green-500' : 'text-gray-400'}`}>
              {kioskOpen ? '🟢 열려있음' : '🔴 닫혀있음'}
            </p>
          </div>
          <button
            onClick={() => void toggleAttendanceLink()}
            disabled={kioskToggling}
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition disabled:opacity-50 ${
              kioskOpen ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-600'
            }`}
          >
            {kioskToggling ? '...' : kioskOpen ? '닫기' : '열기'}
          </button>
        </div>

        {/* 미사 날짜 설정 */}
        <div className="space-y-1.5 pt-1">
          <p className="text-xs font-medium text-gray-400">미사 날짜 설정</p>
          <div className="flex gap-2">
            <input
              type="date"
              value={activeWeekInput}
              onChange={e => setActiveWeekInput(e.target.value)}
              className="flex-1 bg-gray-50 rounded-xl px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:bg-white border border-transparent focus:border-gray-200 transition"
            />
            <button
              onClick={() => void handleSetActiveWeek()}
              disabled={activeWeekSaving}
              className="bg-[#1e3a5f]/10 text-[#1e3a5f] text-xs font-semibold px-4 rounded-xl shrink-0 disabled:opacity-50 transition"
            >
              {activeWeekSaved ? '✓ 저장됨' : activeWeekSaving ? '...' : '설정'}
            </button>
          </div>
          <p className="text-[10px] text-gray-300">학생 출석 화면에 표시될 주차 날짜입니다</p>
        </div>

        {kioskOpen && (
          <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-4 py-3">
            <p className="text-xs text-gray-400 truncate flex-1">{attendanceUrl}</p>
            <button
              onClick={() => navigator.clipboard.writeText(attendanceUrl)}
              className="text-xs font-semibold text-[#1e3a5f] shrink-0"
            >
              복사
            </button>
          </div>
        )}
      </div>

      {/* 출석 대기 */}
      {pendingRequests.length > 0 && (
        <div className="bg-white rounded-2xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-gray-900">출석 대기</p>
              <span className="bg-amber-400 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                {pendingRequests.length}
              </span>
            </div>
            {pendingRequests.length > PENDING_PREVIEW && (
              <button
                onClick={() => setApprovalModalOpen(true)}
                className="text-xs font-semibold text-[#1e3a5f]"
              >
                전체 보기
              </button>
            )}
          </div>
          <ul className="divide-y divide-gray-50">
            {pendingRequests.slice(0, PENDING_PREVIEW).map(req => (
              <PendingRow key={req.uid} req={req} />
            ))}
          </ul>
          {pendingRequests.length > PENDING_PREVIEW && (
            <button
              onClick={() => setApprovalModalOpen(true)}
              className="w-full py-3 text-xs font-semibold text-gray-400 border-t border-gray-50"
            >
              +{pendingRequests.length - PENDING_PREVIEW}명 더 보기
            </button>
          )}
        </div>
      )}

      {/* 출석 현황 요약 */}
      <div className="bg-[#1e3a5f] rounded-2xl p-5 flex items-center justify-around text-center">
        <div>
          <p className="text-2xl font-bold text-white">{presentCount}</p>
          <p className="text-xs text-blue-300 mt-1">출석</p>
        </div>
        <div className="w-px h-8 bg-white/10" />
        <div>
          <p className="text-2xl font-bold text-white">{students.length - presentCount}</p>
          <p className="text-xs text-blue-300 mt-1">결석</p>
        </div>
        <div className="w-px h-8 bg-white/10" />
        <div>
          <p className="text-2xl font-bold text-white">{students.length}</p>
          <p className="text-xs text-blue-300 mt-1">전체</p>
        </div>
      </div>

      {/* 뷰 토글 */}
      <div className="flex bg-gray-100 rounded-xl p-1">
        <button
          className={`flex-1 rounded-lg py-2 text-xs font-semibold transition ${view === 'today' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'}`}
          onClick={() => setView('today')}
        >
          오늘 출석
        </button>
        <button
          className={`flex-1 rounded-lg py-2 text-xs font-semibold transition ${view === 'history' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'}`}
          onClick={() => setView('history')}
        >
          출석 이력
        </button>
      </div>

      {/* 오늘 출석 뷰 */}
      {view === 'today' && (
        <>
          <div className="flex items-center justify-between px-1">
            <p className="text-sm font-semibold text-gray-900">학생 목록</p>
            <select
              className="bg-gray-100 text-gray-600 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none"
              value={weekId}
              onChange={e => { setLoading(true); setWeekId(e.target.value) }}
            >
              {weekList.map(w => <option key={w} value={w}>{w}</option>)}
            </select>
          </div>

          {loading ? (
            <div className="text-center py-16 text-gray-300 text-sm">불러오는 중...</div>
          ) : (
            Object.entries(grouped)
              .sort(([a], [b]) => GRADE_ORDER.indexOf(a) - GRADE_ORDER.indexOf(b))
              .map(([grade, list]) => (
                <div key={grade} className="bg-white rounded-2xl overflow-hidden">
                  <div className="px-5 py-3 border-b border-gray-50">
                    <span className="text-xs font-semibold text-gray-400">{grade} · {list.length}명</span>
                  </div>
                  <ul className="divide-y divide-gray-50">
                    {list.map(student => {
                      const present = attendance[student.uid]?.present ?? false
                      const isPending = pendingRequests.some(r => r.uid === student.uid)
                      return (
                        <li
                          key={student.uid}
                          className="flex items-center justify-between px-5 py-4 cursor-pointer active:bg-gray-50 transition"
                          onClick={() => setConfirmTarget({ student, currentPresent: attendance[student.uid]?.present ?? false })}
                        >
                          <span className="font-medium text-gray-800 text-sm">{student.name}</span>
                          <span className={`text-xs font-semibold px-3 py-1.5 rounded-full ${
                            present
                              ? 'bg-green-50 text-green-600'
                              : isPending
                                ? 'bg-amber-50 text-amber-500'
                                : 'bg-gray-50 text-gray-400'
                          }`}>
                            {present ? '출석' : isPending ? '대기' : '결석'}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))
          )}
        </>
      )}

      {/* 이력 뷰 */}
      {view === 'history' && (
        <div className="bg-white rounded-2xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-50">
            <p className="text-sm font-semibold text-gray-900">출석 이력 · 최근 {historyWeeks.length}주</p>
          </div>
          {historyLoading ? (
            <div className="py-12 text-center text-gray-300 text-sm">불러오는 중...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-max text-xs">
                <thead>
                  <tr className="border-b border-gray-50">
                    <th className="sticky left-0 bg-white px-4 py-3 text-left text-gray-400 font-medium w-20 z-10">이름</th>
                    {historyWeeks.map(w => (
                      <th key={w} className="px-2 py-3 text-center text-gray-400 font-medium whitespace-nowrap">
                        {w.slice(5)}
                      </th>
                    ))}
                    <th className="px-3 py-3 text-center text-gray-500 font-semibold">합계</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(grouped)
                    .sort(([a], [b]) => GRADE_ORDER.indexOf(a) - GRADE_ORDER.indexOf(b))
                    .map(([grade, list]) => (
                      <>
                        <tr key={`grade-${grade}`}>
                          <td
                            colSpan={historyWeeks.length + 2}
                            className="sticky left-0 bg-gray-50/80 px-4 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider"
                          >
                            {grade}
                          </td>
                        </tr>
                        {list.map(student => {
                          const total = historyWeeks.filter(w => historyData[w]?.[student.uid]).length
                          return (
                            <tr key={student.uid} className="border-b border-gray-50/50">
                              <td className="sticky left-0 bg-white px-4 py-3 font-medium text-gray-800 whitespace-nowrap z-10">{student.name}</td>
                              {historyWeeks.map(w => (
                                <td key={w} className="px-2 py-3 text-center">
                                  {historyData[w]?.[student.uid]
                                    ? <span className="text-green-500 font-bold text-sm">✓</span>
                                    : <span className="text-gray-200">·</span>
                                  }
                                </td>
                              ))}
                              <td className="px-3 py-3 text-center font-bold text-[#1e3a5f]">{total}</td>
                            </tr>
                          )
                        })}
                      </>
                    ))
                  }
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>

    {/* 출석 변경 확인 모달 */}
    {confirmTarget && (
      <div
        className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-6"
        onClick={() => setConfirmTarget(null)}
      >
        <div
          className="bg-white rounded-3xl p-6 w-full max-w-xs space-y-5"
          onClick={e => e.stopPropagation()}
        >
          <div className="text-center space-y-1.5">
            <p className="text-lg font-bold text-gray-900">{confirmTarget.student.name}</p>
            {confirmTarget.student.grade && (
              <p className="text-xs text-gray-400">{confirmTarget.student.grade}</p>
            )}
            <div className="flex items-center justify-center gap-2 pt-1">
              <span className={`text-sm font-semibold px-3 py-1 rounded-full ${
                confirmTarget.currentPresent ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'
              }`}>
                {confirmTarget.currentPresent ? '출석' : '결석'}
              </span>
              <span className="text-gray-300 text-sm">→</span>
              <span className={`text-sm font-semibold px-3 py-1 rounded-full ${
                confirmTarget.currentPresent ? 'bg-gray-100 text-gray-400' : 'bg-green-50 text-green-600'
              }`}>
                {confirmTarget.currentPresent ? '결석' : '출석'}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setConfirmTarget(null)}
              className="flex-1 bg-gray-50 text-gray-500 rounded-2xl py-3.5 text-sm font-semibold"
            >
              취소
            </button>
            <button
              onClick={() => { void toggle(confirmTarget.student.uid); setConfirmTarget(null) }}
              className="flex-1 bg-[#1e3a5f] text-white rounded-2xl py-3.5 text-sm font-semibold"
            >
              확인
            </button>
          </div>
        </div>
      </div>
    )}

    {/* 전체 승인 모달 */}
    {approvalModalOpen && (
      <div
        className="fixed inset-0 bg-black/40 z-50 flex flex-col justify-end"
        onClick={() => setApprovalModalOpen(false)}
      >
        <div
          className="bg-white rounded-t-3xl overflow-hidden max-h-[80vh] flex flex-col"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50 shrink-0">
            <div className="flex items-center gap-2">
              <p className="text-base font-bold text-gray-900">출석 대기</p>
              <span className="bg-amber-400 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                {pendingRequests.length}
              </span>
            </div>
            <button
              onClick={() => setApprovalModalOpen(false)}
              className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 text-lg leading-none"
            >
              ×
            </button>
          </div>
          <ul className="overflow-y-auto divide-y divide-gray-50 flex-1">
            {pendingRequests.map(req => (
              <PendingRow key={req.uid} req={req} />
            ))}
          </ul>
        </div>
      </div>
    )}
    </>
  )
}
