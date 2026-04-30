import { useState, useEffect, useRef } from 'react'
import { onNoticesChange } from '../lib/firestore'
import type { Notice } from '../types'

export default function NoticesBoardPage() {
  const [notices, setNotices] = useState<Notice[]>([])
  const [newNotice, setNewNotice] = useState<Notice | null>(null)
  const prevCountRef = useRef(0)

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }

    const unsub = onNoticesChange(list => {
      if (prevCountRef.current > 0 && list.length > prevCountRef.current) {
        const latest = list[0]
        setNewNotice(latest)
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
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-sm bg-[#1e3a5f] text-white rounded-2xl px-5 py-4 shadow-xl">
          <p className="font-bold text-sm">📢 {newNotice.title}</p>
          <p className="text-xs text-blue-200 mt-1">{newNotice.body}</p>
        </div>
      )}

      <div className="max-w-lg mx-auto px-4 pt-8 pb-10 space-y-4">
        {/* 헤더 */}
        <div className="mb-2">
          <h1 className="text-xl font-bold text-gray-900">알림장</h1>
          <p className="text-sm text-gray-400 mt-0.5">선생님이 보낸 알림</p>
        </div>

        {notices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-300">
            <span className="text-4xl mb-3">🔔</span>
            <p className="text-sm">아직 알림이 없습니다</p>
          </div>
        ) : (
          notices.map(n => (
            <div key={n.id} className="bg-white rounded-2xl p-5">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-[#1e3a5f]/10 rounded-xl flex items-center justify-center shrink-0">
                  <span className="text-sm">📢</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm">{n.title}</p>
                  <p className="text-sm text-gray-500 mt-1 whitespace-pre-wrap leading-relaxed">{n.body}</p>
                  <p className="text-xs text-gray-300 mt-2">{formatDate(n.createdAt)}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
