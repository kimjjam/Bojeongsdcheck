import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import Layout from './components/Layout'

const LoginPage = lazy(() => import('./pages/LoginPage'))
const TeacherPage = lazy(() => import('./pages/teacher/TeacherPage'))
const AttendanceKioskPage = lazy(() => import('./pages/AttendanceKioskPage'))

function PageLoading() {
  return (
    <div className="min-h-screen bg-[#1e3a5f] flex items-center justify-center">
      <div className="text-white text-center"><div className="text-4xl mb-3">✝️</div><p>불러오는 중..</p></div>
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
          <Route path="/attend" element={<AttendanceKioskPage />} />

          <Route
            path="*"
            element={
              !user ? (
                <LoginPage onLogin={login} error={error} />
              ) : (
                <Layout user={user} onLogout={logout}>
                  <Routes>
                    {user.role === 'teacher' ? (
                      <>
                        <Route path="/teacher" element={<TeacherPage />} />
                        <Route path="/teacher/:tab" element={<TeacherPage />} />
                        <Route path="*" element={<Navigate to="/teacher?tab=students" replace />} />
                      </>
                    ) : (
                      <Route path="*" element={<Navigate to="/attend" replace />} />
                    )}
                  </Routes>
                </Layout>
              )
            }
          />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
