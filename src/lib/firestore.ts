import {
  collection, doc, documentId, getDoc, getDocs, setDoc, updateDoc,
  deleteDoc, serverTimestamp, Timestamp, onSnapshot,
  query, orderBy, limit, where, getCountFromServer
} from 'firebase/firestore'
import { db } from './firebase'
import type {
  AppUser,
  WeekData,
  Assignment,
  AttendanceRecord,
  Notice,
  KioskSession,
  PendingRequest,
  KioskStudent,
  StudentGroup,
} from '../types'
import { SAINTS_FEAST_DAYS } from './saints'

// ─── 정렬 헬퍼 ────────────────────────────────────────────────────────────────
const GRADE_ORDER = ['중1', '중2', '중3', '고1', '고2', '고3']
function sortUsers(users: AppUser[]) {
  return users.sort((a, b) => {
    const gi = GRADE_ORDER.indexOf(a.grade ?? '') - GRADE_ORDER.indexOf(b.grade ?? '')
    return gi !== 0 ? gi : a.name.localeCompare(b.name, 'ko')
  })
}

function toAppUser(uid: string, data: Record<string, unknown>): AppUser {
  const groups = Array.isArray(data.groups)
    ? data.groups.filter((value): value is StudentGroup =>
      value === '전례부' || value === '성가대' || value === '반주단'
    )
    : undefined

  return {
    uid,
    email: typeof data.email === 'string' ? data.email : '',
    name: typeof data.name === 'string' ? data.name : '',
    baptismalName: typeof data.baptismalName === 'string' ? data.baptismalName : undefined,
    role: data.role === 'teacher' ? 'teacher' : 'student',
    grade: typeof data.grade === 'string' ? data.grade : undefined,
    groups,
    birthDate: typeof data.birthDate === 'string' ? data.birthDate : undefined,
    phone: typeof data.phone === 'string' ? data.phone : undefined,
    feastDay: typeof data.feastDay === 'string' ? data.feastDay : undefined,
  }
}

function normalizeAssignmentData(weekId: string, data: Record<string, unknown>): Assignment {
  const acolytes = Array.isArray(data.acolytes)
    ? data.acolytes.filter((value): value is string => typeof value === 'string').slice(0, 2)
    : []

  while (acolytes.length < 2) {
    acolytes.push('')
  }

  const rawIntercessions = typeof data.intercessions === 'object' && data.intercessions !== null
    ? data.intercessions as Record<string, unknown>
    : {}

  return {
    weekId,
    narrator: typeof data.narrator === 'string' ? data.narrator : '',
    acolytes,
    intercessions: {
      1: typeof rawIntercessions['1'] === 'string' ? rawIntercessions['1'] : '',
      2: typeof rawIntercessions['2'] === 'string' ? rawIntercessions['2'] : '',
      3: typeof rawIntercessions['3'] === 'string' ? rawIntercessions['3'] : '',
      4: typeof rawIntercessions['4'] === 'string' ? rawIntercessions['4'] : '',
    },
  }
}

function formatLocalDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function normalizeFeastDay(value?: string) {
  if (!value) return null
  const digits = value.replace(/\D/g, '')
  return digits.length === 4 ? digits : null
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function getAllUsers(): Promise<AppUser[]> {
  const snap = await getDocs(collection(db, 'users'))
  return sortUsers(snap.docs.map(d => toAppUser(d.id, d.data())))
}

/** 학생 등록 (Firebase Auth 없이 Firestore 문서만 생성) */
export async function createStudent(
  name: string,
  baptismalName: string,
  grade: string,
  groups: string[],
  birthDate: string,  // "YYMMDD" 6자리
  feastDay?: string   // "MM.DD" 형식
) {
  const uid = `student_${grade}_${name}_${Date.now()}`
  await setDoc(doc(db, 'users', uid), {
    email: '',
    name, baptismalName, grade, groups, birthDate,
    ...(feastDay ? { feastDay } : {}),
    role: 'student',
  })
  return uid
}

export async function updateUser(uid: string, data: Partial<AppUser>) {
  await updateDoc(doc(db, 'users', uid), data as Record<string, unknown>)
}

export async function deleteUser(uid: string) {
  await deleteDoc(doc(db, 'users', uid))
}

export async function getStudentByUid(uid: string): Promise<AppUser | null> {
  const snap = await getDoc(doc(db, 'users', uid))
  if (!snap.exists()) return null
  return toAppUser(snap.id, snap.data())
}

export async function getStudentCountPublic(): Promise<number> {
  const studentsQuery = query(collection(db, 'users'), where('role', '==', 'student'))
  const countSnap = await getCountFromServer(studentsQuery)
  return countSnap.data().count
}

export async function findKioskStudentsByBirthDate(birthDate: string): Promise<KioskStudent[]> {
  const studentsQuery = query(
    collection(db, 'users'),
    where('role', '==', 'student'),
    where('birthDate', '==', birthDate),
  )
  const snap = await getDocs(studentsQuery)
  return sortUsers(snap.docs.map(d => toAppUser(d.id, d.data())))
    .map(({ uid, name, grade, birthDate: userBirthDate }) => ({
      uid,
      name,
      grade,
      birthDate: userBirthDate,
    }))
}

// ─── Week / Liturgy ───────────────────────────────────────────────────────────

export function getThisWeekId(): string {
  const now = new Date()
  const sunday = new Date(now)
  sunday.setDate(now.getDate() - ((now.getDay() + 7) % 7))
  return formatLocalDate(sunday)
}

export async function getWeekData(weekId: string): Promise<WeekData | null> {
  const snap = await getDoc(doc(db, 'weeks', weekId))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as WeekData
}

export async function saveWeekData(weekId: string, data: Partial<Omit<WeekData, 'id'>>) {
  await setDoc(doc(db, 'weeks', weekId), data, { merge: true })
}

export async function getWeekList(): Promise<string[]> {
  const snap = await getDocs(collection(db, 'weeks'))
  return snap.docs.map(d => d.id).sort().reverse()
}

// ─── Assignment ───────────────────────────────────────────────────────────────

export async function getAssignment(weekId: string): Promise<Assignment | null> {
  const snap = await getDoc(doc(db, 'assignments', weekId))
  if (!snap.exists()) return null
  return normalizeAssignmentData(snap.id, snap.data())
}

export async function saveAssignment(weekId: string, data: Partial<Omit<Assignment, 'weekId'>>) {
  await setDoc(doc(db, 'assignments', weekId), data, { merge: true })
}

// ─── Attendance ───────────────────────────────────────────────────────────────

export async function getAttendance(weekId: string): Promise<AttendanceRecord[]> {
  const snap = await getDocs(collection(db, 'attendance', weekId, 'records'))
  return snap.docs.map(d => ({
    uid: d.id,
    present: d.data().present,
    timestamp: d.data().timestamp instanceof Timestamp ? d.data().timestamp.toDate() : null,
  }))
}

export async function markAttendance(weekId: string, uid: string, present: boolean) {
  const ref = doc(db, 'attendance', weekId, 'records', uid)
  await setDoc(ref, { present, timestamp: present ? serverTimestamp() : null }, { merge: true })
}

// ─── Kiosk Session ────────────────────────────────────────────────────────────

export async function getKioskSession(): Promise<KioskSession> {
  const snap = await getDoc(doc(db, 'settings', 'kiosk'))
  if (!snap.exists()) return { isOpen: false, openedAt: null }
  const d = snap.data()
  return {
    isOpen: d.isOpen ?? false,
    openedAt: d.openedAt instanceof Timestamp ? d.openedAt.toDate() : null,
  }
}

export async function setKioskOpen(open: boolean) {
  await setDoc(doc(db, 'settings', 'kiosk'), {
    isOpen: open,
    openedAt: open ? serverTimestamp() : null,
  })
}

export function onKioskSessionChange(cb: (s: KioskSession) => void) {
  return onSnapshot(doc(db, 'settings', 'kiosk'), snap => {
    if (!snap.exists()) { cb({ isOpen: false, openedAt: null }); return }
    const d = snap.data()
    cb({
      isOpen: d.isOpen ?? false,
      openedAt: d.openedAt instanceof Timestamp ? d.openedAt.toDate() : null,
    })
  })
}

// ─── Notices (알림장) ──────────────────────────────────────────────────────────

export async function getNotices(count = 20): Promise<Notice[]> {
  const snap = await getDocs(query(collection(db, 'notices'), orderBy('createdAt', 'desc'), limit(count)))
  return snap.docs.map(d => ({
    id: d.id,
    title: d.data().title,
    body: d.data().body,
    createdAt: d.data().createdAt instanceof Timestamp ? d.data().createdAt.toDate() : new Date(),
  }))
}

export async function saveNotice(title: string, body: string) {
  const ref = doc(collection(db, 'notices'))
  await setDoc(ref, { title, body, createdAt: serverTimestamp() })
  return ref.id
}

export async function deleteNotice(id: string) {
  await deleteDoc(doc(db, 'notices', id))
}

// ─── Attendance History ───────────────────────────────────────────────────────

export async function getUserAttendanceHistory(uid: string): Promise<{ weekId: string; present: boolean }[]> {
  const weeksSnap = await getDocs(
    query(collection(db, 'attendance'), orderBy(documentId(), 'desc'), limit(26))
  )
  const results = await Promise.all(
    weeksSnap.docs.map(async weekDoc => {
      const recordSnap = await getDoc(doc(db, 'attendance', weekDoc.id, 'records', uid))
      return {
        weekId: weekDoc.id,
        present: recordSnap.exists() ? (recordSnap.data().present ?? false) : false,
      }
    })
  )
  return results
}

// ─── Birthday / Feast Day ─────────────────────────────────────────────────────

export async function getTodaySpecialStudents(): Promise<{ birthday: AppUser[]; feastDay: AppUser[] }> {
  const today = new Date()
  const todayMMDD =
    String(today.getMonth() + 1).padStart(2, '0') +
    String(today.getDate()).padStart(2, '0')

  const allUsers = await getAllUsers()
  const students = allUsers.filter(u => u.role === 'student')

  const birthday = students.filter(u => {
    if (!u.birthDate || u.birthDate.length !== 6) return false
    return u.birthDate.slice(2, 6) === todayMMDD
  })

  const feastDay = students.filter(u => {
    const savedFeastDay = normalizeFeastDay(u.feastDay)
    if (savedFeastDay) return savedFeastDay === todayMMDD
    if (!u.baptismalName) return false
    const fallbackFeastDay = normalizeFeastDay(SAINTS_FEAST_DAYS[u.baptismalName])
    return fallbackFeastDay === todayMMDD
  })

  return { birthday, feastDay }
}

// ─── Pending Attendance (교사 승인 대기) ──────────────────────────────────────

export async function submitPendingAttendance(weekId: string, uid: string) {
  await setDoc(doc(db, 'pendingAttendance', weekId, 'requests', uid), {
    uid, requestedAt: serverTimestamp(), status: 'pending',
  })
}

export function onPendingAttendanceChange(weekId: string, cb: (requests: PendingRequest[]) => void) {
  return onSnapshot(collection(db, 'pendingAttendance', weekId, 'requests'), snap => {
    cb(snap.docs.map(d => ({
      uid: d.id,
      requestedAt: d.data().requestedAt instanceof Timestamp ? d.data().requestedAt.toDate() : new Date(),
      status: d.data().status as PendingRequest['status'],
    })))
  })
}

export async function approvePendingAttendance(weekId: string, uid: string) {
  await markAttendance(weekId, uid, true)
  await deleteDoc(doc(db, 'pendingAttendance', weekId, 'requests', uid))
}

export async function rejectPendingAttendance(weekId: string, uid: string) {
  await updateDoc(doc(db, 'pendingAttendance', weekId, 'requests', uid), { status: 'rejected' })
}

export function onAttendanceRecord(weekId: string, uid: string, cb: (present: boolean) => void) {
  return onSnapshot(doc(db, 'attendance', weekId, 'records', uid), snap => {
    cb(snap.exists() ? (snap.data().present ?? false) : false)
  })
}

export function onPendingRequestChange(weekId: string, uid: string, cb: (req: PendingRequest | null) => void) {
  return onSnapshot(doc(db, 'pendingAttendance', weekId, 'requests', uid), snap => {
    if (!snap.exists()) { cb(null); return }
    const d = snap.data()
    cb({
      uid: snap.id,
      requestedAt: d.requestedAt instanceof Timestamp ? d.requestedAt.toDate() : new Date(),
      status: d.status as PendingRequest['status'],
    })
  })
}

export function onNoticesChange(cb: (notices: Notice[]) => void) {
  return onSnapshot(
    query(collection(db, 'notices'), orderBy('createdAt', 'desc'), limit(10)),
    snap => {
      cb(snap.docs.map(d => ({
        id: d.id,
        title: d.data().title,
        body: d.data().body,
        createdAt: d.data().createdAt instanceof Timestamp ? d.data().createdAt.toDate() : new Date(),
      })))
    }
  )
}
