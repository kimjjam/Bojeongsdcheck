import { useState, useEffect } from 'react'
import { getWeekData, saveWeekData, getThisWeekId, getWeekList } from '../../lib/firestore'

const INPUT = 'w-full bg-gray-50 rounded-xl px-4 py-3.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#1e3a5f]/10 border border-transparent focus:border-gray-200 transition'
const TEXTAREA = `${INPUT} resize-none`

export default function LiturgyPage() {
  const [weekId, setWeekId] = useState(getThisWeekId())
  const [weekList, setWeekList] = useState<string[]>([])
  const [readings1, setReadings1] = useState('')
  const [readings2, setReadings2] = useState('')
  const [intercessions, setIntercessions] = useState<Record<number, string>>({ 1: '', 2: '', 3: '', 4: '' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const list = await getWeekList()
      if (cancelled) return
      setWeekList(Array.from(new Set([getThisWeekId(), ...list])).sort().reverse())
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const data = await getWeekData(weekId)
      if (cancelled) return
      if (data) {
        setReadings1(data.readings1 ?? '')
        setReadings2(data.readings2 ?? '')
        setIntercessions(data.intercessions as Record<number, string> ?? { 1: '', 2: '', 3: '', 4: '' })
      } else {
        setReadings1(''); setReadings2('')
        setIntercessions({ 1: '', 2: '', 3: '', 4: '' })
      }
    })()
    return () => { cancelled = true }
  }, [weekId])

  const handleSave = async () => {
    setSaving(true)
    await saveWeekData(weekId, {
      readings1, readings2,
      intercessions: intercessions as { 1: string; 2: string; 3: string; 4: string },
    })
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    setWeekList(prev => Array.from(new Set([weekId, ...prev])).sort().reverse())
  }

  return (
    <div className="px-4 pt-6 pb-8 space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-1">
        <h2 className="text-xl font-bold text-gray-900">전례 내용</h2>
        <select
          className="bg-gray-100 text-gray-600 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none"
          value={weekId}
          onChange={e => setWeekId(e.target.value)}
        >
          {weekList.map(w => <option key={w} value={w}>{w}</option>)}
        </select>
      </div>

      {/* 독서 */}
      <div className="bg-white rounded-2xl p-5 space-y-5">
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            제1독서 <span className="normal-case font-normal text-gray-300">· 복사 1번</span>
          </p>
          <textarea
            className={`${TEXTAREA} min-h-[120px]`}
            placeholder="제1독서 내용을 붙여넣으세요"
            value={readings1}
            onChange={e => setReadings1(e.target.value)}
          />
        </div>

        <div className="h-px bg-gray-50" />

        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            제2독서 <span className="normal-case font-normal text-gray-300">· 복사 2번</span>
          </p>
          <textarea
            className={`${TEXTAREA} min-h-[120px]`}
            placeholder="제2독서 내용을 붙여넣으세요"
            value={readings2}
            onChange={e => setReadings2(e.target.value)}
          />
        </div>
      </div>

      {/* 보편지향기도 */}
      <div className="bg-white rounded-2xl p-5 space-y-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">보편지향기도</p>
        {([1, 2, 3, 4] as const).map(n => (
          <div key={n} className="space-y-1.5">
            <p className="text-xs text-gray-400 font-medium">{n}번</p>
            <textarea
              className={`${TEXTAREA} min-h-[80px]`}
              placeholder={`보편지향기도 ${n}번 내용`}
              value={intercessions[n] ?? ''}
              onChange={e => setIntercessions({ ...intercessions, [n]: e.target.value })}
            />
          </div>
        ))}
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-[#1e3a5f] text-white rounded-2xl py-4 font-semibold disabled:opacity-40 transition active:scale-[0.98]"
      >
        {saving ? '저장 중...' : saved ? '✓ 저장됨' : '저장'}
      </button>
    </div>
  )
}
