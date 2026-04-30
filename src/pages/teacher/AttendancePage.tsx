import { useEffect, useState } from 'react'
import {
  approvePendingAttendance,
  getAllUsers,
  getAttendance,
  getKioskSession,
  getThisWeekId,
  getWeekList,
  markAttendance,
  onPendingAttendanceChange,
  rejectPendingAttendance,
  setKioskOpen,
} from '../../lib/firestore'
import type { AppUser, AttendanceRecord, PendingRequest } from '../../types'

const GRADE_ORDER = ['중1', '중2', '중3', '고1', '고2', '고3']

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

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [list, kioskSession] = await Promise.all([getWeekList(), getKioskSession()])
      if (cancelled) return
      setWeekList(Array.from(new Set([getThisWeekId(), ...list])).sort().reverse())
      setKioskOpenState(kioskSession.isOpen)
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

  useEffect(() => {
    const unsubscribe = onPendingAttendanceChange(weekId, requests => {
      setPendingRequests(requests.filter(r => r.status === 'pending'))
    })
    return () => unsubscribe()
  }, [weekId])

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

  return (
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
          <div className="px-5 py-3.5 border-b border-gray-50 flex items-center gap-2">
            <p className="text-sm font-semibold text-gray-900">출석 대기</p>
            <span className="bg-amber-400 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
              {pendingRequests.length}
            </span>
          </div>
          <ul className="divide-y divide-gray-50">
            {pendingRequests.map(req => {
              const student = studentMap[req.uid]
              const processing = processingUids.has(req.uid)
              return (
                <li key={req.uid} className="flex items-center justify-between px-5 py-4 gap-3">
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
            })}
          </ul>
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

      {/* 주차 선택 */}
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

      {/* 학생 리스트 */}
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
                      onClick={() => void toggle(student.uid)}
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
    </div>
  )
}
