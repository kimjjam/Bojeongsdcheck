// 학생/키오스크 공용 알림판 (로그인 불필요)
import { useState, useEffect, useRef } from 'react'
import { onNoticesChange } from '../lib/firestore'
import type { Notice } from '../types'

export default function NoticesBoardPage() {
  const [notices, setNotices] = useState<Notice[]>([])
  const [newNotice, setNewNotice] = useState<Notice | null>(null)
  const prevCountRef = useRef(0)

  useEffect(() => {
    // 알림 권한 요청
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }

    const unsub = onNoticesChange(list => {
      // 새 알림 감지
      if (prevCountRef.current > 0 && list.length > prevCountRef.current) {
        const latest = list[0]
        setNewNotice(latest)
        // 브라우저 알림
        if (Notification.permission === 'granted') {
          new Notification(latest.title, { body: latest.body, icon: '/favicon.svg' })
        }
        setTimeout(() => setNewNotice(null), 5000)
      }
      prevCountRef.current = list.length
      setNotices(list)
    })
    return () => unsub()
  }, [])

  const formatDate = (d: Date) =>
    d.toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 새 알림 토스트 */}
      {newNotice && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-sm
          bg-[#1e3a5f] text-white rounded-2xl px-4 py-3 shadow-xl animate-bounce">
          <p className="font-bold text-sm">📢 {newNotice.title}</p>
          <p className="text-xs text-blue-200 mt-0.5">{newNotice.body}</p>
        </div>
      )}

      <div className="max-w-lg mx-auto p-4 space-y-4">
        <div className="flex items-center gap-2 pt-2">
          <div className="text-2xl">📋</div>
          <div>
            <h1 className="text-lg font-bold text-gray-800">알림장</h1>
            <p className="text-xs text-gray-400">선생님이 보낸 알림이 여기에 표시됩니다</p>
          </div>
        </div>

        {notices.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <p className="text-3xl mb-2">🔔</p>
            <p className="text-sm">아직 알림이 없습니다</p>
          </div>
        ) : (
          notices.map(n => (
            <div key={n.id} className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-[#1e3a5f]">
              <p className="font-semibold text-gray-800">{n.title}</p>
              <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap leading-relaxed">{n.body}</p>
              <p className="text-xs text-gray-400 mt-2">{formatDate(n.createdAt)}</p>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
