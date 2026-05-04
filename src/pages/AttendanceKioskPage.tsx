import { useEffect, useRef, useState } from 'react'
import { SAINTS_FEAST_DAYS } from '../lib/saints'
import {
  findKioskStudentsByBirthDate,
  getAssignment,
  getAttendance,
  getNotices,
  getStudentCountPublic,
  getThisWeekId,
  getUserAttendanceHistory,
  getWeekData,
  onAttendanceRecord,
  onKioskSessionChange,
  onPendingRequestChange,
  submitPendingAttendance,
} from '../lib/firestore'
import type { KioskStudent, LiturgyRole, Notice } from '../types'

function getTodayMMDD(): string {
  const today = new Date()
  return String(today.getMonth() + 1).padStart(2, '0') + String(today.getDate()).padStart(2, '0')
}

function getStudentFeastDayMMDD(student: KioskStudent): string | null {
  const normalize = (v?: string) => {
    if (!v) return null
    const d = v.replace(/\D/g, '')
    return d.length === 4 ? d : null
  }
  return normalize(student.feastDay) ?? normalize(SAINTS_FEAST_DAYS[student.baptismalName ?? ''])
}

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
  responsorialPsalm?: string | null
  snack?: string
  events?: string[]
}

interface SavedKioskStudent {
  uid: string
  name: string
  grade?: string
  birthDate?: string
}

const KIOSK_STORAGE_KEY = 'kioskLastStudent'

function loadSavedStudent(): SavedKioskStudent | null {
  try {
    const raw = localStorage.getItem(KIOSK_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as SavedKioskStudent) : null
  } catch { return null }
}

