import type { ReactElement } from 'react'
import { Navigate, useParams, useSearchParams } from 'react-router-dom'
import StudentsPage from './StudentsPage'
import TeacherAttendancePage from './AttendancePage'
import AssignmentPage from './AssignmentPage'
import LiturgyPage from './LiturgyPage'
import TeacherNoticesPage from './NoticesPage'
import { getTeacherTabHref, resolveTeacherTab, type TeacherTab } from './teacherTabs'

const teacherTabPages: Record<TeacherTab, ReactElement> = {
  students: <StudentsPage />,
  attendance: <TeacherAttendancePage />,
  assignment: <AssignmentPage />,
  liturgy: <LiturgyPage />,
  notices: <TeacherNoticesPage />,
}

export default function TeacherPage() {
  const { tab: legacyTab } = useParams()
  const [searchParams] = useSearchParams()

  const queryTab = searchParams.get('tab')
  const activeTab = resolveTeacherTab(queryTab ?? legacyTab)
  const isCanonical = !legacyTab && queryTab === activeTab

  if (!isCanonical) {
    return <Navigate to={getTeacherTabHref(activeTab)} replace />
  }

  return teacherTabPages[activeTab]
}
