import { useState, useEffect } from 'react'
import { getAttendance, markAttendance, getThisWeekId } from '../../lib/firestore'
import type { AppUser } from '../../types'

interface Props { user: AppUser }

export default function StudentAttendancePage({ user }: Props) {
  const [present, setPresent] = useState<boolean | null>(null)
  const [timestamp, setTimestamp] = useState<Date | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const weekId = getThisWeekId()

  useEffect(() => {
    getAttendance(weekId).then(records => {
      const mine = records.find(r => r.uid === user.uid)
      setPresent(mine?.present ?? false)
      setTimestamp(mine?.timestamp ?? null)
      setLoading(false)
    })
  }, [user.uid, weekId])

  const handleCheck = async () => {
    if (present) return // 이미 출석한 경우
    setSaving(true)
    await markAttendance(weekId, user.uid, true)
    setPresent(true)
    setTimestamp(new Date())
    setSaving(false)
  }

  const formatTime = (d: Date) => d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="p-6 flex flex-col items-center justify-center min-h-[70vh] space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-bold text-gray-800 mb-1">출석 체크</h2>
        <p className="text-sm text-gray-500">{weekId} 미사</p>
      </div>

      {loading ? (
        <div className="text-gray-400">불러오는 중...</div>
      ) : (
        <>
          <button
            onClick={handleCheck}
            disabled={present === true || saving}
            className={`w-48 h-48 rounded-full text-white font-bold text-lg shadow-lg transition-all
              ${present
                ? 'bg-green-500 scale-95 cursor-default'
                : 'bg-[#1e3a5f] hover:bg-[#162d4a] active:scale-95'
              }
            `}
          >
            {saving ? '처리 중...' : present ? '✓ 출석 완료' : '출석 체크'}
          </button>

          {present && timestamp && (
            <div className="text-center bg-green-50 rounded-xl px-6 py-4">
              <p className="text-green-700 font-medium">출석이 완료되었습니다</p>
              <p className="text-green-600 text-sm mt-1">{formatTime(timestamp)} 출석</p>
            </div>
          )}

          {!present && (
            <p className="text-sm text-gray-400 text-center">
              버튼을 눌러 출석을 체크하세요
            </p>
          )}
        </>
      )}

      <div className="bg-blue-50 rounded-xl p-4 text-sm text-blue-700 text-center w-full max-w-xs">
        <p className="font-medium">{user.name} 학생</p>
        <p className="text-blue-500">{user.grade}학년</p>
      </div>
    </div>
  )
}
