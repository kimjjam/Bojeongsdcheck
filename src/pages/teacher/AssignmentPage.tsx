import { useState, useEffect } from 'react'
import { getAllUsers, getAssignment, saveAssignment, getThisWeekId, getWeekList } from '../../lib/firestore'
import type { AppUser, Assignment } from '../../types'

const EMPTY_ASSIGNMENT: Omit<Assignment, 'weekId'> = {
  narrator: '',
  acolytes: ['', ''],
  intercessions: { 1: '', 2: '', 3: '', 4: '' },
}

interface StudentSelectProps {
  students: AppUser[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

function StudentSelect({ students, value, onChange, placeholder }: StudentSelectProps) {
  return (
    <select
      className="w-full border rounded-lg px-3 py-2 text-sm"
      value={value}
      onChange={e => onChange(e.target.value)}
    >
      <option value="">{placeholder ?? '학생 선택'}</option>
      {students.map(s => (
        <option key={s.uid} value={s.uid}>{s.grade}학년 {s.name}</option>
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
      const merged = Array.from(new Set([getThisWeekId(), ...list])).sort().reverse()
      setWeekList(merged)
    })()

    return () => {
      cancelled = true
    }
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

    return () => {
      cancelled = true
    }
  }, [weekId])

  const handleSave = async () => {
    setSaving(true)
    await saveAssignment(weekId, form)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const studentName = (uid: string) => students.find(s => s.uid === uid)?.name ?? ''

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-800">역할 배정</h2>
        <select
          className="border rounded-lg px-2 py-1.5 text-sm"
          value={weekId}
          onChange={e => setWeekId(e.target.value)}
        >
          {weekList.map(w => <option key={w} value={w}>{w}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-4 space-y-4">
        {/* 해설 */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">해설 (1명)</label>
          <StudentSelect
            students={students}
            value={form.narrator}
            onChange={v => setForm({ ...form, narrator: v })}
          />
        </div>

        {/* 복사 */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">복사 (2명)</label>
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
                placeholder={`복사 ${i + 1}번`}
              />
            ))}
          </div>
        </div>

        {/* 보편지향기도 */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">보편지향기도</label>
          <div className="space-y-2">
            {([1, 2, 3, 4] as const).map(n => (
              <div key={n} className="flex items-center gap-2">
                <span className="text-sm text-gray-500 w-6 shrink-0">{n}번</span>
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

      {/* Summary */}
      {(form.narrator || form.acolytes.some(Boolean) || Object.values(form.intercessions).some(Boolean)) && (
        <div className="bg-blue-50 rounded-xl p-4 text-sm space-y-1">
          <p className="font-semibold text-blue-800 mb-2">배정 요약</p>
          {form.narrator && <p>해설: <strong>{studentName(form.narrator)}</strong></p>}
          {form.acolytes.filter(Boolean).map((uid, i) => (
            <p key={i}>복사 {i + 1}: <strong>{studentName(uid)}</strong></p>
          ))}
          {([1, 2, 3, 4] as const).filter(n => form.intercessions[n]).map(n => (
            <p key={n}>보편지향기도 {n}번: <strong>{studentName(form.intercessions[n])}</strong></p>
          ))}
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-[#1e3a5f] text-white rounded-xl py-3 font-medium disabled:opacity-60"
      >
        {saving ? '저장 중...' : saved ? '✓ 저장됨' : '저장'}
      </button>
    </div>
  )
}
