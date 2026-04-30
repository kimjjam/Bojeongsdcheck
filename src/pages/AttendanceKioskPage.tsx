import { useEffect, useRef, useState } from 'react'
import {
  findKioskStudentsByBirthDate,
  getAssignment,
  getAttendance,
  getStudentCountPublic,
  getThisWeekId,
  getUserAttendanceHistory,
  getWeekData,
  onAttendanceRecord,
  onKioskSessionChange,
  onPendingRequestChange,
  submitPendingAttendance,
} from '../lib/firestore'
import type { KioskStudent, LiturgyRole } from '../types'

type Step = 'input' | 'select' | 'confirm' | 'waiting' | 'done' | 'rejected'

const ROLE_LABEL: Record<NonNullable<LiturgyRole>, string> = {
  narrator:       '해설',
  acolyte_1:      '복사 · 제1독서',
  acolyte_2:      '복사 · 제2독서',
  intercession_1: '보편지향기도 1번',
  intercession_2: '보편지향기도 2번',
  intercession_3: '보편지향기도 3번',
  intercession_4: '보편지향기도 4번',
}

const ROLE_COLOR: Record<NonNullable<LiturgyRole>, string> = {
  narrator:       'bg-purple-50 text-purple-600',
  acolyte_1:      'bg-blue-50 text-blue-600',
  acolyte_2:      'bg-blue-50 text-blue-600',
  intercession_1: 'bg-amber-50 text-amber-600',
  intercession_2: 'bg-amber-50 text-amber-600',
  intercession_3: 'bg-amber-50 text-amber-600',
  intercession_4: 'bg-amber-50 text-amber-600',
}

interface StudentData {
  stats: { total: number; streak: number; stamps: boolean[] }
  role: LiturgyRole
  roleContent: string | null
  roleContentLabel: string
  snack?: string
  events?: string[]
}

