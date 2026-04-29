import { useState, useEffect } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import type { User } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'
import type { AppUser } from '../types'

export function useAuth() {
  const [user, setUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // 이전 학생 세션 잔여물 정리
    localStorage.removeItem('bojung_student_uid')

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: User | null) => {
      if (firebaseUser) {
        const snap = await getDoc(doc(db, 'users', firebaseUser.uid))
        if (snap.exists()) {
          setUser({ uid: firebaseUser.uid, email: firebaseUser.email ?? '', ...snap.data() } as AppUser)
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

  const logout = async () => {
    await signOut(auth)
    setUser(null)
  }

  return { user, loading, error, login, logout }
}
