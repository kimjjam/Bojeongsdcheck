import { useState, useEffect } from 'react'
import { getAllUsers, createStudent, updateUser, deleteUser, getTodaySpecialStudents } from '../../lib/firestore'
import type { AppUser, StudentGroup } from '../../types'

const GRADES = ['중1', '중2', '중3', '고1', '고2', '고3']
const GRADE_ORDER = GRADES
const ALL_GROUPS: StudentGroup[] = ['전례부', '성가대', '반주단']

const GROUP_COLOR: Record<StudentGroup, string> = {
  '전례부': 'bg-purple-100 text-purple-700',
  '성가대': 'bg-green-100 text-green-700',
  '반주단': 'bg-orange-100 text-orange-700',
}

/** YYYY-MM-DD → YYMMDD */
function toShortDate(full: string) {
  return full.replace(/-/g, '').slice(2) // "2013-05-15" → "130515"
}
/** YYMMDD → YYYY-MM-DD (input[type=date] 용) */
function toLongDate(short: string) {
  if (!short || short.length !== 6) return ''
  const yy = parseInt(short.slice(0, 2), 10)
  const year = yy >= 0 && yy <= 30 ? `20${short.slice(0, 2)}` : `19${short.slice(0, 2)}`
  return `${year}-${short.slice(2, 4)}-${short.slice(4, 6)}`
}

function GroupCheckboxes({ selected, onChange }: { selected: StudentGroup[]; onChange: (v: StudentGroup[]) => void }) {
  const toggle = (g: StudentGroup) =>
    onChange(selected.includes(g) ? selected.filter(x => x !== g) : [...selected, g])
  return (
    <div className="flex gap-2">
      {ALL_GROUPS.map(g => (
        <button key={g} type="button" onClick={() => toggle(g)}
          className={`flex-1 py-2 rounded-lg text-sm font-medium border transition ${
            selected.includes(g) ? GROUP_COLOR[g] + ' border-transparent' : 'border-gray-200 text-gray-400'
          }`}
        >{g}</button>
      ))}
    </div>
  )
}

