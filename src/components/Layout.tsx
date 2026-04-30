import { Link, useLocation } from 'react-router-dom'
import type { AppUser } from '../types'

interface Props {
  user: AppUser
  onLogout: () => void
  children: React.ReactNode
}

const teacherNavItems = [
  { to: '/teacher/students',   label: '학생',   icon: '👥' },
  { to: '/teacher/attendance', label: '출석',   icon: '📋' },
  { to: '/teacher/assignment', label: '역할',   icon: '✝️' },
  { to: '/teacher/liturgy',    label: '전례',   icon: '📖' },
  { to: '/teacher/notices',    label: '알림장', icon: '📢' },
]

export default function Layout({ user, onLogout, children }: Props) {
  const location = useLocation()
  const navItems = user.role === 'teacher' ? teacherNavItems : []

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-lg mx-auto">
      {/* 헤더 */}
      <header className="bg-[#1e3a5f] px-5 py-4 flex items-center justify-between sticky top-0 z-10">
        <div>
          <p className="text-[11px] text-blue-300 font-medium tracking-wide">보정성당 주일학교</p>
          <p className="text-base font-bold text-white mt-0.5">{user.name}</p>
        </div>
        <button
          onClick={onLogout}
          className="text-xs text-white/50 hover:text-white/80 transition px-3 py-1.5 rounded-xl hover:bg-white/10"
        >
          로그아웃
        </button>
      </header>

      <main className="flex-1 overflow-auto pb-24">{children}</main>

      {/* 하단 탭 */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg bg-white border-t border-gray-100 flex">
        {navItems.map(item => {
          const active = location.pathname.startsWith(item.to)
          return (
            <Link
              key={item.to}
              to={item.to}
              className="flex-1 flex flex-col items-center py-2.5 gap-0.5 relative"
            >
              {/* 활성 인디케이터 */}
              {active && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-[#1e3a5f] rounded-full" />
              )}
              <span className="text-xl leading-none">{item.icon}</span>
              <span className={`text-[10px] font-medium transition ${active ? 'text-[#1e3a5f] font-semibold' : 'text-gray-400'}`}>
                {item.label}
              </span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
