import { useState, useEffect } from 'react'
import { getAllUsers, createStudent, updateUser, deleteUser, getTodaySpecialStudents } from '../../lib/firestore'
import type { AppUser, StudentGroup } from '../../types'

const GRADES = ['중1', '중2', '중3', '고1', '고2', '고3']
const GRADE_ORDER = GRADES
const ALL_GROUPS: StudentGroup[] = ['전례부', '성가대', '반주단']

const GROUP_COLOR: Record<StudentGroup, string> = {
  '전례부': 'bg-purple-100 text-purple-600',
  '성가대': 'bg-green-100 text-green-600',
  '반주단': 'bg-orange-100 text-orange-600',
}

const INPUT = 'w-full bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:bg-white border border-transparent focus:border-gray-200 transition'

function toShortDate(full: string) {
  return full.replace(/-/g, '').slice(2)
}
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
        <button
          key={g} type="button" onClick={() => toggle(g)}
          className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition ${
            selected.includes(g) ? GROUP_COLOR[g] : 'bg-gray-50 text-gray-400'
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
  const [newBirthDate, setNewBirthDate] = useState('')
  const [newFeastDay, setNewFeastDay] = useState('')
  const [saving, setSaving] = useState(false)
  const [addError, setAddError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<{ uid: string; name: string } | null>(null)

  const load = async () => {
    setLoading(true)
    const all = await getAllUsers()
    setStudents(all.filter(u => u.role === 'student'))
    setLoading(false)
  }

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [all, specialStudents] = await Promise.all([getAllUsers(), getTodaySpecialStudents()])
      if (cancelled) return
      setStudents(all.filter(u => u.role === 'student'))
      setTodayBirthday(specialStudents.birthday)
      setTodayFeastDay(specialStudents.feastDay)
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true); setAddError('')
    try {
      await createStudent(newName, newBaptismalName, newGrade, newGroups, toShortDate(newBirthDate), newFeastDay || undefined)
      setShowAdd(false)
      setNewName(''); setNewBaptismalName(''); setNewGrade('중1'); setNewGroups([]); setNewBirthDate(''); setNewFeastDay('')
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
      feastDay: editTarget.feastDay ?? '',
    })
    setEditTarget(null); setSaving(false); await load()
  }

  const handleDeleteRequest = (uid: string, name: string) => {
    setDeleteTarget({ uid, name })
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    await deleteUser(deleteTarget.uid)
    setDeleteTarget(null)
    await load()
  }

  const grouped = students.reduce<Record<string, AppUser[]>>((acc, s) => {
    const g = s.grade ?? '기타'
    if (!acc[g]) acc[g] = []
    acc[g].push(s); return acc
  }, {})

  const modalInputCls = INPUT

  return (
    <div className="px-4 pt-6 pb-8 space-y-4">
      {/* 생일/축일 배너 */}
      {(todayBirthday.length > 0 || todayFeastDay.length > 0) && (
        <div className="space-y-2">
          {todayBirthday.length > 0 && (
            <div className="bg-pink-50 rounded-2xl p-4 flex items-center gap-3">
              <span className="text-2xl">🎂</span>
              <div>
                <p className="font-semibold text-pink-700 text-sm">오늘 생일</p>
                <p className="text-pink-500 text-xs mt-0.5">{todayBirthday.map(s => `${s.name} (${s.grade})`).join(', ')}</p>
              </div>
            </div>
          )}
          {todayFeastDay.length > 0 && (
            <div className="bg-violet-50 rounded-2xl p-4 flex items-center gap-3">
              <span className="text-2xl">✝️</span>
              <div>
                <p className="font-semibold text-violet-700 text-sm">오늘 축일</p>
                <p className="text-violet-500 text-xs mt-0.5">{todayFeastDay.map(s => `${s.name} (${s.baptismalName})`).join(', ')}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 헤더 */}
      <div className="flex items-center justify-between px-1">
        <h2 className="text-xl font-bold text-gray-900">학생 명단 <span className="text-gray-300 font-normal text-base">{students.length}</span></h2>
        <button
          onClick={() => setShowAdd(true)}
          className="bg-[#1e3a5f] text-white text-xs font-semibold px-4 py-2.5 rounded-xl"
        >
          + 추가
        </button>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-300 text-sm">불러오는 중...</div>
      ) : students.length === 0 ? (
        <div className="text-center py-16 text-gray-300 text-sm">등록된 학생이 없습니다</div>
      ) : (
        Object.entries(grouped)
          .sort(([a], [b]) => GRADE_ORDER.indexOf(a) - GRADE_ORDER.indexOf(b))
          .map(([grade, list]) => (
            <div key={grade} className="bg-white rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-50">
                <span className="text-xs font-semibold text-gray-400">{grade} · {list.length}명</span>
              </div>
              <ul className="divide-y divide-gray-50">
                {list.map(s => (
                  <li key={s.uid} className="px-5 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-gray-900 text-sm">{s.name}</span>
                          {s.baptismalName && (
                            <span className="text-[10px] font-medium bg-blue-50 text-blue-500 px-2 py-0.5 rounded-full">{s.baptismalName}</span>
                          )}
                          {s.groups?.map(g => (
                            <span key={g} className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${GROUP_COLOR[g]}`}>{g}</span>
                          ))}
                        </div>
                        <p className={`text-xs mt-0.5 ${s.birthDate ? 'text-gray-400' : 'text-red-400'}`}>
                          {s.birthDate ? s.birthDate : '생년월일 미등록'}
                        </p>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <button
                          onClick={() => setEditTarget({ ...s })}
                          className="text-xs text-gray-400 bg-gray-50 hover:bg-gray-100 px-3 py-1.5 rounded-lg transition"
                        >수정</button>
                        <button
                          onClick={() => handleDeleteRequest(s.uid, s.name)}
                          className="text-xs text-red-400 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition"
                        >삭제</button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))
      )}

      {/* 추가 모달 */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50" onClick={() => setShowAdd(false)}>
          <div className="bg-white w-full max-w-lg rounded-t-3xl p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
            <h3 className="font-bold text-gray-900 text-base mb-5">학생 추가</h3>
            <form onSubmit={handleAdd} className="space-y-3">
              <div className="grid grid-cols-5 gap-2">
                <input className={`col-span-3 ${modalInputCls}`} placeholder="이름" value={newName} onChange={e => setNewName(e.target.value)} required />
                <input className={`col-span-2 ${modalInputCls}`} placeholder="세례명" value={newBaptismalName} onChange={e => setNewBaptismalName(e.target.value)} />
              </div>
              <select className={modalInputCls} value={newGrade} onChange={e => setNewGrade(e.target.value)}>
                {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <p className="text-xs text-gray-400 font-medium px-1">생년월일</p>
                  <input type="date" className={modalInputCls} value={newBirthDate} onChange={e => setNewBirthDate(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs text-gray-400 font-medium px-1">축일 <span className="font-normal text-gray-300">(MM.DD)</span></p>
                  <input className={modalInputCls} placeholder="예: 07.25" maxLength={5} value={newFeastDay} onChange={e => setNewFeastDay(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs text-gray-400 font-medium px-1">소속</p>
                <GroupCheckboxes selected={newGroups} onChange={setNewGroups} />
              </div>
              {addError && <p className="text-red-500 text-sm px-1">{addError}</p>}
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowAdd(false)} className="flex-1 bg-gray-100 text-gray-600 rounded-2xl py-3.5 font-medium text-sm">취소</button>
                <button type="submit" disabled={saving} className="flex-1 bg-[#1e3a5f] text-white rounded-2xl py-3.5 font-semibold text-sm disabled:opacity-40">{saving ? '등록 중...' : '등록'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 삭제 확인 모달 */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-6" onClick={() => setDeleteTarget(null)}>
          <div className="bg-white w-full max-w-xs rounded-3xl p-6 space-y-5" onClick={e => e.stopPropagation()}>
            <div className="text-center space-y-2">
              <div className="text-3xl">🗑️</div>
              <p className="font-bold text-gray-900 text-base">{deleteTarget.name} 학생 삭제</p>
              <p className="text-sm text-gray-400 leading-relaxed">
                삭제하면 복구할 수 없습니다.<br />정말 삭제하시겠습니까?
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 bg-gray-100 text-gray-600 rounded-2xl py-3.5 font-medium text-sm"
              >
                취소
              </button>
              <button
                onClick={() => void handleDeleteConfirm()}
                className="flex-1 bg-red-500 text-white rounded-2xl py-3.5 font-semibold text-sm"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 수정 모달 */}
      {editTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50" onClick={() => setEditTarget(null)}>
          <div className="bg-white w-full max-w-lg rounded-t-3xl p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
            <h3 className="font-bold text-gray-900 text-base mb-5">학생 정보 수정</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-5 gap-2">
                <input className={`col-span-3 ${modalInputCls}`} placeholder="이름" value={editTarget.name} onChange={e => setEditTarget({ ...editTarget, name: e.target.value })} />
                <input className={`col-span-2 ${modalInputCls}`} placeholder="세례명" value={editTarget.baptismalName ?? ''} onChange={e => setEditTarget({ ...editTarget, baptismalName: e.target.value })} />
              </div>
              <select className={modalInputCls} value={editTarget.grade ?? '중1'} onChange={e => setEditTarget({ ...editTarget, grade: e.target.value })}>
                {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <p className="text-xs text-gray-400 font-medium px-1">생년월일</p>
                  <input type="date" className={modalInputCls}
                    value={toLongDate(editTarget.birthDate ?? '')}
                    onChange={e => setEditTarget({ ...editTarget, birthDate: toShortDate(e.target.value) })}
                  />
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs text-gray-400 font-medium px-1">축일 <span className="font-normal text-gray-300">(MM.DD)</span></p>
                  <input className={modalInputCls} placeholder="예: 07.25" maxLength={5}
                    value={editTarget.feastDay ?? ''}
                    onChange={e => setEditTarget({ ...editTarget, feastDay: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs text-gray-400 font-medium px-1">소속</p>
                <GroupCheckboxes selected={(editTarget.groups ?? []) as StudentGroup[]} onChange={v => setEditTarget({ ...editTarget, groups: v })} />
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setEditTarget(null)} className="flex-1 bg-gray-100 text-gray-600 rounded-2xl py-3.5 font-medium text-sm">취소</button>
                <button onClick={handleEditSave} disabled={saving} className="flex-1 bg-[#1e3a5f] text-white rounded-2xl py-3.5 font-semibold text-sm disabled:opacity-40">{saving ? '저장 중...' : '저장'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