export default function StudentsPage() {
  const [students, setStudents] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editTarget, setEditTarget] = useState<AppUser | null>(null)
  const [todayBirthday, setTodayBirthday] = useState<AppUser[]>([])
  const [todayFeastDay, setTodayFeastDay] = useState<AppUser[]>([])

  const [newName, setNewName] = useState('')
  const [newBaptismalName, setNewBaptismalName] = useState('')
  const [newGrade, setNewGrade] = useState('중1')
  const [newGroups, setNewGroups] = useState<StudentGroup[]>([])
  const [newBirthDate, setNewBirthDate] = useState('')  // "YYYY-MM-DD"
  const [saving, setSaving] = useState(false)
  const [addError, setAddError] = useState('')

  const load = async () => {
    setLoading(true)
    const all = await getAllUsers()
    setStudents(all.filter(u => u.role === 'student'))
    setLoading(false)
  }

  useEffect(() => {
    load()
    getTodaySpecialStudents().then(({ birthday, feastDay }) => {
      setTodayBirthday(birthday)
      setTodayFeastDay(feastDay)
    })
  }, [])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true); setAddError('')
    try {
      await createStudent(newName, newBaptismalName, newGrade, newGroups, toShortDate(newBirthDate))
      setShowAdd(false)
      setNewName(''); setNewBaptismalName(''); setNewGrade('중1'); setNewGroups([]); setNewBirthDate('')
      await load()
    } catch {
      setAddError('등록 실패. 다시 시도해주세요.')
    } finally { setSaving(false) }
  }

  const handleEditSave = async () => {
    if (!editTarget) return
    setSaving(true)
    await updateUser(editTarget.uid, {
      name: editTarget.name,
      baptismalName: editTarget.baptismalName,
      grade: editTarget.grade,
      groups: editTarget.groups ?? [],
      birthDate: editTarget.birthDate ?? '',
    })
    setEditTarget(null); setSaving(false); await load()
  }

  const handleDelete = async (uid: string, name: string) => {
    if (!confirm(`${name} 학생을 삭제하시겠습니까?`)) return
    await deleteUser(uid); await load()
  }

  const grouped = students.reduce<Record<string, AppUser[]>>((acc, s) => {
    const g = s.grade ?? '기타'
    if (!acc[g]) acc[g] = []
    acc[g].push(s); return acc
  }, {})

  return (
    <div className="p-4 space-y-4">
      {/* 2순위: 생일/축일 알림 배너 */}
      {(todayBirthday.length > 0 || todayFeastDay.length > 0) && (
        <div className="space-y-2">
          {todayBirthday.length > 0 && (
            <div className="bg-pink-50 border border-pink-200 rounded-xl p-3.5 flex items-start gap-3">
              <div className="text-2xl">🎂</div>
              <div>
                <p className="font-bold text-pink-800 text-sm">오늘 생일인 학생</p>
                <p className="text-pink-600 text-xs mt-0.5">
                  {todayBirthday.map(s => `${s.name} (${s.grade})`).join(', ')}
                </p>
              </div>
            </div>
          )}
          {todayFeastDay.length > 0 && (
            <div className="bg-violet-50 border border-violet-200 rounded-xl p-3.5 flex items-start gap-3">
              <div className="text-2xl">✝️</div>
              <div>
                <p className="font-bold text-violet-800 text-sm">오늘 축일인 학생</p>
                <p className="text-violet-600 text-xs mt-0.5">
                  {todayFeastDay.map(s => `${s.name} (${s.baptismalName})`).join(', ')}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-800">학생 명단 ({students.length}명)</h2>
        <button onClick={() => setShowAdd(true)} className="bg-[#1e3a5f] text-white text-sm px-4 py-2 rounded-lg">+ 학생 추가</button>
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-400">불러오는 중...</div>
      ) : students.length === 0 ? (
        <div className="text-center py-10 text-gray-400">등록된 학생이 없습니다</div>
      ) : (
        Object.entries(grouped)
          .sort(([a], [b]) => GRADE_ORDER.indexOf(a) - GRADE_ORDER.indexOf(b))
          .map(([grade, list]) => (
            <div key={grade} className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="bg-[#1e3a5f] text-white px-4 py-2 text-sm font-semibold">{grade} ({list.length}명)</div>
              <ul className="divide-y divide-gray-100">
                {list.map(s => (
                  <li key={s.uid} className="px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-medium text-gray-800">{s.name}</span>
                        {s.baptismalName && <span className="text-xs text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded">{s.baptismalName}</span>}
                        {s.birthDate ? <span className="text-xs text-gray-400">{s.birthDate}</span> : <span className="text-xs text-red-400">생년월일 미등록</span>}
                        {s.groups?.map(g => <span key={g} className={`text-xs px-1.5 py-0.5 rounded ${GROUP_COLOR[g]}`}>{g}</span>)}
                      </div>
                      <div className="flex gap-2 shrink-0 ml-2">
                        <button onClick={() => setEditTarget({ ...s })} className="text-xs text-blue-600 border border-blue-200 px-2 py-1 rounded">수정</button>
                        <button onClick={() => handleDelete(s.uid, s.name)} className="text-xs text-red-500 border border-red-200 px-2 py-1 rounded">삭제</button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))
      )}

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50">
          <div className="bg-white w-full max-w-lg rounded-t-2xl p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-gray-800 mb-4">학생 추가</h3>
            <form onSubmit={handleAdd} className="space-y-3">
              <div className="grid grid-cols-5 gap-2">
                <input className="col-span-3 border rounded-lg px-3 py-2.5 text-sm w-full" placeholder="이름" value={newName} onChange={e => setNewName(e.target.value)} required />
                <input className="col-span-2 border rounded-lg px-3 py-2.5 text-sm w-full" placeholder="세례명" value={newBaptismalName} onChange={e => setNewBaptismalName(e.target.value)} />
              </div>
              <select className="w-full border rounded-lg px-3 py-2.5 text-sm" value={newGrade} onChange={e => setNewGrade(e.target.value)}>
                {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
              <div>
                <p className="text-xs text-gray-500 mb-1">생년월일</p>
                <input type="date" className="w-full border rounded-lg px-3 py-2.5 text-sm" value={newBirthDate} onChange={e => setNewBirthDate(e.target.value)} required />
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1.5">소속 (복수 선택 가능)</p>
                <GroupCheckboxes selected={newGroups} onChange={setNewGroups} />
              </div>
              {addError && <p className="text-red-600 text-sm">{addError}</p>}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowAdd(false)} className="flex-1 border rounded-lg py-2.5 text-sm">취소</button>
                <button type="submit" disabled={saving} className="flex-1 bg-[#1e3a5f] text-white rounded-lg py-2.5 text-sm disabled:opacity-60">{saving ? '등록 중...' : '등록'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50">
          <div className="bg-white w-full max-w-lg rounded-t-2xl p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-gray-800 mb-4">학생 정보 수정</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-5 gap-2">
                <input className="col-span-3 border rounded-lg px-3 py-2.5 text-sm w-full" placeholder="이름" value={editTarget.name} onChange={e => setEditTarget({ ...editTarget, name: e.target.value })} />
                <input className="col-span-2 border rounded-lg px-3 py-2.5 text-sm w-full" placeholder="세례명" value={editTarget.baptismalName ?? ''} onChange={e => setEditTarget({ ...editTarget, baptismalName: e.target.value })} />
              </div>
              <select className="w-full border rounded-lg px-3 py-2.5 text-sm" value={editTarget.grade ?? '중1'} onChange={e => setEditTarget({ ...editTarget, grade: e.target.value })}>
                {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
              <div>
                <p className="text-xs text-gray-500 mb-1">생년월일</p>
                <input type="date" className="w-full border rounded-lg px-3 py-2.5 text-sm"
                  value={toLongDate(editTarget.birthDate ?? '')}
                  onChange={e => setEditTarget({ ...editTarget, birthDate: toShortDate(e.target.value) })}
                />
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1.5">소속 (복수 선택 가능)</p>
                <GroupCheckboxes selected={(editTarget.groups ?? []) as StudentGroup[]} onChange={v => setEditTarget({ ...editTarget, groups: v })} />
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={() => setEditTarget(null)} className="flex-1 border rounded-lg py-2.5 text-sm">취소</button>
                <button onClick={handleEditSave} disabled={saving} className="flex-1 bg-[#1e3a5f] text-white rounded-lg py-2.5 text-sm disabled:opacity-60">{saving ? '저장 중...' : '저장'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
