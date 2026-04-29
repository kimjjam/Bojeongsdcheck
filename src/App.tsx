import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import Layout from './components/Layout'

const LoginPage = lazy(() => import('./pages/LoginPage'))
const StudentsPage = lazy(() => import('./pages/teacher/StudentsPage'))
const TeacherAttendancePage = lazy(() => import('./pages/teacher/AttendancePage'))
const AssignmentPage = lazy(() => import('./pages/teacher/AssignmentPage'))
const LiturgyPage = lazy(() => import('./pages/teacher/LiturgyPage'))
const TeacherNoticesPage = lazy(() => import('./pages/teacher/NoticesPage'))
const AttendanceKioskPage = lazy(() => import('./pages/AttendanceKioskPage'))
const NoticesBoardPage = lazy(() => import('./pages/NoticesBoardPage'))

function PageLoading() {
  return (
    <div className="min-h-screen bg-[#1e3a5f] flex items-center justify-center">
      <div className="text-white text-center"><div className="text-4xl mb-3">✝️</div><p>불러오는 중...</p></div>
    </div>
  )
}

export default function App() {
  const { user, loading, error, login, logout } = useAuth()

  if (loading) {
    return <PageLoading />
  }

  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoading />}>
        <Routes>
          {/* 로그인 없이 접근 가능 */}
          <Route path="/attend"  element={<AttendanceKioskPage />} />
          <Route path="/kiosk"   element={<Navigate to="/attend" replace />} />
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
                    <Route path="*" element={<Navigate to="/attend" replace />} />
                  )}
                </Routes>
              </Layout>
            )
          } />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
