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
  acolyte_1:      '복사 (제1독서)',
  acolyte_2:      '복사 (제2독서)',
  intercession_1: '보편지향기도 1번',
  intercession_2: '보편지향기도 2번',
  intercession_3: '보편지향기도 3번',
  intercession_4: '보편지향기도 4번',
}

const ROLE_COLOR: Record<NonNullable<LiturgyRole>, string> = {
  narrator:       'bg-purple-100 text-purple-700 border-purple-200',
  acolyte_1:      'bg-blue-100 text-blue-700 border-blue-200',
  acolyte_2:      'bg-blue-100 text-blue-700 border-blue-200',
  intercession_1: 'bg-amber-100 text-amber-700 border-amber-200',
  intercession_2: 'bg-amber-100 text-amber-700 border-amber-200',
  intercession_3: 'bg-amber-100 text-amber-700 border-amber-200',
  intercession_4: 'bg-amber-100 text-amber-700 border-amber-200',
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
    setSelected(null)
    setBirthInput('')
    setMatches([])
    setInputError('')
    setStudentData(null)
    setDataLoading(false)
    setStep('input')
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  // 키오스크 세션 + 출석 현황 초기화
  useEffect(() => {
    const unsubscribe = onKioskSessionChange(session => setKioskOpen(session.isOpen))
    let cancelled = false

    void Promise.all([getStudentCountPublic(), getAttendance(weekId)]).then(([count, records]) => {
      if (cancelled) return
      setStudentCount(count)
      const map: Record<string, boolean> = {}
      records.forEach(record => { map[record.uid] = record.present })
      setAttendance(map)
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [weekId])

  // 학생 확정 시 역할·통계·주차 정보 미리 로드
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
      for (const w of history) {
        if (!w.present) break
        streak++
      }
      const stamps = history.slice(0, 10).map(w => w.present)

      let role: LiturgyRole = null
      let roleContent: string | null = null
      let roleContentLabel = ''

      if (assignment) {
        if (assignment.narrator === selected.uid) {
          role = 'narrator'
        } else if (assignment.acolytes[0] === selected.uid) {
          role = 'acolyte_1'
          roleContent = weekData?.readings1 ?? null
          roleContentLabel = '제1독서'
        } else if (assignment.acolytes[1] === selected.uid) {
          role = 'acolyte_2'
          roleContent = weekData?.readings2 ?? null
          roleContentLabel = '제2독서'
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

      setStudentData({
        stats: { total, streak, stamps },
        role,
        roleContent,
        roleContentLabel,
        snack: weekData?.snack,
        events: weekData?.events,
      })
      setDataLoading(false)
    })

    return () => { cancelled = true }
  }, [selected, weekId])

  // 승인/거절 실시간 감지
  useEffect(() => {
    if (step !== 'waiting' || !selected) return

    const unsubscribeAttendance = onAttendanceRecord(weekId, selected.uid, present => {
      if (present) setStep('done')
    })
    const unsubscribePending = onPendingRequestChange(weekId, selected.uid, request => {
      if (request?.status === 'rejected') {
        setStep('rejected')
        setTimeout(reset, 3500)
      }
    })

    return () => {
      unsubscribeAttendance()
      unsubscribePending()
    }
  }, [step, selected, weekId])

  const handleBirthSubmit = async () => {
    if (birthInput.length !== 6) return
    try {
      const found = await findKioskStudentsByBirthDate(birthInput)
      if (found.length === 0) {
        setInputError('일치하는 학생이 없습니다. 다시 확인해주세요.')
        setBirthInput('')
        return
      }
      setMatches(found)
      setInputError('')
      if (found.length === 1) {
        setSelected(found[0])
        setStep('confirm')
      } else {
        setStep('select')
      }
    } catch {
      setInputError('학생 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.')
    }
  }

  const handleRequestAttendance = async () => {
    if (!selected) return
    await submitPendingAttendance(weekId, selected.uid)
    setStep('waiting')
  }

  const alreadyChecked = selected ? attendance[selected.uid] === true : false
  const presentCount = Object.values(attendance).filter(Boolean).length

  // ── 로딩 중 ───────────────────────────────────────────────────────────────────
  if (kioskOpen === null) {
    return (
      <div className="min-h-screen bg-[#1e3a5f] flex items-center justify-center">
        <div className="text-white text-center">
          <div className="text-3xl mb-2">✝️</div>
          <p>불러오는 중...</p>
        </div>
      </div>
    )
  }

  // ── 닫힘 ──────────────────────────────────────────────────────────────────────
  if (!kioskOpen) {
    return (
      <div className="min-h-screen bg-[#1e3a5f] flex flex-col items-center justify-center px-6 text-center">
        <div className="text-5xl mb-4">📵</div>
        <h1 className="text-white text-xl font-bold">학생 출석이 아직 열리지 않았습니다</h1>
        <p className="text-blue-200 text-sm mt-2">선생님이 출석 링크를 열면 이 화면이 바뀝니다</p>
        <p className="text-blue-300 text-xs mt-4">{weekId}</p>
      </div>
    )
  }

  // ── 거절 ──────────────────────────────────────────────────────────────────────
  if (step === 'rejected' && selected) {
    return (
      <div className="min-h-screen bg-[#1e3a5f] flex flex-col items-center justify-center">
        <div className="bg-white rounded-2xl p-8 text-center w-72 space-y-3">
          <div className="text-5xl">❌</div>
          <p className="text-xl font-bold text-gray-800">{selected.name}</p>
          <p className="text-red-500 font-medium">출석 요청이 거절되었습니다.</p>
          <p className="text-gray-400 text-sm">선생님께 문의해주세요.</p>
        </div>
      </div>
    )
  }

  // ── 완료 화면 (done 또는 이미 출석한 confirm) ─────────────────────────────────
  if ((step === 'done' || (step === 'confirm' && alreadyChecked)) && selected) {
    return (
      <div className="min-h-screen bg-[#1e3a5f] flex flex-col items-center justify-start pt-8 px-4 pb-10">
        <div className="w-full max-w-sm space-y-4">

          {/* 출석 완료 헤더 */}
          <div className="bg-white rounded-2xl p-6 text-center space-y-1">
            <div className="text-5xl mb-2">✅</div>
            <p className="text-2xl font-bold text-gray-800">{selected.name}</p>
            {selected.grade && <p className="text-sm text-gray-400">{selected.grade}</p>}
            <p className="text-green-600 font-semibold mt-1">
              {step === 'confirm' ? '이미 출석 완료되었습니다.' : '출석 완료!'}
            </p>
          </div>

          {/* 출석 통계 */}
          {dataLoading ? (
            <div className="bg-white rounded-2xl p-6 text-center text-gray-400 text-sm">
              불러오는 중...
            </div>
          ) : studentData && (
            <>
              <div className="bg-white rounded-2xl p-4 space-y-3">
                <p className="text-sm font-semibold text-gray-700">출석 현황</p>
                <div className="flex gap-3">
                  <div className="flex-1 bg-orange-50 rounded-xl p-3 text-center">
                    <div className="text-2xl font-bold text-orange-500">{studentData.stats.streak}</div>
                    <div className="text-xs text-orange-400 mt-0.5">🔥 연속 출석</div>
                  </div>
                  <div className="flex-1 bg-blue-50 rounded-xl p-3 text-center">
                    <div className="text-2xl font-bold text-blue-500">{studentData.stats.total}</div>
                    <div className="text-xs text-blue-400 mt-0.5">✅ 총 출석</div>
                  </div>
                </div>
                {studentData.stats.stamps.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-400 mb-2">최근 {studentData.stats.stamps.length}주 출석 스탬프</p>
                    <div className="flex gap-1.5 flex-wrap">
                      {[...studentData.stats.stamps].reverse().map((present, i) => (
                        <div
                          key={i}
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                            present
                              ? 'bg-[#1e3a5f] border-[#1e3a5f] text-white'
                              : 'bg-white border-gray-200 text-gray-300'
                          }`}
                        >
                          {present ? '✓' : ''}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 역할 카드 */}
              {studentData.role && (
                <div className="bg-white rounded-2xl overflow-hidden">
                  <div className="bg-amber-400 px-4 py-2.5">
                    <p className="text-white text-sm font-bold">🔔 이번 주 전례 담당입니다!</p>
                  </div>
                  <div className="p-4 space-y-3">
                    <div className={`rounded-xl px-4 py-2.5 text-center border font-bold text-base ${ROLE_COLOR[studentData.role]}`}>
                      {ROLE_LABEL[studentData.role]}
                    </div>
                    {studentData.role === 'narrator' && (
                      <p className="text-sm text-gray-400 text-center">미사 진행에 맞게 해설을 담당해 주세요.</p>
                    )}
                    {studentData.role !== 'narrator' && (
                      <div className="bg-gray-50 rounded-xl overflow-hidden">
                        <div className="bg-[#1e3a5f] text-white px-4 py-2 text-xs font-semibold">
                          📖 {studentData.roleContentLabel}
                        </div>
                        <p className="p-4 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                          {studentData.roleContent
                            ? studentData.roleContent
                            : '아직 내용이 입력되지 않았습니다. 교사에게 문의하세요.'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 간식/행사 */}
              {(studentData.snack || (studentData.events && studentData.events.length > 0)) && (
                <div className="bg-white rounded-2xl p-4 space-y-2">
                  <p className="text-sm font-semibold text-gray-700">이번 주 정보</p>
                  {studentData.snack && (
                    <div className="flex items-center gap-2 text-sm text-gray-600 bg-yellow-50 rounded-lg px-3 py-2">
                      <span>🍪</span>
                      <span>간식: <span className="font-medium">{studentData.snack}</span></span>
                    </div>
                  )}
                  {studentData.events && studentData.events.length > 0 && (
                    <div className="bg-sky-50 rounded-lg px-3 py-2 space-y-1">
                      <div className="flex items-center gap-1 text-xs text-sky-500 font-medium mb-1">
                        <span>📅</span><span>행사 일정</span>
                      </div>
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
            className="w-full bg-white/10 text-white rounded-xl py-3 font-semibold"
          >
            확인
          </button>
        </div>
      </div>
    )
  }

  // ── 기본 입력 흐름 ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#1e3a5f] flex flex-col items-center justify-start pt-10 px-4">
      <div className="w-full max-w-sm space-y-5">
        <div className="text-center">
          <div className="text-4xl mb-2">✝️</div>
          <h1 className="text-white text-xl font-bold">학생 출석</h1>
          <p className="text-blue-200 text-sm mt-1">{weekId} 미사</p>
        </div>

        {/* 생년월일 입력 */}
        {step === 'input' && (
          <div className="bg-white rounded-2xl p-5 space-y-4">
            <div>
              <p className="text-sm font-medium text-gray-700 text-center mb-1">생년월일 6자리를 입력하세요</p>
              <p className="text-xs text-gray-400 text-center mb-3">예: 2013년 5월 15일 → 130515</p>
              <input
                ref={inputRef}
                type="tel"
                maxLength={6}
                value={birthInput}
                onChange={event => {
                  setBirthInput(event.target.value.replace(/\D/g, ''))
                  setInputError('')
                }}
                onKeyDown={event => {
                  if (event.key === 'Enter') void handleBirthSubmit()
                }}
                placeholder="YYMMDD"
                className={`w-full border-2 rounded-xl px-4 py-4 text-center text-3xl tracking-widest font-mono ${
                  inputError ? 'border-red-400 bg-red-50' : 'border-gray-200 focus:border-[#1e3a5f]'
                } focus:outline-none`}
                autoFocus
              />
              {inputError && <p className="text-red-500 text-sm text-center mt-2">{inputError}</p>}
            </div>
            <button
              onClick={() => void handleBirthSubmit()}
              disabled={birthInput.length !== 6}
              className="w-full bg-[#1e3a5f] text-white rounded-xl py-4 font-bold text-lg disabled:opacity-40 transition"
            >
              확인
            </button>
          </div>
        )}

        {/* 동명이인 선택 */}
        {step === 'select' && (
          <div className="bg-white rounded-2xl p-5 space-y-3">
            <p className="text-sm font-medium text-gray-600 text-center">해당하는 학생을 선택하세요</p>
            {matches.map(student => (
              <button
                key={student.uid}
                onClick={() => { setSelected(student); setStep('confirm') }}
                className="w-full flex items-center justify-between px-4 py-4 border border-gray-200 rounded-xl hover:bg-blue-50 text-left transition"
              >
                <span className="font-bold text-gray-800 text-lg">{student.name}</span>
                <span className="text-xs text-gray-400 shrink-0">{student.grade}</span>
              </button>
            ))}
            <button onClick={reset} className="w-full text-sm text-gray-400 pt-1">← 다시 입력</button>
          </div>
        )}

        {/* 출석 요청 확인 */}
        {step === 'confirm' && selected && !alreadyChecked && (
          <div className="bg-white rounded-2xl p-6 space-y-5">
            <div className="text-center space-y-1">
              <p className="text-3xl font-bold text-gray-800">{selected.name}</p>
              <p className="text-sm text-gray-400">{selected.grade}</p>
            </div>
            <button
              onClick={() => void handleRequestAttendance()}
              className="w-full bg-[#1e3a5f] text-white rounded-xl py-4 text-lg font-bold transition hover:bg-[#16305a]"
            >
              출석 요청
            </button>
            <button onClick={reset} className="w-full text-sm text-gray-400 border border-gray-200 rounded-xl py-2.5">
              ← 다시 입력
            </button>
          </div>
        )}

        {/* 승인 대기 */}
        {step === 'waiting' && selected && (
          <div className="bg-white rounded-2xl p-8 space-y-4 text-center">
            <div className="text-5xl animate-pulse">⏳</div>
            <p className="text-2xl font-bold text-gray-800">{selected.name}</p>
            <p className="text-gray-600 font-medium">선생님 확인 중...</p>
            <p className="text-gray-400 text-sm">잠시 기다려주세요</p>
          </div>
        )}

        <div className="text-center text-blue-200 text-sm">
          오늘 출석: {presentCount}명 / {studentCount}명
        </div>
      </div>
    </div>
  )
}
