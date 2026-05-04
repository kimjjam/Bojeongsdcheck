import { useState, useEffect } from 'react'
import { getNotices, saveNotice, deleteNotice, getWeekData, saveWeekData, getThisWeekId } from '../../lib/firestore'
import type { Notice } from '../../types'

const QUICK_MSGS = [
  '오늘 미사 후 교실에서 모임이 있습니다.',
  '다음 주 주일학교는 쉽니다.',
  '전례부 친구들은 미사 30분 전까지 와주세요.',
  '성가대 연습이 있습니다. 미사 1시간 전 집합!',
]

const INPUT = 'w-full bg-gray-50 rounded-xl px-4 py-3.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#1e3a5f]/10 border border-transparent focus:border-gray-200 transition'
const TEXTAREA = `${INPUT} resize-none`

export default function TeacherNoticesPage() {
  const weekId = getThisWeekId()
  const [notices, setNotices] = useState<Notice[]>([])
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [snack, setSnack] = useState('')
  const [eventsText, setEventsText] = useState('')
  const [weekSaving, setWeekSaving] = useState(false)
  const [weekSaved, setWeekSaved] = useState(false)

  const load = async () => setNotices(await getNotices())

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [list, weekData] = await Promise.all([getNotices(), getWeekData(weekId)])
      if (cancelled) return
      setNotices(list)
      setSnack(weekData?.snack ?? '')
      setEventsText(weekData?.events?.join('\n') ?? '')
    })()
    return () => { cancelled = true }
  }, [weekId])

  const handleWeekSave = async () => {
    setWeekSaving(true)
    const events = eventsText.split('\n').map(s => s.trim()).filter(Boolean)
    await saveWeekData(weekId, {
      snack: snack || undefined,
      events: events.length > 0 ? events : undefined,
    })
    setWeekSaving(false); setWeekSaved(true)
    setTimeout(() => setWeekSaved(false), 2000)
  }

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
    <div className="px-4 pt-6 pb-8 space-y-6">
      <h2 className="text-xl font-bold text-gray-900 px-1">알림장</h2>

      {/* 이번 주 정보 */}
      <div className="bg-white rounded-2xl p-5 space-y-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">이번 주 정보 <span className="normal-case font-normal text-gray-300">· {weekId}</span></p>
        <div className="space-y-1.5">
          <p className="text-xs text-gray-400 font-medium">🍪 간식</p>
          <input
            className={INPUT}
            placeholder="예: 떡볶이, 음료수"
            value={snack}
            onChange={e => setSnack(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <p className="text-xs text-gray-400 font-medium">📅 행사 일정 <span className="font-normal text-gray-300">(한 줄에 하나씩)</span></p>
          <textarea
            className={`${TEXTAREA} min-h-[80px]`}
            placeholder={'예:\n수련회 신청 마감 (5/10)\n성체행렬 봉사자 모집'}
            value={eventsText}
            onChange={e => setEventsText(e.target.value)}
          />
        </div>
        <button
          onClick={() => void handleWeekSave()}
          disabled={weekSaving}
          className="w-full bg-[#1e3a5f] text-white rounded-2xl py-3.5 font-semibold text-sm disabled:opacity-40 transition active:scale-[0.98]"
        >
          {weekSaving ? '저장 중...' : weekSaved ? '✓ 저장됨' : '저장'}
        </button>
      </div>

      {/* 작성 폼 */}
      <form onSubmit={handleSend} className="bg-white rounded-2xl p-5 space-y-3">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">새 알림 보내기</p>
        <input
          className={INPUT}
          placeholder="제목 (선택)"
          value={title}
          onChange={e => setTitle(e.target.value)}
        />
        <textarea
          className={`${INPUT} min-h-[90px] resize-none`}
          placeholder="내용을 입력하세요"
          value={body}
          onChange={e => setBody(e.target.value)}
          required
        />

        {/* 빠른 입력 */}
        <div>
          <p className="text-xs text-gray-400 mb-2">빠른 입력</p>
          <div className="flex flex-col gap-1.5">
            {QUICK_MSGS.map(msg => (
              <button
                key={msg}
                type="button"
                onClick={() => setBody(prev => prev.trim() ? `${prev}\n${msg}` : msg)}
                className="text-left text-xs bg-gray-50 hover:bg-gray-100 text-gray-500 px-3.5 py-2.5 rounded-xl transition"
              >
                {msg}
              </button>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={sending || !body.trim()}
          className="w-full bg-[#1e3a5f] text-white rounded-2xl py-4 font-semibold text-sm disabled:opacity-40 transition active:scale-[0.98] mt-1"
        >
          {sending ? '전송 중...' : sent ? '✓ 전송됨' : '📢 알림 보내기'}
        </button>
      </form>

      {/* 알림 목록 */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1">보낸 알림</p>
        {notices.length === 0 ? (
          <div className="bg-white rounded-2xl py-12 text-center text-gray-300 text-sm">
            보낸 알림이 없습니다
          </div>
        ) : (
          notices.map(n => (
            <div key={n.id} className="bg-white rounded-2xl p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm">{n.title}</p>
                  <p className="text-sm text-gray-500 mt-1 whitespace-pre-wrap leading-relaxed">{n.body}</p>
                  <p className="text-xs text-gray-300 mt-2">{formatDate(n.createdAt)}</p>
                </div>
                <button
                  onClick={() => handleDelete(n.id)}
                  className="text-gray-200 hover:text-red-400 transition text-xl leading-none shrink-0 mt-0.5"
                >
                  ×
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
