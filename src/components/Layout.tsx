import { Link, useLocation } from 'react-router-dom'
import type { AppUser } from '../types'
import { getTeacherTabHref, resolveTeacherTab, teacherTabs } from '../pages/teacher/teacherTabs'

interface Props {
  user: AppUser
  onLogout: () => void
  children: React.ReactNode
}

export default function Layout({ user, onLogout, children }: Props) {
  const location = useLocation()
  const navItems = user.role === 'teacher'
    ? teacherTabs.map(item => ({ ...item, to: getTeacherTabHref(item.tab) }))
    : []
  const currentTeacherTab = resolveTeacherTab(
    new URLSearchParams(location.search).get('tab')
    ?? location.pathname.split('/')[2]
  )

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside className="hidden md:flex flex-col w-56 shrink-0 bg-[#1e3a5f] min-h-screen sticky top-0 h-screen">
        <div className="px-6 py-7 border-b border-white/10">
          <p className="text-[11px] text-blue-300 font-medium tracking-wide">보정성당 주일학교</p>
          <p className="text-white font-bold text-base mt-0.5">{user.name}</p>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(item => {
            const active = location.pathname.startsWith('/teacher') && currentTeacherTab === item.tab
            return (
              <Link
                key={item.tab}
                to={item.to}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition ${
                  active
                    ? 'bg-white/15 text-white'
                    : 'text-blue-200 hover:bg-white/8 hover:text-white'
                }`}
              >
                <span className="text-base leading-none">{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="px-6 py-5 border-t border-white/10">
          <button
            onClick={onLogout}
            className="text-xs text-white/40 hover:text-white/70 transition"
          >
            로그아웃
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden bg-[#1e3a5f] px-5 py-4 flex items-center justify-between sticky top-0 z-10">
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

        <main className="flex-1 overflow-auto pb-24 md:pb-0">
          <div className="max-w-4xl mx-auto">
            {children}
          </div>
        </main>

        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex z-10">
          {navItems.map(item => {
            const active = location.pathname.startsWith('/teacher') && currentTeacherTab === item.tab
            return (
              <Link
                key={item.tab}
                to={item.to}
                className="flex-1 flex flex-col items-center py-2.5 gap-0.5 relative"
              >
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
    </div>
  )
}
