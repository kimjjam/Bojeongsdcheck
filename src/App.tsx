import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import StudentsPage from './pages/teacher/StudentsPage'
import TeacherAttendancePage from './pages/teacher/AttendancePage'
import AssignmentPage from './pages/teacher/AssignmentPage'
import LiturgyPage from './pages/teacher/LiturgyPage'
import TeacherNoticesPage from './pages/teacher/NoticesPage'
import MyRolePage from './pages/student/MyRolePage'
import AttendanceKioskPage from './pages/AttendanceKioskPage'
import NoticesBoardPage from './pages/NoticesBoardPage'

export default function App() {
  const { user, loading, error, login, logout } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1e3a5f] flex items-center justify-center">
        <div className="text-white text-center"><div className="text-4xl mb-3">✝️</div><p>불러오는 중...</p></div>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* 로그인 없이 접근 가능 */}
        <Route path="/kiosk"   element={<AttendanceKioskPage />} />
        <Route path="/notices" element={<NoticesBoardPage />} />

        {/* 인증 필요 */}
        <Route path="*" element={
          !user ? (
            <LoginPage onLogin={login} error={error} />
          ) : (
            <Layout user={user} onLogout={logout}>
              <Routes>
                {user.role === 'teacher' ? (
                  <>
                    <Route path="/teacher/students"   element={<StudentsPage />} />
                    <Route path="/teacher/attendance" element={<TeacherAttendancePage />} />
                    <Route path="/teacher/assignment" element={<AssignmentPage />} />
                    <Route path="/teacher/liturgy"    element={<LiturgyPage />} />
                    <Route path="/teacher/notices"    element={<TeacherNoticesPage />} />
                    <Route path="*" element={<Navigate to="/teacher/students" replace />} />
                  </>
                ) : (
                  <>
                    <Route path="/student/my-role" element={<MyRolePage user={user} />} />
                    <Route path="*" element={<Navigate to="/student/my-role" replace />} />
                  </>
                )}
              </Routes>
            </Layout>
          )
        } />
      </Routes>
    </BrowserRouter>
  )
}
