import { useState, useEffect } from 'react'
import { getWeekData, saveWeekData, getThisWeekId, getWeekList } from '../../lib/firestore'

const EMPTY = {
  readings1: '',
  readings2: '',
  intercessions: { 1: '', 2: '', 3: '', 4: '' },
  snack: '',
  events: '',
}

export default function LiturgyPage() {
  const [weekId, setWeekId] = useState(getThisWeekId())
  const [weekList, setWeekList] = useState<string[]>([])
  const [readings1, setReadings1] = useState('')
  const [readings2, setReadings2] = useState('')
  const [intercessions, setIntercessions] = useState<Record<number, string>>({ 1: '', 2: '', 3: '', 4: '' })
  const [snack, setSnack] = useState('')
  const [eventsText, setEventsText] = useState('')  // 줄바꿈으로 구분
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const loadWeek = async (wid: string) => {
    const data = await getWeekData(wid)
    if (data) {
      setReadings1(data.readings1 ?? '')
      setReadings2(data.readings2 ?? '')
      setIntercessions(data.intercessions as Record<number, string> ?? EMPTY.intercessions)
      setSnack(data.snack ?? '')
      setEventsText(data.events?.join('\n') ?? '')
    } else {
      setReadings1(''); setReadings2('')
      setIntercessions({ 1: '', 2: '', 3: '', 4: '' })
      setSnack(''); setEventsText('')
    }
  }

  useEffect(() => {
    getWeekList().then(list => {
      const merged = Array.from(new Set([getThisWeekId(), ...list])).sort().reverse()
      setWeekList(merged)
    })
    loadWeek(weekId)
  }, [])

  const handleSave = async () => {
    setSaving(true)
    const events = eventsText.split('\n').map(s => s.trim()).filter(Boolean)
    await saveWeekData(weekId, {
      readings1,
      readings2,
      intercessions: intercessions as { 1: string; 2: string; 3: string; 4: string },
      snack: snack || undefined,
      events: events.length > 0 ? events : undefined,
    })
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    setWeekList(prev => Array.from(new Set([weekId, ...prev])).sort().reverse())
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-800">전례 내용</h2>
        <select className="border rounded-lg px-2 py-1.5 text-sm" value={weekId}
          onChange={e => { setWeekId(e.target.value); loadWeek(e.target.value) }}>
          {weekList.map(w => <option key={w} value={w}>{w}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-4 space-y-4">
        {/* 제1독서 */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            📖 제1독서 <span className="text-xs text-gray-400 font-normal">(복사 1번)</span>
          </label>
          <textarea
            className="w-full border rounded-lg px-3 py-2.5 text-sm min-h-[120px] resize-none"
            placeholder="제1독서 내용을 붙여넣으세요"
            value={readings1}
            onChange={e => setReadings1(e.target.value)}
          />
        </div>

        {/* 제2독서 */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            📖 제2독서 <span className="text-xs text-gray-400 font-normal">(복사 2번)</span>
          </label>
          <textarea
            className="w-full border rounded-lg px-3 py-2.5 text-sm min-h-[120px] resize-none"
            placeholder="제2독서 내용을 붙여넣으세요"
            value={readings2}
            onChange={e => setReadings2(e.target.value)}
          />
        </div>

        {/* 보편지향기도 */}
        {([1, 2, 3, 4] as const).map(n => (
          <div key={n}>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">🙏 보편지향기도 {n}번</label>
            <textarea
              className="w-full border rounded-lg px-3 py-2.5 text-sm min-h-[80px] resize-none"
              placeholder={`보편지향기도 ${n}번 내용`}
              value={intercessions[n] ?? ''}
              onChange={e => setIntercessions({ ...intercessions, [n]: e.target.value })}
            />
          </div>
        ))}

        <hr className="border-gray-100" />

        {/* 간식 */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            🍪 이번 주 간식
          </label>
          <input
            className="w-full border rounded-lg px-3 py-2.5 text-sm"
            placeholder="예: 떡볶이, 음료수"
            value={snack}
            onChange={e => setSnack(e.target.value)}
          />
        </div>

        {/* 행사 일정 */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            📅 행사 일정 <span className="text-xs text-gray-400 font-normal">(한 줄에 하나씩)</span>
          </label>
          <textarea
            className="w-full border rounded-lg px-3 py-2.5 text-sm min-h-[80px] resize-none"
            placeholder={"예:\n수련회 신청 마감 (5/10)\n성체행렬 봉사자 모집"}
            value={eventsText}
            onChange={e => setEventsText(e.target.value)}
          />
        </div>
      </div>

      <button onClick={handleSave} disabled={saving}
        className="w-full bg-[#1e3a5f] text-white rounded-xl py-3 font-medium disabled:opacity-60">
        {saving ? '저장 중...' : saved ? '✓ 저장됨' : '저장'}
      </button>
    </div>
  )
}
