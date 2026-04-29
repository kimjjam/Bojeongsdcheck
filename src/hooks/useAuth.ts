import { useState, useEffect } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import type { User } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'
import type { AppUser } from '../types'
import { findKioskStudentsByBirthDate, getStudentByUid } from '../lib/firestore'

const STUDENT_SESSION_KEY = 'bojung_student_uid'

export function useAuth() {
  const [user, setUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const savedUid = localStorage.getItem(STUDENT_SESSION_KEY)

    if (savedUid) {
      let cancelled = false

      void (async () => {
        try {
          const student = await getStudentByUid(savedUid)
          if (cancelled) return

          if (student && student.role === 'student') {
            setUser(student)
          } else {
            localStorage.removeItem(STUDENT_SESSION_KEY)
          }
        } catch {
          if (!cancelled) {
            localStorage.removeItem(STUDENT_SESSION_KEY)
            setError('학생 정보를 불러오지 못했습니다. 다시 시도해주세요.')
          }
        } finally {
          if (!cancelled) {
            setLoading(false)
          }
        }
      })()

      return () => { cancelled = true }
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: User | null) => {
      if (firebaseUser) {
        const snap = await getDoc(doc(db, 'users', firebaseUser.uid))
        if (snap.exists()) {
          setUser({ uid: firebaseUser.uid, ...snap.data() } as AppUser)
        }
      } else {
        setUser(null)
      }
      setLoading(false)
    })
    return unsubscribe
  }, [])

  const login = async (email: string, password: string) => {
    setError(null)
    try {
      await signInWithEmailAndPassword(auth, email, password)
    } catch {
      setError('이메일 또는 비밀번호가 올바르지 않습니다.')
      throw new Error('login failed')
    }
  }

  const studentLogin = async (birthDate: string): Promise<{ uid: string; name: string; grade?: string }[]> => {
    setError(null)
    try {
      const matches = await findKioskStudentsByBirthDate(birthDate)
      if (matches.length === 0) {
        setError('일치하는 학생이 없습니다. 생년월일을 확인해주세요.')
        return []
      }
      if (matches.length === 1) {
        await applyStudentSession(matches[0].uid)
        return []
      }
      return matches.map(s => ({ uid: s.uid, name: s.name, grade: s.grade }))
    } catch {
      setError('학생 로그인 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.')
      return []
    }
  }

  const selectStudent = async (uid: string) => {
    await applyStudentSession(uid)
  }

  const applyStudentSession = async (uid: string) => {
    const student = await getStudentByUid(uid)
    if (student && student.role === 'student') {
      localStorage.setItem(STUDENT_SESSION_KEY, uid)
      setUser(student)
    }
  }

  const logout = async () => {
    if (localStorage.getItem(STUDENT_SESSION_KEY)) {
      localStorage.removeItem(STUDENT_SESSION_KEY)
      setUser(null)
    } else {
      await signOut(auth)
      setUser(null)
    }
  }

  return { user, loading, error, login, studentLogin, selectStudent, logout }
}
