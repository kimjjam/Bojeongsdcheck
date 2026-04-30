import { useState, type FormEvent } from 'react'

interface Props {
  onLogin: (email: string, password: string) => Promise<void>
  error: string | null
}

export default function LoginPage({ onLogin, error }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try { await onLogin(email, password) }
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-[#1e3a5f] flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">

        {/* 로고 */}
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">✝️</div>
          <h1 className="text-white text-2xl font-bold">보정성당 주일학교</h1>
          <p className="text-blue-300 text-sm mt-1.5">선생님 전용</p>
        </div>

        {/* 폼 */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-2">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-white/10 text-white placeholder:text-white/40 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:bg-white/20 transition"
              placeholder="이메일"
              required
              autoComplete="email"
            />
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-white/10 text-white placeholder:text-white/40 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:bg-white/20 transition"
              placeholder="비밀번호"
              required
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="bg-red-500/20 text-red-200 text-sm rounded-xl px-4 py-3 text-center">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-white text-[#1e3a5f] rounded-2xl py-4 font-bold text-base disabled:opacity-50 transition mt-2 active:scale-[0.98]"
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>

        <p className="text-white/30 text-xs text-center mt-6">
          계정이 없으면 관리자에게 문의하세요
        </p>
      </div>
    </div>
  )
}
