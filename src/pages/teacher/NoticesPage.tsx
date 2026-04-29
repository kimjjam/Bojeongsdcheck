import { useState, useEffect } from 'react'
import { getNotices, saveNotice, deleteNotice } from '../../lib/firestore'
import type { Notice } from '../../types'

const QUICK_MSGS = [
  '오늘 미사 후 교실에서 모임이 있습니다.',
  '다음 주 주일학교는 쉽니다.',
  '전례부 친구들은 미사 30분 전까지 와주세요.',
  '성가대 연습이 있습니다. 미사 1시간 전 집합!',
]

export default function TeacherNoticesPage() {
  const [notices, setNotices] = useState<Notice[]>([])
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  const load = async () => setNotices(await getNotices())
  useEffect(() => { load() }, [])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!body.trim()) return
    setSending(true)
    await saveNotice(title || '공지', body)
    setTitle(''); setBody('')
    setSending(false); setSent(true)
    setTimeout(() => setSent(false), 2000)
    await load()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('이 알림을 삭제하시겠습니까?')) return
    await deleteNotice(id)
    await load()
  }

  const formatDate = (d: Date) =>
    d.toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-bold text-gray-800">알림장</h2>

      {/* 알림 작성 */}
      <form onSubmit={handleSend} className="bg-white rounded-xl shadow-sm p-4 space-y-3">
        <p className="text-sm font-semibold text-gray-700">새 알림 보내기</p>
        <input
          className="w-full border rounded-lg px-3 py-2.5 text-sm"
          placeholder="제목 (선택)"
          value={title}
          onChange={e => setTitle(e.target.value)}
        />
        <textarea
          className="w-full border rounded-lg px-3 py-2.5 text-sm min-h-[80px] resize-none"
          placeholder="내용을 입력하세요"
          value={body}
          onChange={e => setBody(e.target.value)}
          required
        />
        {/* 빠른 입력 */}
        <div className="space-y-1.5">
          <p className="text-xs text-gray-400">빠른 입력</p>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_MSGS.map(msg => (
              <button key={msg} type="button"
                onClick={() => setBody(msg)}
                className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-2.5 py-1.5 rounded-lg text-left">
                {msg.slice(0, 18)}…
              </button>
            ))}
          </div>
        </div>
        <button type="submit" disabled={sending || !body.trim()}
          className="w-full bg-[#1e3a5f] text-white rounded-xl py-3 font-medium disabled:opacity-60">
          {sending ? '전송 중...' : sent ? '✓ 전송됨' : '📢 알림 보내기'}
        </button>
      </form>

      {/* 알림 목록 */}
      <div className="space-y-2">
        {notices.length === 0 ? (
          <p className="text-center text-gray-400 py-6 text-sm">보낸 알림이 없습니다</p>
        ) : (
          notices.map(n => (
            <div key={n.id} className="bg-white rounded-xl shadow-sm p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="font-semibold text-gray-800 text-sm">{n.title}</p>
                  <p className="text-sm text-gray-600 mt-0.5 whitespace-pre-wrap">{n.body}</p>
                  <p className="text-xs text-gray-400 mt-1.5">{formatDate(n.createdAt)}</p>
                </div>
                <button onClick={() => handleDelete(n.id)}
                  className="text-gray-300 hover:text-red-400 shrink-0 text-lg leading-none">×</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
