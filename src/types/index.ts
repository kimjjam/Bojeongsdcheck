export type UserRole = 'teacher' | 'student'
export type StudentGroup = '전례부' | '성가대' | '반주단'

export interface AppUser {
  uid: string
  email: string
  name: string
  baptismalName?: string
  role: UserRole
  grade?: string
  groups?: StudentGroup[]
  birthDate?: string // "YYMMDD" 6자리 (예: "130515")
  phone?: string
  feastDay?: string // "MM.DD" 형식 (예: "07.25")
}

export interface KioskStudent {
  uid: string
  name: string
  grade?: string
  birthDate?: string
  feastDay?: string
  baptismalName?: string
}

export interface WeekData {
  id: string
  readings1: string  // 제1독서
  responsorialPsalm?: string  // 화답송 (제1독서 후)
  readings2: string  // 제2독서
  intercessions: {
    1: string
    2: string
    3: string
    4: string
  }
  snack?: string
  events?: string[]
}

export interface Assignment {
  weekId: string
  narrator: string        // uid
  acolytes: string[]      // [uid(제1독서), uid(제2독서)]
  intercessions: {
    1: string
    2: string
    3: string
    4: string
  }
}

export interface AttendanceRecord {
  uid: string
  present: boolean
  timestamp: Date | null
}

export interface Notice {
  id: string
  title: string
  body: string
  createdAt: Date
}

export interface KioskSession {
  isOpen: boolean
  openedAt: Date | null
  activeWeekId?: string
}

export interface PendingRequest {
  uid: string
  requestedAt: Date
  status: 'pending' | 'rejected'
}

export type LiturgyRole =
  | 'narrator'
  | 'acolyte_1'
  | 'acolyte_2'
  | 'intercession_1'
  | 'intercession_2'
  | 'intercession_3'
  | 'intercession_4'
  | null
