import { useState, useEffect, useRef } from 'react'
import {
  getStudentsPublic, getAttendance, markAttendance,
  getThisWeekId, onKioskSessionChange
} from '../lib/firestore'
import type { AppUser } from '../types'

type Student = Pick<AppUser, 'uid' | 'name' | 'baptismalName' | 'grade' | 'birthDate'>

const LS_KEY = 'kiosk_student'

type Step = 'search' | 'verify' | 'ready' | 'done'

export default function AttendanceKioskPage() {
  const [kioskOpen, setKioskOpen] = useState<boolean | null>(null) // null = loading
  const [students, setStudents] = useState<Student[]>([])
  const [attendance, setAttendance] = useState<Record<string, boolean>>({})
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Student | null>(null)
  const [step, setStep] = useState<Step>('search')
  const [birthInput, setBirthInput] = useState('')
  const [birthError, setBirthError] = useState(false)
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const weekId = getThisWeekId()

  // 로컬 저장된 학생
  const savedStudent: Student | null = (() => {
    try { return JSON.parse(localStorage.getItem(LS_KEY) ?? 'null') } catch { return null }
  })()

  useEffect(() => {
    // 키오스크 세션 실시간 감지
    const unsub = onKioskSessionChange(s => setKioskOpen(s.isOpen))

    Promise.all([getStudentsPublic(), getAttendance(weekId)]).then(([sts, records]) => {
      setStudents(sts)
      const map: Record<string, boolean> = {}
      records.forEach(r => { map[r.uid] = r.present })
      setAttendance(map)
    })

    return () => unsub()
  }, [weekId])

  // 로컬 세션 있으면 바로 ready
  useEffect(() => {
    if (savedStudent && students.length > 0) {
      const match = students.find(s => s.uid === savedStudent.uid)
      if (match) { setSelected(match); setStep('ready') }
    }
  }, [students])

  const filtered = query.trim().length > 0
    ? students.filter(s => s.name.includes(query.trim()))
    : []

  const handleSelect = (s: Student) => {
    setSelected(s); setQuery(s.name); setBirthInput(''); setBirthError(false)
    // 생년월일이 없으면 바로 ready (임시)
    setStep(s.birthDate ? 'verify' : 'ready')
  }

  const handleVerify = () => {
    if (!selected) return
    if (birthInput === selected.birthDate) {
      localStorage.setItem(LS_KEY, JSON.stringify(selected))
      setStep('ready')
    } else {
      setBirthError(true)
      setBirthInput('')
    }
  }

  const handleCheck = async () => {
    if (!selected) return
    setSaving(true)
    await markAttendance(weekId, selected.uid, true)
    setAttendance(prev => ({ ...prev, [selected.uid]: true }))
    setSaving(false)
    setStep('done')
    setTimeout(() => reset(), 3000)
  }

  const reset = () => {
    setSelected(null); setQuery(''); setBirthInput(''); setBirthError(false)
    setStep('search'); inputRef.current?.focus()
  }

  const clearLocal = () => {
    localStorage.removeItem(LS_KEY); reset()
  }

  const alreadyChecked = selected ? attendance[selected.uid] === true : false
  const presentCount = Object.values(attendance).filter(Boolean).length

  // ── 로딩 ──────────────────────────────────────────────────────────────────
  if (kioskOpen === null) {
    return (
      <div className="min-h-screen bg-[#1e3a5f] flex items-center justify-center">
        <div className="text-white text-center"><div className="text-3xl mb-2">✝️</div><p>불러오는 중...</p></div>
      </div>
    )
  }

  // ── 키오스크 닫힘 ──────────────────────────────────────────────────────────
  if (!kioskOpen) {
    return (
      <div className="min-h-screen bg-[#1e3a5f] flex flex-col items-center justify-center px-6 text-center">
        <div className="text-5xl mb-4">🔒</div>
        <h1 className="text-white text-xl font-bold">아직 출석 체크 시간이 아닙니다</h1>
        <p className="text-blue-200 text-sm mt-2">선생님이 출석을 열면 이 화면이 바뀝니다</p>
        <p className="text-blue-300 text-xs mt-4">{weekId}</p>
      </div>
    )
  }

  // ── 출석 완료 ──────────────────────────────────────────────────────────────
  if (step === 'done' && selected) {
    return (
      <div className="min-h-screen bg-[#1e3a5f] flex flex-col items-center justify-center">
        <div className="bg-white rounded-2xl p-8 text-center w-72 space-y-2">
          <div className="text-5xl">✅</div>
          <p className="text-xl font-bold text-gray-800">{selected.name}</p>
          {selected.baptismalName && <p className="text-blue-600 font-medium">{selected.baptismalName}</p>}
          <p className="text-green-600 font-semibold">출석 완료!</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#1e3a5f] flex flex-col items-center justify-start pt-10 px-4">
      <div className="w-full max-w-sm space-y-5">

        {/* 헤더 */}
        <div className="text-center">
          <div className="text-4xl mb-2">✝️</div>
          <h1 className="text-white text-xl font-bold">출석 체크</h1>
          <p className="text-blue-200 text-sm mt-1">{weekId} 미사</p>
        </div>

        {/* 로컬 세션: 바로 체크인 */}
        {step === 'ready' && selected && (
          <div className="bg-white rounded-2xl p-5 space-y-4">
            <div className="text-center">
              <p className="text-lg font-bold text-gray-800">{selected.name}</p>
              {selected.baptismalName && <p className="text-blue-600 font-medium">{selected.baptismalName}</p>}
              <p className="text-sm text-gray-400">{selected.grade}</p>
            </div>
            {alreadyChecked ? (
              <div className="bg-green-50 rounded-xl py-3 text-center">
                <p className="text-green-600 font-medium">이미 출석 완료</p>
              </div>
            ) : (
              <button onClick={handleCheck} disabled={saving}
                className="w-full bg-[#1e3a5f] text-white rounded-xl py-4 text-lg font-bold disabled:opacity-60">
                {saving ? '처리 중...' : '출석 확인'}
              </button>
            )}
            <button onClick={clearLocal} className="w-full text-sm text-gray-400 border border-gray-200 rounded-xl py-2">
              다른 학생으로 체크인
            </button>
          </div>
        )}

        {/* 이름 검색 */}
        {step === 'search' && (
          <>
            <div className="relative">
              <input ref={inputRef} type="text" value={query}
                onChange={e => { setQuery(e.target.value); setSelected(null) }}
                placeholder="이름을 입력하세요"
                className="w-full rounded-xl px-4 py-3.5 text-base bg-white focus:outline-none"
                autoComplete="off"
              />
              {query && <button onClick={reset} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xl">×</button>}
            </div>

            {filtered.length > 0 && (
              <div className="bg-white rounded-xl overflow-hidden shadow-lg">
                {filtered.map(s => (
                  <button key={s.uid} onClick={() => handleSelect(s)}
                    className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-blue-50 border-b border-gray-100 last:border-0 text-left">
                    <div>
                      <span className="font-medium text-gray-800">{s.name}</span>
                      {s.baptismalName && <span className="ml-2 text-blue-600 font-medium">{s.baptismalName}</span>}
                    </div>
                    <span className="text-xs text-gray-400">{s.grade}</span>
                  </button>
                ))}
              </div>
            )}
            {filtered.length === 0 && query.trim().length > 0 && (
              <p className="text-center text-blue-200 text-sm">검색 결과가 없습니다</p>
            )}
          </>
        )}

        {/* 생년월일 인증 */}
        {step === 'verify' && selected && (
          <div className="bg-white rounded-2xl p-5 space-y-4">
            <div className="text-center">
              <p className="text-lg font-bold text-gray-800">{selected.name}</p>
              {selected.baptismalName && <p className="text-blue-600">{selected.baptismalName}</p>}
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-2 text-center">생년월일 6자리를 입력하세요</p>
              <p className="text-xs text-gray-400 text-center mb-3">예: 2013년 5월 15일 → 130515</p>
              <input
                type="tel" maxLength={6} value={birthInput}
                onChange={e => { setBirthInput(e.target.value.replace(/\D/g, '')); setBirthError(false) }}
                onKeyDown={e => e.key === 'Enter' && handleVerify()}
                placeholder="YYMMDD"
                className={`w-full border-2 rounded-xl px-4 py-3 text-center text-2xl tracking-widest font-mono ${
                  birthError ? 'border-red-400 bg-red-50' : 'border-gray-200'
                }`}
                autoFocus
              />
              {birthError && <p className="text-red-500 text-sm text-center mt-1">생년월일이 일치하지 않습니다</p>}
            </div>
            <button onClick={handleVerify} disabled={birthInput.length !== 6}
              className="w-full bg-[#1e3a5f] text-white rounded-xl py-3 font-bold disabled:opacity-40">
              확인
            </button>
            <button onClick={reset} className="w-full text-sm text-gray-400">← 다시 검색</button>
          </div>
        )}

        <div className="text-center text-blue-200 text-sm">
          오늘 출석: {presentCount}명 / {students.length}명
        </div>
      </div>
    </div>
  )
}