export default function AttendanceKioskPage() {
  const [kioskOpen, setKioskOpen] = useState<boolean | null>(null)
  const [weekId, setWeekId] = useState(getThisWeekId())
  const [studentCount, setStudentCount] = useState(0)
  const [attendance, setAttendance] = useState<Record<string, boolean>>({})
  const [notices, setNotices] = useState<Notice[]>([])
  const [birthInput, setBirthInput] = useState('')
  const [inputError, setInputError] = useState('')
  const [matches, setMatches] = useState<KioskStudent[]>([])
  const [selected, setSelected] = useState<KioskStudent | null>(null)
  const [step, setStep] = useState<Step>('input')
  const [studentData, setStudentData] = useState<StudentData | null>(null)
  const [dataLoading, setDataLoading] = useState(false)
  const [roleModalOpen, setRoleModalOpen] = useState(false)
  const [savedStudent, setSavedStudent] = useState<SavedKioskStudent | null>(() => loadSavedStudent())
  const [isSubmitting, setIsSubmitting] = useState(false)
  const prevWeekIdRef = useRef<string | null>(null)

  // /attend 진입 시 키오스크 전용 PWA manifest로 교체
  useEffect(() => {
    const el = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')
    const prev = el?.href ?? null
    if (el) el.href = '/attend-manifest.json'
    else {
      const link = document.createElement('link')
      link.rel = 'manifest'
      link.href = '/attend-manifest.json'
      document.head.appendChild(link)
    }
    return () => {
      const cur = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')
      if (cur) cur.href = prev ?? '/manifest.json'
    }
  }, [])
  const inputRef = useRef<HTMLInputElement>(null)

  function reset() {
    setSelected(null); setBirthInput(''); setMatches([])
    setInputError(''); setStudentData(null); setDataLoading(false)
    setStep('input')
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  // weekId가 바뀌면 진행 중인 출석 흐름 초기화 (잘못된 주차에 출석되는 것 방지)
  useEffect(() => {
    if (prevWeekIdRef.current !== null && prevWeekIdRef.current !== weekId) {
      setSelected(null); setBirthInput(''); setMatches([])
      setInputError(''); setStudentData(null); setDataLoading(false)
      setStep('input')
      setTimeout(() => inputRef.current?.focus(), 100)
    }
    prevWeekIdRef.current = weekId
  }, [weekId])

  // 키오스크 세션 구독 — weekId도 함께 갱신
  useEffect(() => {
    const unsubscribe = onKioskSessionChange(s => {
      setKioskOpen(s.isOpen)
      setWeekId(s.activeWeekId ?? getThisWeekId())
    })
    return () => unsubscribe()
  }, [])

  // weekId 변경 시 주차 데이터 로드
  useEffect(() => {
    let cancelled = false
    void Promise.all([getStudentCountPublic(), getAttendance(weekId), getNotices(5)]).then(([count, records, noticeList]) => {
      if (cancelled) return
      setStudentCount(count)
      const map: Record<string, boolean> = {}
      records.forEach(r => { map[r.uid] = r.present })
      setAttendance(map)
      setNotices(noticeList)
    })
    return () => { cancelled = true }
  }, [weekId])

  // 학생 확정 시 역할·통계 로드
  useEffect(() => {
    if (!selected) return
    let cancelled = false
    setDataLoading(true)
    void Promise.allSettled([
      getUserAttendanceHistory(selected.uid),
      getAssignment(weekId),
      getWeekData(weekId),
    ]).then(([historyResult, assignmentResult, weekDataResult]) => {
      if (cancelled) return

      const history = historyResult.status === 'fulfilled' ? historyResult.value : []
      const assignment = assignmentResult.status === 'fulfilled' ? assignmentResult.value : null
      const weekData = weekDataResult.status === 'fulfilled' ? weekDataResult.value : null

      const total = history.filter(w => w.present).length
      let streak = 0
      for (const w of history) { if (!w.present) break; streak++ }
      const stamps = history.slice(0, 10).map(w => w.present)

      let role: LiturgyRole = null
      let roleContent: string | null = null
      let roleContentLabel = ''
      let responsorialPsalm: string | null | undefined = undefined

      if (assignment) {
        if (assignment.narrator === selected.uid) {
          role = 'narrator'
        } else if (assignment.acolytes[0] === selected.uid) {
          role = 'acolyte_1'
          roleContent = weekData?.readings1 ?? null
          roleContentLabel = '제1독서'
          responsorialPsalm = weekData?.responsorialPsalm ?? null
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
      setStudentData({
        stats: { total, streak, stamps },
        role, roleContent, roleContentLabel,
        responsorialPsalm,
        snack: weekData?.snack,
        events: weekData?.events,
      })
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
    // 월(MM), 일(DD) 기본 유효성 검증
    const mm = parseInt(birthInput.slice(2, 4), 10)
    const dd = parseInt(birthInput.slice(4, 6), 10)
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) {
      setInputError('올바른 생년월일을 입력해주세요.')
      setBirthInput('')
      return
    }
    try {
      const found = await findKioskStudentsByBirthDate(birthInput)
      if (found.length === 0) { setInputError('일치하는 학생이 없습니다.'); setBirthInput(''); return }
      setMatches(found); setInputError('')
      if (found.length === 1) { setSelected(found[0]); setStep('confirm') }
      else { setStep('select') }
    } catch { setInputError('오류가 발생했습니다. 다시 시도해주세요.') }
  }

  const handleRequestAttendance = async () => {
    if (!selected || isSubmitting) return
    setIsSubmitting(true)
    try {
      await submitPendingAttendance(weekId, selected.uid)
      // localStorage에 마지막 학생 저장
      localStorage.setItem(KIOSK_STORAGE_KEY, JSON.stringify({
        uid: selected.uid,
        name: selected.name,
        grade: selected.grade,
        birthDate: selected.birthDate,
      }))
      setSavedStudent({ uid: selected.uid, name: selected.name, grade: selected.grade, birthDate: selected.birthDate })
      setStep('waiting')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleQuickLogin = (s: SavedKioskStudent) => {
    setSelected(s as KioskStudent)
    setStep('confirm')
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
    const todayMMDD = getTodayMMDD()
    const isBirthday = selected.birthDate ? selected.birthDate.slice(2, 6) === todayMMDD : false
    const isFeastDay = getStudentFeastDayMMDD(selected) === todayMMDD
    return (
      <>
      <div className="min-h-screen bg-gray-50 flex flex-col items-center pt-8 px-4 pb-10">
        <div className="w-full max-w-sm space-y-3">

          {/* 사원증 카드 */}
          <div className="flex flex-col items-center">
            <div className="w-8 h-8 rounded-full border-[3px] border-gray-300 bg-gray-100 -mb-4 z-10 relative shadow-inner" />

            <div className="w-full bg-white rounded-3xl overflow-hidden shadow-lg border border-gray-100">
              <div className="bg-[#1e3a5f] px-6 pt-8 pb-14 text-center relative overflow-hidden">
                <div className="absolute inset-0 flex items-center justify-center text-[120px] text-white/[0.04] select-none pointer-events-none leading-none">✝</div>
                <p className="text-blue-300/70 text-[9px] tracking-[0.3em] font-semibold uppercase relative z-10">Catholic Youth</p>
                <p className="text-white text-sm font-bold mt-0.5 relative z-10">보정성당 청소년부</p>
              </div>

              <div className="flex justify-center -mt-10 relative z-10 mb-3">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#162d4a] to-[#2d6aab] flex items-center justify-center text-white text-3xl font-bold shadow-lg ring-[3px] ring-white">
                  {selected.name[0]}
                </div>
              </div>

              <div className="text-center px-6 pb-5 space-y-1">
                <p className="text-[22px] font-bold text-gray-900 tracking-tight">{selected.name}</p>
                {selected.grade && <p className="text-xs text-gray-400">{selected.grade}</p>}
                <div className="pt-2 flex flex-col items-center gap-2">
                  <span className={`inline-flex items-center gap-1 px-5 py-[6px] rounded-full text-[11px] font-bold ${
                    step === 'confirm' ? 'bg-gray-100 text-gray-400' : 'bg-green-500 text-white'
                  }`}>
                    {step !== 'confirm' && '✓ '}
                    {step === 'confirm' ? '이미 출석 완료' : '출석 완료!'}
                  </span>
                  {isBirthday && (
                    <span className="inline-flex items-center gap-1.5 px-4 py-[5px] rounded-full text-[11px] font-bold bg-pink-50 text-pink-500">
                      🎂 생일 축하합니다!
                    </span>
                  )}
                  {isFeastDay && (
                    <span className="inline-flex items-center gap-1.5 px-4 py-[5px] rounded-full text-[11px] font-bold bg-amber-50 text-amber-500">
                      ✨ 축일 축하합니다!
                    </span>
                  )}
                </div>
              </div>

              <div className="mx-4 border-t border-dashed border-gray-200 py-3 flex items-center justify-between px-2">
                <span className="text-[10px] text-gray-300 font-mono tracking-wide">{weekId}</span>
                <div className="flex items-end gap-[2px]">
                  {[10, 7, 14, 5, 12, 8, 14, 6, 10, 5, 12].map((h, i) => (
                    <div key={i} style={{ height: `${h}px` }} className="w-[2px] bg-gray-200 rounded-full" />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 통계 + 역할 */}
          {dataLoading ? (
            <div className="bg-white rounded-3xl py-8 text-center text-sm text-gray-300">불러오는 중...</div>
          ) : studentData && (
            <>
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
                      <button
                        onClick={() => setRoleModalOpen(true)}
                        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 rounded-2xl text-sm transition active:scale-[0.98]"
                      >
                        <span className="font-medium text-gray-700">
                          📖 {studentData.role === 'acolyte_1' && studentData.responsorialPsalm !== undefined
                            ? '제1독서 · 화답송 보기'
                            : `${studentData.roleContentLabel} 보기`}
                        </span>
                        <span className="text-gray-400 text-lg">›</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

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

          {notices.length > 0 && (
            <div className="bg-white rounded-3xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
                <span className="text-sm">📢</span>
                <p className="text-sm font-semibold text-gray-900">알림장</p>
              </div>
              <div className="divide-y divide-gray-50">
                {notices.map(n => (
                  <div key={n.id} className="px-5 py-4 space-y-1">
                    <p className="text-sm font-semibold text-gray-900">{n.title}</p>
                    <p className="text-sm text-gray-500 whitespace-pre-wrap leading-relaxed">{n.body}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={reset}
            className="w-full bg-white text-gray-400 rounded-3xl py-4 font-medium text-sm"
          >
            확인
          </button>
        </div>
      </div>

      {/* 본문 모달 */}
      {roleModalOpen && studentData && studentData.role && studentData.role !== 'narrator' && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-white"
          onClick={() => setRoleModalOpen(false)}
        >
          <div className="bg-[#1e3a5f] px-5 py-4 flex items-center justify-between shrink-0">
            <div>
              <p className="text-blue-300/70 text-[9px] tracking-[0.2em] uppercase font-semibold">이번 주 전례 담당</p>
              <p className="text-white text-sm font-bold mt-0.5">
                {studentData.role === 'acolyte_1' && studentData.responsorialPsalm !== undefined
                  ? '제1독서 · 화답송'
                  : studentData.roleContentLabel}
              </p>
            </div>
            <button
              onClick={() => setRoleModalOpen(false)}
              className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white text-lg leading-none"
            >
              ×
            </button>
          </div>

          <div className="flex-1 overflow-y-auto" onClick={e => e.stopPropagation()}>
            {studentData.role === 'acolyte_1' ? (
              <>
                <div className="px-6 pt-6 pb-4 space-y-3">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">제1독서</p>
                  <p className="text-gray-700 text-base leading-8 whitespace-pre-wrap">
                    {studentData.roleContent ?? '아직 내용이 입력되지 않았습니다.'}
                  </p>
                </div>
                {studentData.responsorialPsalm !== undefined && (
                  <>
                    <div className="h-px bg-gray-100 mx-6" />
                    <div className="px-6 pt-4 pb-8 space-y-3">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">화답송</p>
                      <p className="text-gray-700 text-base leading-8 whitespace-pre-wrap">
                        {studentData.responsorialPsalm ?? '아직 내용이 입력되지 않았습니다.'}
                      </p>
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="px-6 py-6">
                <p className="text-gray-700 text-base leading-8 whitespace-pre-wrap">
                  {studentData.roleContent ?? '아직 내용이 입력되지 않았습니다.'}
                </p>
              </div>
            )}
          </div>

          <div className="px-5 py-4 shrink-0 border-t border-gray-100">
            <button
              onClick={() => setRoleModalOpen(false)}
              className="w-full bg-[#1e3a5f] text-white rounded-2xl py-4 font-semibold text-sm"
            >
              닫기
            </button>
          </div>
        </div>
      )}
      </>
    )
  }

  // ── 기본 입력 흐름 ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#1e3a5f] flex flex-col items-center justify-start pt-10 px-4 pb-10">
      <div className="w-full max-w-sm space-y-4">

        {/* 헤더 */}
        <div className="text-center space-y-2 mb-2">
          <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center text-2xl mx-auto border border-white/10">✝</div>
          <div>
            <h1 className="text-white text-lg font-bold">보정성당 청소년부</h1>
            <p className="text-blue-300/70 text-xs mt-0.5">{weekId} 미사 출석</p>
          </div>
        </div>

        {/* 생년월일 입력 */}
        {step === 'input' && (
          <div className="bg-white rounded-3xl overflow-hidden shadow-xl">
            <div className="bg-[#1e3a5f] px-5 py-3 flex items-center gap-2">
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-white/30" />
                <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
                <div className="w-1.5 h-1.5 rounded-full bg-white/10" />
              </div>
              <p className="text-white/50 text-[10px] font-mono tracking-[0.2em] ml-1">STUDENT ID</p>
            </div>

            <div className="p-6 space-y-5">
              <div className="flex justify-center">
                <div className="w-16 h-16 rounded-2xl bg-gray-100 border-2 border-dashed border-gray-200 flex items-center justify-center text-gray-300 text-2xl select-none">
                  ?
                </div>
              </div>

              <div className="text-center space-y-1">
                <p className="text-sm font-semibold text-gray-900">생년월일 6자리 입력</p>
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
                본인 확인
              </button>

              {/* 빠른 출석 */}
              {savedStudent && (
                <button
                  onClick={() => handleQuickLogin(savedStudent)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 rounded-2xl transition active:scale-[0.98]"
                >
                  <div className="text-left">
                    <p className="text-xs text-gray-400">이전 학생</p>
                    <p className="text-sm font-semibold text-gray-700">
                      {savedStudent.name}{savedStudent.grade ? ` · ${savedStudent.grade}` : ''}
                    </p>
                  </div>
                  <span className="text-[#1e3a5f] text-xs font-semibold">빠른 출석 →</span>
                </button>
              )}
            </div>

            <div className="border-t border-dashed border-gray-100 mx-5 mb-4 pt-3 flex justify-between items-center">
              <span className="text-[10px] text-gray-200 font-mono">{weekId}</span>
              <div className="flex gap-[2px] items-end">
                {[8, 12, 6, 14, 8, 10, 14, 6, 12, 8, 10].map((h, i) => (
                  <div key={i} style={{ height: `${h}px` }} className="w-[2px] bg-gray-100 rounded-full" />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 학생 선택 */}
        {step === 'select' && (
          <div className="bg-white rounded-3xl overflow-hidden shadow-xl">
            <div className="bg-[#1e3a5f] px-5 py-3 flex items-center gap-2">
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-white/30" />
                <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
                <div className="w-1.5 h-1.5 rounded-full bg-white/10" />
              </div>
              <p className="text-white/50 text-[10px] font-mono tracking-[0.2em] ml-1">SELECT PROFILE</p>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-sm font-semibold text-gray-900 text-center">해당하는 학생을 선택하세요</p>
              {matches.map(s => (
                <button
                  key={s.uid}
                  onClick={() => { setSelected(s); setStep('confirm') }}
                  className="w-full flex items-center gap-3 px-4 py-3.5 bg-gray-50 hover:bg-gray-100 rounded-2xl transition active:scale-[0.99]"
                >
                  <div className="w-9 h-9 rounded-xl bg-[#1e3a5f]/10 flex items-center justify-center text-[#1e3a5f] font-bold text-sm shrink-0">
                    {s.name[0]}
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-gray-900 text-sm">{s.name}</p>
                    {s.grade && <p className="text-xs text-gray-400">{s.grade}</p>}
                  </div>
                  <span className="ml-auto text-gray-300 text-lg">›</span>
                </button>
              ))}
              <button onClick={reset} className="w-full text-sm text-gray-400 pt-1">← 다시 입력</button>
            </div>
          </div>
        )}

        {/* 출석 확인 */}
        {step === 'confirm' && selected && !alreadyChecked && (
          <div className="bg-white rounded-3xl overflow-hidden shadow-xl">
            <div className="bg-[#1e3a5f] px-5 py-4 text-center relative overflow-hidden">
              <div className="absolute inset-0 flex items-center justify-center text-[80px] text-white/[0.04] select-none leading-none">✝</div>
              <p className="text-blue-300/70 text-[9px] tracking-[0.3em] font-semibold uppercase relative">Catholic Youth</p>
              <p className="text-white text-xs font-bold mt-0.5 relative">보정성당 청소년부</p>
            </div>

            <div className="flex justify-center -mt-6 relative z-10 mb-4">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#162d4a] to-[#2d6aab] flex items-center justify-center text-white text-xl font-bold shadow-md ring-2 ring-white">
                {selected.name[0]}
              </div>
            </div>

            <div className="text-center px-6 pb-6 space-y-4">
              <div>
                <p className="text-xl font-bold text-gray-900">{selected.name}</p>
                {selected.grade && <p className="text-xs text-gray-400 mt-0.5">{selected.grade}</p>}
                <p className="text-xs text-gray-300 mt-2">본인이 맞으신가요?</p>
              </div>
              <button
                onClick={() => void handleRequestAttendance()}
                disabled={isSubmitting}
                className="w-full bg-[#1e3a5f] text-white rounded-2xl py-4 font-semibold transition active:scale-[0.98] disabled:opacity-50"
              >
                {isSubmitting ? '요청 중...' : '출석 요청'}
              </button>
              <button onClick={reset} className="w-full text-sm text-gray-400 bg-gray-50 rounded-2xl py-3">
                ← 다시 입력
              </button>
            </div>
          </div>
        )}

        {/* 승인 대기 */}
        {step === 'waiting' && selected && (
          <div className="bg-white rounded-3xl overflow-hidden shadow-xl">
            <div className="bg-[#1e3a5f] px-5 py-4 text-center relative overflow-hidden">
              <div className="absolute inset-0 flex items-center justify-center text-[80px] text-white/[0.04] select-none leading-none">✝</div>
              <p className="text-blue-300/70 text-[9px] tracking-[0.3em] font-semibold uppercase relative">Catholic Youth</p>
              <p className="text-white text-xs font-bold mt-0.5 relative">보정성당 청소년부</p>
            </div>

            <div className="flex justify-center -mt-6 relative z-10 mb-4">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#162d4a] to-[#2d6aab] flex items-center justify-center text-white text-xl font-bold shadow-md ring-2 ring-white animate-pulse">
                {selected.name[0]}
              </div>
            </div>

            <div className="text-center px-6 pb-8">
              <p className="text-xl font-bold text-gray-900">{selected.name}</p>
              {selected.grade && <p className="text-xs text-gray-400 mt-0.5">{selected.grade}</p>}
              <div className="mt-4 flex items-center justify-center gap-2 text-gray-400 text-sm">
                <div className="w-4 h-4 border-2 border-gray-200 border-t-[#1e3a5f] rounded-full animate-spin" />
                선생님 확인 중...
              </div>
            </div>
          </div>
        )}

        {/* 출석 카운터 */}
        <p className="text-center text-blue-300/50 text-xs">
          오늘 출석 {presentCount}명 / {studentCount}명
        </p>
      </div>
    </div>
  )
}
