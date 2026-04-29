import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc,
  deleteDoc, serverTimestamp, Timestamp, onSnapshot,
  query, orderBy, limit
} from 'firebase/firestore'
import { db } from './firebase'
import type { AppUser, WeekData, Assignment, AttendanceRecord, Notice, KioskSession } from '../types'
import { SAINTS_FEAST_DAYS } from './saints'

// ─── 정렬 헬퍼 ────────────────────────────────────────────────────────────────
const GRADE_ORDER = ['중1', '중2', '중3', '고1', '고2', '고3']
function sortUsers(users: AppUser[]) {
  return users.sort((a, b) => {
    const gi = GRADE_ORDER.indexOf(a.grade ?? '') - GRADE_ORDER.indexOf(b.grade ?? '')
    return gi !== 0 ? gi : a.name.localeCompare(b.name, 'ko')
  })
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function getAllUsers(): Promise<AppUser[]> {
  const snap = await getDocs(collection(db, 'users'))
  return sortUsers(snap.docs.map(d => ({ uid: d.id, ...d.data() } as AppUser)))
}

/** 학생 등록 (Firebase Auth 없이 Firestore 문서만 생성) */
export async function createStudent(
  name: string,
  baptismalName: string,
  grade: string,
  groups: string[],
  birthDate: string  // "YYMMDD" 6자리
) {
  const uid = `student_${grade}_${name}_${Date.now()}`
  await setDoc(doc(db, 'users', uid), {
    name, baptismalName, grade, groups, birthDate,
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

export async function getStudentsPublic(): Promise<AppUser[]> {
  const snap = await getDocs(collection(db, 'users'))
  return sortUsers(
    snap.docs
      .filter(d => d.data().role === 'student')
      .map(d => ({ uid: d.id, ...d.data() } as AppUser))
  )
}

// ─── Week / Liturgy ───────────────────────────────────────────────────────────

export function getThisWeekId(): string {
  const now = new Date()
  const sunday = new Date(now)
  sunday.setDate(now.getDate() - ((now.getDay() + 7) % 7))
  return sunday.toISOString().split('T')[0]
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
  return { weekId: snap.id, ...snap.data() } as Assignment
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
  const weeksSnap = await getDocs(collection(db, 'attendance'))
  const results = await Promise.all(
    weeksSnap.docs.map(async weekDoc => {
      const recordSnap = await getDoc(doc(db, 'attendance', weekDoc.id, 'records', uid))
      return {
        weekId: weekDoc.id,
        present: recordSnap.exists() ? (recordSnap.data().present ?? false) : false,
      }
    })
  )
  return results.sort((a, b) => b.weekId.localeCompare(a.weekId))
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
    if (!u.baptismalName) return false
    const feastDate = SAINTS_FEAST_DAYS[u.baptismalName]
    if (!feastDate) return false
    return feastDate.replace('-', '') === todayMMDD
  })

  return { birthday, feastDay }
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
