import { useEffect, useRef, useState } from 'react'
import {
  findKioskStudentsByBirthDate,
  getAttendance,
  getStudentCountPublic,
  getThisWeekId,
  getUserAttendanceHistory,
  onAttendanceRecord,
  onKioskSessionChange,
  onPendingRequestChange,
  submitPendingAttendance,
} from '../lib/firestore'
import type { KioskStudent } from '../types'

type Step = 'input' | 'select' | 'confirm' | 'waiting' | 'done' | 'rejected'

export default function AttendanceKioskPage() {
  const [kioskOpen, setKioskOpen] = useState<boolean | null>(null)
  const [studentCount, setStudentCount] = useState(0)
  const [attendance, setAttendance] = useState<Record<string, boolean>>({})
  const [birthInput, setBirthInput] = useState('')
  const [inputError, setInputError] = useState('')
  const [matches, setMatches] = useState<KioskStudent[]>([])
  const [selected, setSelected] = useState<KioskStudent | null>(null)
  const [step, setStep] = useState<Step>('input')
  const [doneStats, setDoneStats] = useState<{ total: number; streak: number } | null>(null)
  const weekId = getThisWeekId()
  const inputRef = useRef<HTMLInputElement>(null)

  function reset() {
    setSelected(null)
    setBirthInput('')
    setMatches([])
    setInputError('')
    setDoneStats(null)
    setStep('input')
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  useEffect(() => {
    const unsubscribe = onKioskSessionChange(session => setKioskOpen(session.isOpen))
    let cancelled = false

    void Promise.all([getStudentCountPublic(), getAttendance(weekId)]).then(([count, records]) => {
      if (cancelled) return

      setStudentCount(count)
      const map: Record<string, boolean> = {}
      records.forEach(record => {
        map[record.uid] = record.present
      })
      setAttendance(map)
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [weekId])

  useEffect(() => {
    if (step !== 'waiting' || !selected) return

    const unsubscribeAttendance = onAttendanceRecord(weekId, selected.uid, present => {
      if (present) {
        setStep('done')
      }
    })
    const unsubscribePending = onPendingRequestChange(weekId, selected.uid, request => {
      if (request?.status === 'rejected') {
        setStep('rejected')
        setTimeout(() => reset(), 3500)
      }
    })

    return () => {
      unsubscribeAttendance()
      unsubscribePending()
    }
  }, [step, selected, weekId])

  useEffect(() => {
    if (step !== 'done' || !selected) return

    void getUserAttendanceHistory(selected.uid).then(history => {
      const total = history.filter(week => week.present).length
      let streak = 0

      for (const week of history) {
        if (!week.present) break
        streak += 1
      }

      setDoneStats({ total, streak })
    })
  }, [step, selected])

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
        return
      }

      setStep('select')
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

  if (step === 'done' && selected) {
    return (
      <div className="min-h-screen bg-[#1e3a5f] flex flex-col items-center justify-center px-4">
        <div className="bg-white rounded-2xl p-8 text-center w-full max-w-xs space-y-4">
          <div className="text-6xl">✅</div>
          <div>
            <p className="text-2xl font-bold text-gray-800">{selected.name}</p>
            {selected.grade && <p className="text-sm text-gray-400 mt-0.5">{selected.grade}</p>}
          </div>
          <p className="text-green-600 font-semibold text-lg">출석 완료!</p>

          {doneStats && (
            <div className="flex gap-3 pt-1">
              <div className="flex-1 bg-orange-50 rounded-xl py-2.5 text-center">
                <div className="text-xl font-bold text-orange-500">{doneStats.streak}</div>
                <div className="text-xs text-orange-400">🔥 연속</div>
              </div>
              <div className="flex-1 bg-blue-50 rounded-xl py-2.5 text-center">
                <div className="text-xl font-bold text-blue-500">{doneStats.total}</div>
                <div className="text-xs text-blue-400">✅ 누적</div>
              </div>
            </div>
          )}

          <button
            onClick={reset}
            className="w-full mt-2 bg-[#1e3a5f] text-white rounded-xl py-3 font-semibold"
          >
            확인
          </button>
        </div>
      </div>
    )
  }

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

  return (
    <div className="min-h-screen bg-[#1e3a5f] flex flex-col items-center justify-start pt-10 px-4">
      <div className="w-full max-w-sm space-y-5">
        <div className="text-center">
          <div className="text-4xl mb-2">✝️</div>
          <h1 className="text-white text-xl font-bold">학생 출석</h1>
          <p className="text-blue-200 text-sm mt-1">{weekId} 미사</p>
        </div>

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
                  if (event.key === 'Enter') {
                    void handleBirthSubmit()
                  }
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

        {step === 'select' && (
          <div className="bg-white rounded-2xl p-5 space-y-3">
            <p className="text-sm font-medium text-gray-600 text-center">해당하는 학생을 선택하세요</p>
            {matches.map(student => (
              <button
                key={student.uid}
                onClick={() => {
                  setSelected(student)
                  setStep('confirm')
                }}
                className="w-full flex items-center justify-between px-4 py-4 border border-gray-200 rounded-xl hover:bg-blue-50 text-left transition"
              >
                <span className="font-bold text-gray-800 text-lg">{student.name}</span>
                <span className="text-xs text-gray-400 shrink-0">{student.grade}</span>
              </button>
            ))}
            <button onClick={reset} className="w-full text-sm text-gray-400 pt-1">
              ← 다시 입력
            </button>
          </div>
        )}

        {step === 'confirm' && selected && (
          <div className="bg-white rounded-2xl p-6 space-y-5">
            <div className="text-center space-y-1">
              <p className="text-3xl font-bold text-gray-800">{selected.name}</p>
              <p className="text-sm text-gray-400">{selected.grade}</p>
            </div>
            {alreadyChecked ? (
              <div className="bg-green-50 border border-green-200 rounded-xl py-4 text-center">
                <p className="text-green-600 font-semibold">이미 출석 완료되었습니다.</p>
              </div>
            ) : (
              <button
                onClick={() => void handleRequestAttendance()}
                className="w-full bg-[#1e3a5f] text-white rounded-xl py-4 text-lg font-bold transition hover:bg-[#16305a]"
              >
                출석 요청
              </button>
            )}
            <button onClick={reset} className="w-full text-sm text-gray-400 border border-gray-200 rounded-xl py-2.5">
              ← 다시 입력
            </button>
          </div>
        )}

        {step === 'waiting' && selected && (
          <div className="bg-white rounded-2xl p-8 space-y-4 text-center">
            <div className="text-5xl animate-pulse">⏳</div>
            <p className="text-2xl font-bold text-gray-800">{selected.name}</p>
            <p className="text-gray-600 font-medium mt-2">선생님 확인 중...</p>
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
