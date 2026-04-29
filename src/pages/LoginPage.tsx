import { useState, useRef, type FormEvent } from 'react'

interface Props {
  onLogin: (email: string, password: string) => Promise<void>
  onStudentLogin: (birthDate: string) => Promise<{ uid: string; name: string; grade?: string }[]>
  onSelectStudent: (uid: string) => Promise<void>
  error: string | null
}

type Tab = 'student' | 'teacher'

export default function LoginPage({ onLogin, onStudentLogin, onSelectStudent, error }: Props) {
  const [tab, setTab] = useState<Tab>('student')

  // 교사 로그인
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [teacherLoading, setTeacherLoading] = useState(false)

  // 학생 로그인
  const [birthInput, setBirthInput] = useState('')
  const [studentLoading, setStudentLoading] = useState(false)
  const [candidates, setCandidates] = useState<{ uid: string; name: string; grade?: string }[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  const handleTeacherSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setTeacherLoading(true)
    try { await onLogin(email, password) }
    finally { setTeacherLoading(false) }
  }

  const handleStudentSubmit = async () => {
    if (birthInput.length !== 6) return
    setStudentLoading(true)
    const list = await onStudentLogin(birthInput)
    setStudentLoading(false)
    if (list.length > 0) setCandidates(list)
  }

  const handleSelect = async (uid: string) => {
    await onSelectStudent(uid)
  }

  const resetStudent = () => {
    setCandidates([])
    setBirthInput('')
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  return (
    <div className="min-h-screen bg-[#1e3a5f] flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">

        {/* 헤더 */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">✝️</div>
          <h1 className="text-white text-2xl font-bold">보정성당 주일학교</h1>
          <p className="text-blue-200 text-sm mt-1">출석 및 전례 관리</p>
        </div>

        {/* 탭 */}
        <div className="flex bg-white/10 rounded-xl p-1 mb-4">
          <button
            onClick={() => { setTab('student'); setCandidates([]); setBirthInput('') }}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${
              tab === 'student' ? 'bg-white text-[#1e3a5f]' : 'text-white/70 hover:text-white'
            }`}
          >
            🙋 학생
          </button>
          <button
            onClick={() => setTab('teacher')}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${
              tab === 'teacher' ? 'bg-white text-[#1e3a5f]' : 'text-white/70 hover:text-white'
            }`}
          >
            👨‍🏫 선생님
          </button>
        </div>

        {/* 학생 로그인 */}
        {tab === 'student' && (
          <div className="bg-white rounded-2xl p-6 shadow-xl space-y-4">
            {candidates.length === 0 ? (
              <>
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-700">생년월일 6자리를 입력하세요</p>
                  <p className="text-xs text-gray-400 mt-0.5">예: 2013년 5월 15일 → 130515</p>
                </div>
                <input
                  ref={inputRef}
                  type="tel"
                  maxLength={6}
                  value={birthInput}
                  onChange={e => setBirthInput(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={e => e.key === 'Enter' && handleStudentSubmit()}
                  placeholder="YYMMDD"
                  autoFocus
                  className="w-full border-2 border-gray-200 focus:border-[#1e3a5f] rounded-xl px-4 py-4 text-center text-3xl tracking-widest font-mono focus:outline-none"
                />
                {error && (
                  <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2 text-center">{error}</p>
                )}
                <button
                  onClick={handleStudentSubmit}
                  disabled={birthInput.length !== 6 || studentLoading}
                  className="w-full bg-[#1e3a5f] text-white rounded-xl py-3.5 font-semibold disabled:opacity-40 transition"
                >
                  {studentLoading ? '확인 중...' : '입장하기'}
                </button>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-gray-700 text-center">해당하는 학생을 선택하세요</p>
                <div className="space-y-2">
                  {candidates.map(c => (
                    <button
                      key={c.uid}
                      onClick={() => handleSelect(c.uid)}
                      className="w-full flex items-center justify-between px-4 py-3.5 border border-gray-200 rounded-xl hover:bg-blue-50 hover:border-blue-300 transition"
                    >
                      <span className="font-bold text-gray-800">{c.name}</span>
                      <span className="text-xs text-gray-400">{c.grade}</span>
                    </button>
                  ))}
                </div>
                <button onClick={resetStudent} className="w-full text-sm text-gray-400 pt-1">
                  ← 다시 입력
                </button>
              </>
            )}
          </div>
        )}

        {/* 교사 로그인 */}
        {tab === 'teacher' && (
          <form onSubmit={handleTeacherSubmit} className="bg-white rounded-2xl p-6 shadow-xl space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
                placeholder="example@email.com"
                required
                autoComplete="email"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
                placeholder="비밀번호 입력"
                required
                autoComplete="current-password"
              />
            </div>
            {error && (
              <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}
            <button
              type="submit"
              disabled={teacherLoading}
              className="w-full bg-[#1e3a5f] text-white rounded-lg py-3 font-medium disabled:opacity-60 hover:bg-[#162d4a] transition"
            >
              {teacherLoading ? '로그인 중...' : '로그인'}
            </button>
          </form>
        )}

        <p className="text-blue-200 text-xs text-center mt-4">
          {tab === 'student' ? '생년월일이 등록되지 않았으면 선생님께 문의하세요' : '계정이 없으면 관리자에게 문의하세요'}
        </p>
      </div>
    </div>
  )
}
