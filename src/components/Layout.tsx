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

const studentNavItems = [
  { to: '/student/my-role', label: '내 역할', icon: '✝️' },
  { to: '/notices',         label: '알림장', icon: '📢' },
]

export default function Layout({ user, onLogout, children }: Props) {
  const location = useLocation()
  const navItems = user.role === 'teacher' ? teacherNavItems : studentNavItems

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-lg mx-auto">
      <header className="bg-[#1e3a5f] text-white px-4 py-3 flex items-center justify-between sticky top-0 z-10 shadow">
        <div>
          <div className="font-bold text-sm">보정성당 주일학교</div>
          <div className="text-xs text-blue-200">{user.name} {user.role === 'teacher' ? '(교사)' : user.grade ?? ''}</div>
        </div>
        <button onClick={onLogout} className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1 rounded-full transition">로그아웃</button>
      </header>

      <main className="flex-1 overflow-auto pb-20">{children}</main>

      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg bg-white border-t border-gray-200 flex shadow-lg">
        {navItems.map(item => {
          const active = location.pathname.startsWith(item.to)
          return (
            <Link key={item.to} to={item.to}
              className={`flex-1 flex flex-col items-center py-2 text-xs transition ${active ? 'text-[#1e3a5f] font-semibold' : 'text-gray-500'}`}>
              <span className="text-xl mb-0.5">{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
