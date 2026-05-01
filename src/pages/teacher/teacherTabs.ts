export type TeacherTab = 'students' | 'attendance' | 'assignment' | 'liturgy' | 'notices'

export const teacherTabs: Array<{ tab: TeacherTab; label: string; icon: string }> = [
  { tab: 'students', label: '학생', icon: '👥' },
  { tab: 'attendance', label: '출석', icon: '📋' },
  { tab: 'assignment', label: '역할', icon: '✝️' },
  { tab: 'liturgy', label: '전례', icon: '📖' },
  { tab: 'notices', label: '알림장', icon: '📢' },
]

export function resolveTeacherTab(value: string | null | undefined): TeacherTab {
  switch (value) {
    case 'students':
    case 'attendance':
    case 'assignment':
    case 'liturgy':
    case 'notices':
      return value
    default:
      return 'students'
  }
}

export function getTeacherTabHref(tab: TeacherTab) {
  return `/teacher?tab=${tab}`
}