export default function AttendanceKioskPage() {
  const [kioskOpen, setKioskOpen] = useState<boolean | null>(null)
  const [studentCount, setStudentCount] = useState(0)
  const [attendance, setAttendance] = useState<Record<string, boolean>>({})
  const [birthInput, setBirthInput] = useState('')
  const [inputError, setInputError] = useState('')
  const [matches, setMatches] = useState<KioskStudent[]>([])
  const [selected, setSelected] = useState<KioskStudent | null>(null)
  const [step, setStep] = useState<Step>('input')
  const [studentData, setStudentData] = useState<StudentData | null>(null)
  const [dataLoading, setDataLoading] = useState(false)
  const weekId = getThisWeekId()
  const inputRef = useRef<HTMLInputElement>(null)

  function reset() {
    setSelected(null); setBirthInput(''); setMatches([])
    setInputError(''); setStudentData(null); setDataLoading(false)
    setStep('input')
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  useEffect(() => {
    const unsubscribe = onKioskSessionChange(s => setKioskOpen(s.isOpen))
    let cancelled = false
    void Promise.all([getStudentCountPublic(), getAttendance(weekId)]).then(([count, records]) => {
      if (cancelled) return
      setStudentCount(count)
      const map: Record<string, boolean> = {}
      records.forEach(r => { map[r.uid] = r.present })
      setAttendance(map)
    })
    return () => { cancelled = true; unsubscribe() }
  }, [weekId])

  // 학생 확정 시 역할·통계 로드
  useEffect(() => {
    if (!selected) return
    let cancelled = false
    setDataLoading(true)
    void Promise.all([
      getUserAttendanceHistory(selected.uid),
      getAssignment(weekId),
      getWeekData(weekId),
    ]).then(([history, assignment, weekData]) => {
      if (cancelled) return
      const total = history.filter(w => w.present).length
      let streak = 0
      for (const w of history) { if (!w.present) break; streak++ }
      const stamps = history.slice(0, 10).map(w => w.present)

      let role: LiturgyRole = null
      let roleContent: string | null = null
      let roleContentLabel = ''
      if (assignment) {
        if (assignment.narrator === selected.uid) {
          role = 'narrator'
        } else if (assignment.acolytes[0] === selected.uid) {
          role = 'acolyte_1'; roleContent = weekData?.readings1 ?? null; roleContentLabel = '제1독서'
        } else if (assignment.acolytes[1] === selected.uid) {
          role = 'acolyte_2'; roleContent = weekData?.readings2 ?? null; roleContentLabel = '제2독서'
        } else {
          for (const n of [1, 2, 3, 4] as const) {
            if (assignment.intercessions[n] === selected.uid) {
              role = `intercession_${n}` as LiturgyRole
              roleContent = weekData?.intercessions[n] ?? null
              roleContentLabel = `보편지향기도 ${n}번`
              break
            }
          }
        }
      }
      setStudentData({ stats: { total, streak, stamps }, role, roleContent, roleContentLabel, snack: weekData?.snack, events: weekData?.events })
      setDataLoading(false)
    })
    return () => { cancelled = true }
  }, [selected, weekId])

  useEffect(() => {
    if (step !== 'waiting' || !selected) return
    const unsubA = onAttendanceRecord(weekId, selected.uid, present => { if (present) setStep('done') })
    const unsubP = onPendingRequestChange(weekId, selected.uid, req => {
      if (req?.status === 'rejected') { setStep('rejected'); setTimeout(reset, 3500) }
    })
    return () => { unsubA(); unsubP() }
  }, [step, selected, weekId])

  const handleBirthSubmit = async () => {
    if (birthInput.length !== 6) return
    try {
      const found = await findKioskStudentsByBirthDate(birthInput)
      if (found.length === 0) { setInputError('일치하는 학생이 없습니다.'); setBirthInput(''); return }
      setMatches(found); setInputError('')
      if (found.length === 1) { setSelected(found[0]); setStep('confirm') }
      else { setStep('select') }
    } catch { setInputError('오류가 발생했습니다. 다시 시도해주세요.') }
  }

  const handleRequestAttendance = async () => {
    if (!selected) return
    await submitPendingAttendance(weekId, selected.uid)
    setStep('waiting')
  }

  const alreadyChecked = selected ? attendance[selected.uid] === true : false
  const presentCount = Object.values(attendance).filter(Boolean).length

  // ── 로딩 ─────────────────────────────────────────────────────────────────────
  if (kioskOpen === null) {
    return (
      <div className="min-h-screen bg-[#1e3a5f] flex items-center justify-center">
        <div className="text-white text-center space-y-2">
          <div className="text-3xl">✝️</div>
          <p className="text-sm text-blue-200">불러오는 중...</p>
        </div>
      </div>
    )
  }

  // ── 닫힘 ─────────────────────────────────────────────────────────────────────
  if (!kioskOpen) {
    return (
      <div className="min-h-screen bg-[#1e3a5f] flex flex-col items-center justify-center px-8 text-center space-y-3">
        <div className="text-5xl">📵</div>
        <p className="text-white text-lg font-bold">출석이 열리지 않았습니다</p>
        <p className="text-blue-300 text-sm">선생님이 링크를 열면 이 화면이 바뀝니다</p>
        <p className="text-blue-400/50 text-xs mt-4">{weekId}</p>
      </div>
    )
  }

  // ── 거절 ─────────────────────────────────────────────────────────────────────
  if (step === 'rejected' && selected) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-3xl p-8 text-center w-full max-w-xs space-y-3">
          <div className="text-5xl">❌</div>
          <p className="text-lg font-bold text-gray-900">{selected.name}</p>
          <p className="text-red-400 text-sm font-medium">출석 요청이 거절되었습니다.</p>
          <p className="text-gray-300 text-sm">선생님께 문의해주세요.</p>
        </div>
      </div>
    )
  }

  // ── 완료 화면 (done 또는 이미 출석) ──────────────────────────────────────────
  if ((step === 'done' || (step === 'confirm' && alreadyChecked)) && selected) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center pt-8 px-4 pb-10">
        <div className="w-full max-w-sm space-y-3">

          {/* 완료 헤더 */}
          <div className="bg-white rounded-3xl p-6 text-center space-y-1.5">
            <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-1">✅</div>
            <p className="text-xl font-bold text-gray-900">{selected.name}</p>
            {selected.grade && <p className="text-xs text-gray-400">{selected.grade}</p>}
            <p className="text-green-500 font-semibold text-sm">
              {step === 'confirm' ? '이미 출석 완료' : '출석 완료!'}
            </p>
          </div>

          {/* 출석 통계 */}
          {dataLoading ? (
            <div className="bg-white rounded-3xl py-8 text-center text-sm text-gray-300">불러오는 중...</div>
          ) : studentData && (
            <>
              <div className="bg-white rounded-3xl p-5 space-y-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">출석 현황</p>
                <div className="flex gap-3">
                  <div className="flex-1 bg-orange-50 rounded-2xl p-4 text-center">
                    <p className="text-2xl font-bold text-orange-500">{studentData.stats.streak}</p>
                    <p className="text-xs text-orange-400 mt-1">🔥 연속</p>
                  </div>
                  <div className="flex-1 bg-blue-50 rounded-2xl p-4 text-center">
                    <p className="text-2xl font-bold text-blue-500">{studentData.stats.total}</p>
                    <p className="text-xs text-blue-400 mt-1">✅ 누적</p>
                  </div>
                </div>
                {studentData.stats.stamps.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-300 mb-2.5">최근 {studentData.stats.stamps.length}주</p>
                    <div className="flex gap-1.5 flex-wrap">
                      {[...studentData.stats.stamps].reverse().map((present, i) => (
                        <div key={i} className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                          present ? 'bg-[#1e3a5f] text-white' : 'bg-gray-100 text-gray-300'
                        }`}>
                          {present ? '✓' : ''}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 역할 카드 */}
              {studentData.role && (
                <div className="bg-white rounded-3xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
                    <span className="text-sm">🔔</span>
                    <p className="text-sm font-semibold text-gray-900">이번 주 전례 담당</p>
                  </div>
                  <div className="p-5 space-y-3">
                    <div className={`rounded-2xl px-4 py-3 text-center text-sm font-semibold ${ROLE_COLOR[studentData.role]}`}>
                      {ROLE_LABEL[studentData.role]}
                    </div>
                    {studentData.role === 'narrator' && (
                      <p className="text-xs text-gray-400 text-center">미사 진행에 맞게 해설을 담당해 주세요.</p>
                    )}
                    {studentData.role !== 'narrator' && (
                      <div className="bg-gray-50 rounded-2xl overflow-hidden">
                        <p className="px-4 py-2.5 text-xs font-semibold text-gray-500 border-b border-gray-100">
                          📖 {studentData.roleContentLabel}
                        </p>
                        <p className="p-4 text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">
                          {studentData.roleContent ?? '아직 내용이 입력되지 않았습니다.'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 간식/행사 */}
              {(studentData.snack || (studentData.events && studentData.events.length > 0)) && (
                <div className="bg-white rounded-3xl p-5 space-y-3">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">이번 주 정보</p>
                  {studentData.snack && (
                    <div className="flex items-center gap-3 bg-yellow-50 rounded-2xl px-4 py-3">
                      <span>🍪</span>
                      <span className="text-sm text-gray-700">간식 <span className="font-semibold">{studentData.snack}</span></span>
                    </div>
                  )}
                  {studentData.events && studentData.events.length > 0 && (
                    <div className="bg-sky-50 rounded-2xl px-4 py-3 space-y-1.5">
                      <p className="text-xs font-semibold text-sky-500">📅 행사 일정</p>
                      {studentData.events.map((ev, i) => (
                        <p key={i} className="text-sm text-gray-600">• {ev}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          <button
            onClick={reset}
            className="w-full bg-white text-gray-400 rounded-3xl py-4 font-medium text-sm"
          >
            확인
          </button>
        </div>
      </div>
    )
  }

  // ── 기본 입력 흐름 ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#1e3a5f] flex flex-col items-center justify-start pt-12 px-4">
      <div className="w-full max-w-sm space-y-5">

        {/* 헤더 */}
        <div className="text-center space-y-1 mb-2">
          <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-3">✝️</div>
          <h1 className="text-white text-xl font-bold">학생 출석</h1>
          <p className="text-blue-300 text-sm">{weekId} 미사</p>
        </div>

        {/* 생년월일 입력 */}
        {step === 'input' && (
          <div className="bg-white rounded-3xl p-6 space-y-5">
            <div className="text-center space-y-1">
              <p className="text-sm font-semibold text-gray-900">생년월일 6자리</p>
              <p className="text-xs text-gray-400">예: 2013년 5월 15일 → 130515</p>
            </div>
            <input
              ref={inputRef}
              type="tel"
              maxLength={6}
              value={birthInput}
              onChange={e => { setBirthInput(e.target.value.replace(/\D/g, '')); setInputError('') }}
              onKeyDown={e => { if (e.key === 'Enter') void handleBirthSubmit() }}
              placeholder="YYMMDD"
              className={`w-full rounded-2xl px-4 py-5 text-center text-3xl tracking-widest font-mono focus:outline-none transition ${
                inputError ? 'bg-red-50 text-red-500' : 'bg-gray-50 text-gray-900 focus:bg-white'
              }`}
              autoFocus
            />
            {inputError && <p className="text-red-400 text-xs text-center">{inputError}</p>}
            <button
              onClick={() => void handleBirthSubmit()}
              disabled={birthInput.length !== 6}
              className="w-full bg-[#1e3a5f] text-white rounded-2xl py-4 font-semibold disabled:opacity-30 transition active:scale-[0.98]"
            >
              확인
            </button>
          </div>
        )}

        {/* 학생 선택 */}
        {step === 'select' && (
          <div className="bg-white rounded-3xl p-5 space-y-3">
            <p className="text-sm font-semibold text-gray-900 text-center">해당하는 학생을 선택하세요</p>
            {matches.map(s => (
              <button
                key={s.uid}
                onClick={() => { setSelected(s); setStep('confirm') }}
                className="w-full flex items-center justify-between px-4 py-4 bg-gray-50 hover:bg-gray-100 rounded-2xl transition"
              >
                <span className="font-semibold text-gray-900">{s.name}</span>
                <span className="text-xs text-gray-400">{s.grade}</span>
              </button>
            ))}
            <button onClick={reset} className="w-full text-sm text-gray-400 pt-1">← 다시 입력</button>
          </div>
        )}

        {/* 출석 확인 */}
        {step === 'confirm' && selected && !alreadyChecked && (
          <div className="bg-white rounded-3xl p-6 space-y-5">
            <div className="text-center space-y-1">
              <p className="text-2xl font-bold text-gray-900">{selected.name}</p>
              <p className="text-sm text-gray-400">{selected.grade}</p>
            </div>
            <button
              onClick={() => void handleRequestAttendance()}
              className="w-full bg-[#1e3a5f] text-white rounded-2xl py-4 font-semibold transition active:scale-[0.98]"
            >
              출석 요청
            </button>
            <button onClick={reset} className="w-full text-sm text-gray-400 bg-gray-50 rounded-2xl py-3">
              ← 다시 입력
            </button>
          </div>
        )}

        {/* 승인 대기 */}
        {step === 'waiting' && selected && (
          <div className="bg-white rounded-3xl p-8 text-center space-y-3">
            <div className="text-5xl animate-pulse">⏳</div>
            <p className="text-xl font-bold text-gray-900">{selected.name}</p>
            <p className="text-gray-400 text-sm">선생님 확인 중...</p>
          </div>
        )}

        {/* 출석 카운터 */}
        <p className="text-center text-blue-300/70 text-xs">
          오늘 출석 {presentCount}명 / {studentCount}명
        </p>
      </div>
    </div>
  )
}
