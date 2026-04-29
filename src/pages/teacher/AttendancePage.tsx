import { useState, useEffect } from 'react'
import {
  getAllUsers, getAttendance, markAttendance, getThisWeekId, getWeekList,
  getKioskSession, setKioskOpen,
  onPendingAttendanceChange, approvePendingAttendance, rejectPendingAttendance,
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
      const [list, kioskSession] = await Promise.all([
        getWeekList(),
        getKioskSession(),
      ])

      if (cancelled) return

      const merged = Array.from(new Set([getThisWeekId(), ...list])).sort().reverse()
      setWeekList(merged)
      setKioskOpenState(kioskSession.isOpen)
    })()

    return () => {
      cancelled = true
    }
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

    return () => {
      cancelled = true
    }
  }, [weekId])

  // 대기 요청 실시간 감지 (선택된 주차 기준)
  useEffect(() => {
    const unsub = onPendingAttendanceChange(weekId, reqs => {
      setPendingRequests(reqs.filter(r => r.status === 'pending'))
    })
    return () => unsub()
  }, [weekId])

  const toggle = async (uid: string) => {
    const current = attendance[uid]?.present ?? false
    await markAttendance(weekId, uid, !current)
    setAttendance(prev => ({
      ...prev,
      [uid]: { uid, present: !current, timestamp: !current ? new Date() : null },
    }))
  }

  const toggleKiosk = async () => {
    setKioskToggling(true)
    const newState = !kioskOpen
    await setKioskOpen(newState)
    setKioskOpenState(newState)
    setKioskToggling(false)
  }

  const handleApprove = async (uid: string) => {
    setProcessingUids(prev => new Set(prev).add(uid))
    await approvePendingAttendance(weekId, uid)
    setAttendance(prev => ({
      ...prev,
      [uid]: { uid, present: true, timestamp: new Date() },
    }))
    setProcessingUids(prev => { const s = new Set(prev); s.delete(uid); return s })
  }

  const handleReject = async (uid: string) => {
    setProcessingUids(prev => new Set(prev).add(uid))
    await rejectPendingAttendance(weekId, uid)
    setProcessingUids(prev => { const s = new Set(prev); s.delete(uid); return s })
  }

  const studentMap = Object.fromEntries(students.map(s => [s.uid, s]))
  const presentCount = students.filter(s => attendance[s.uid]?.present).length
  const grouped = students.reduce<Record<string, AppUser[]>>((acc, s) => {
    const g = s.grade ?? '기타'
    if (!acc[g]) acc[g] = []
    acc[g].push(s); return acc
  }, {})
  const kioskUrl = `${window.location.origin}/kiosk`

  return (
    <div className="p-4 space-y-4">

      {/* 키오스크 열기/닫기 */}
      <div className={`rounded-xl p-4 ${kioskOpen ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'}`}>
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-sm font-semibold text-gray-800">출석 키오스크</p>
            <p className={`text-xs mt-0.5 ${kioskOpen ? 'text-green-600' : 'text-gray-400'}`}>
              {kioskOpen ? '🟢 현재 열려 있음 — 학생들이 출석 요청 가능' : '🔴 닫혀 있음 — 학생들이 접근 불가'}
            </p>
          </div>
          <button
            onClick={toggleKiosk}
            disabled={kioskToggling}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
              kioskOpen ? 'bg-red-500 text-white' : 'bg-green-500 text-white'
            } disabled:opacity-60`}
          >
            {kioskToggling ? '...' : kioskOpen ? '닫기' : '열기'}
          </button>
        </div>
        {kioskOpen && (
          <div className="flex items-center gap-2 mt-1">
            <p className="text-xs text-green-600 truncate flex-1">{kioskUrl}</p>
            <button onClick={() => navigator.clipboard.writeText(kioskUrl)} className="text-xs bg-green-600 text-white px-2 py-1 rounded shrink-0">복사</button>
          </div>
        )}
      </div>

      {/* 출석 대기 요청 */}
      {pendingRequests.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl overflow-hidden">
          <div className="bg-amber-400 px-4 py-2 flex items-center gap-2">
            <span className="text-white font-bold text-sm">출석 대기</span>
            <span className="bg-white text-amber-600 text-xs font-bold px-2 py-0.5 rounded-full">{pendingRequests.length}</span>
          </div>
          <ul className="divide-y divide-amber-100">
            {pendingRequests.map(req => {
              const student = studentMap[req.uid]
              const processing = processingUids.has(req.uid)
              return (
                <li key={req.uid} className="flex items-center justify-between px-4 py-3 gap-3">
                  <div className="flex-1 min-w-0">
                    <span className="font-bold text-gray-800">
                      {student ? student.name : req.uid}
                    </span>
                    {student?.baptismalName && (
                      <span className="ml-2 text-blue-600 text-sm">{student.baptismalName}</span>
                    )}
                    <span className="ml-2 text-xs text-gray-400">{student?.grade}</span>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => handleApprove(req.uid)}
                      disabled={processing}
                      className="bg-green-500 text-white text-sm font-semibold px-4 py-1.5 rounded-lg disabled:opacity-50 transition"
                    >
                      승인
                    </button>
                    <button
                      onClick={() => handleReject(req.uid)}
                      disabled={processing}
                      className="bg-red-400 text-white text-sm font-semibold px-4 py-1.5 rounded-lg disabled:opacity-50 transition"
                    >
                      거절
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-800">출석 현황</h2>
        <select className="border rounded-lg px-2 py-1.5 text-sm" value={weekId}
          onChange={e => { setLoading(true); setWeekId(e.target.value) }}>
          {weekList.map(w => <option key={w} value={w}>{w}</option>)}
        </select>
      </div>

      <div className="bg-[#1e3a5f] text-white rounded-xl p-4 flex justify-around text-center">
        <div><div className="text-2xl font-bold">{presentCount}</div><div className="text-xs text-blue-200">출석</div></div>
        <div className="w-px bg-white/20" />
        <div><div className="text-2xl font-bold">{students.length - presentCount}</div><div className="text-xs text-blue-200">결석</div></div>
        <div className="w-px bg-white/20" />
        <div><div className="text-2xl font-bold">{students.length}</div><div className="text-xs text-blue-200">전체</div></div>
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-400">불러오는 중...</div>
      ) : (
        Object.entries(grouped)
          .sort(([a], [b]) => GRADE_ORDER.indexOf(a) - GRADE_ORDER.indexOf(b))
          .map(([grade, list]) => (
            <div key={grade} className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-600">{grade} ({list.length}명)</div>
              <ul className="divide-y divide-gray-100">
                {list.map(s => {
                  const present = attendance[s.uid]?.present ?? false
                  const isPending = pendingRequests.some(r => r.uid === s.uid)
                  return (
                    <li key={s.uid}
                      className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50"
                      onClick={() => toggle(s.uid)}>
                      <span className="font-medium text-gray-800">{s.name}</span>
                      <span className={`text-sm font-semibold px-3 py-1 rounded-full ${
                        present ? 'bg-green-100 text-green-700'
                        : isPending ? 'bg-amber-100 text-amber-600'
                        : 'bg-gray-100 text-gray-400'
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
