import { useState, useEffect } from 'react'
import { getAllUsers, getAssignment, saveAssignment, getThisWeekId, getWeekList } from '../../lib/firestore'
import type { AppUser, Assignment } from '../../types'

const EMPTY_ASSIGNMENT: Omit<Assignment, 'weekId'> = {
  narrator: '',
  acolytes: ['', ''],
  intercessions: { 1: '', 2: '', 3: '', 4: '' },
}

const SELECT = 'w-full bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#1e3a5f]/10 border border-transparent focus:border-gray-200 transition'

interface StudentSelectProps {
  students: AppUser[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

function StudentSelect({ students, value, onChange, placeholder }: StudentSelectProps) {
  return (
    <select className={SELECT} value={value} onChange={e => onChange(e.target.value)}>
      <option value="">{placeholder ?? '학생 선택'}</option>
      {students.map(s => (
        <option key={s.uid} value={s.uid}>{s.grade} {s.name}</option>
      ))}
    </select>
  )
}

export default function AssignmentPage() {
  const [students, setStudents] = useState<AppUser[]>([])
  const [weekId, setWeekId] = useState(getThisWeekId())
  const [weekList, setWeekList] = useState<string[]>([])
  const [form, setForm] = useState<Omit<Assignment, 'weekId'>>(EMPTY_ASSIGNMENT)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [all, list] = await Promise.all([getAllUsers(), getWeekList()])
      if (cancelled) return
      setStudents(all.filter(u => u.role === 'student'))
      setWeekList(Array.from(new Set([getThisWeekId(), ...list])).sort().reverse())
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const assignment = await getAssignment(weekId)
      if (cancelled) return
      setForm(assignment ? {
        narrator: assignment.narrator,
        acolytes: assignment.acolytes,
        intercessions: assignment.intercessions,
      } : EMPTY_ASSIGNMENT)
    })()
    return () => { cancelled = true }
  }, [weekId])

  const handleSave = async () => {
    setSaving(true)
    await saveAssignment(weekId, form)
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const studentName = (uid: string) => students.find(s => s.uid === uid)?.name ?? ''

  const hasSummary = form.narrator || form.acolytes.some(Boolean) || Object.values(form.intercessions).some(Boolean)

  return (
    <div className="px-4 pt-6 pb-8 space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-1">
        <h2 className="text-xl font-bold text-gray-900">역할 배정</h2>
        <select
          className="bg-gray-100 text-gray-600 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none"
          value={weekId}
          onChange={e => setWeekId(e.target.value)}
        >
          {weekList.map(w => <option key={w} value={w}>{w}</option>)}
        </select>
      </div>

      {/* 배정 폼 */}
      <div className="bg-white rounded-2xl p-5 space-y-5">
        {/* 해설 */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">해설 · 1명</p>
          <StudentSelect students={students} value={form.narrator} onChange={v => setForm({ ...form, narrator: v })} />
        </div>

        <div className="h-px bg-gray-50" />

        {/* 복사 */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">독서 · 2명</p>
          <div className="space-y-2">
            {[0, 1].map(i => (
              <StudentSelect
                key={i}
                students={students}
                value={form.acolytes[i] ?? ''}
                onChange={v => {
                  const acolytes = [...form.acolytes]
                  acolytes[i] = v
                  setForm({ ...form, acolytes })
                }}
                placeholder={`독서 ${i + 1}번`}
              />
            ))}
          </div>
        </div>

        <div className="h-px bg-gray-50" />

        {/* 보편지향기도 */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">보편지향기도 · 4명</p>
          <div className="space-y-2">
            {([1, 2, 3, 4] as const).map(n => (
              <div key={n} className="flex items-center gap-3">
                <span className="text-xs font-semibold text-gray-300 w-5 text-center shrink-0">{n}</span>
                <StudentSelect
                  students={students}
                  value={form.intercessions[n] ?? ''}
                  onChange={v => setForm({ ...form, intercessions: { ...form.intercessions, [n]: v } })}
                  placeholder={`${n}번 담당`}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 배정 요약 */}
      {hasSummary && (
        <div className="bg-[#1e3a5f]/5 rounded-2xl p-5 space-y-2">
          <p className="text-xs font-semibold text-[#1e3a5f] uppercase tracking-wider mb-3">배정 요약</p>
          {form.narrator && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">해설</span>
              <span className="font-semibold text-gray-800">{studentName(form.narrator)}</span>
            </div>
          )}
          {form.acolytes.filter(Boolean).map((uid, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span className="text-gray-400">복사 {i + 1}</span>
              <span className="font-semibold text-gray-800">{studentName(uid)}</span>
            </div>
          ))}
          {([1, 2, 3, 4] as const).filter(n => form.intercessions[n]).map(n => (
            <div key={n} className="flex items-center justify-between text-sm">
              <span className="text-gray-400">보편지향기도 {n}번</span>
              <span className="font-semibold text-gray-800">{studentName(form.intercessions[n])}</span>
            </div>
          ))}
        </div>
      )}

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
