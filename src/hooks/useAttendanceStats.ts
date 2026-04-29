import { useState, useEffect } from 'react'
import { getUserAttendanceHistory } from '../lib/firestore'

export interface AttendanceStats {
  total: number
  streak: number
  stamps: boolean[]  // 최근 10주, 최신순
}

export function useAttendanceStats(uid: string) {
  const [stats, setStats] = useState<AttendanceStats>({ total: 0, streak: 0, stamps: [] })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getUserAttendanceHistory(uid).then(history => {
      const total = history.filter(w => w.present).length

      let streak = 0
      for (const w of history) {
        if (w.present) streak++
        else break
      }

      const stamps = history.slice(0, 10).map(w => w.present)

      setStats({ total, streak, stamps })
      setLoading(false)
    })
  }, [uid])

  return { stats, loading }
}
