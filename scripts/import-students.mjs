// 학생 일괄 등록 스크립트
// 실행 방법:
//   node --env-file=.env scripts/import-students.mjs scripts/students.private.json

import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { initializeApp } from 'firebase/app'
import { getFirestore, doc, setDoc } from 'firebase/firestore'

const REQUIRED_ENV_KEYS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
]

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const inputPath = process.argv[2] ?? path.join(scriptDir, 'students.private.json')

function requireEnv(name) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} 환경변수가 필요합니다. node --env-file=.env 로 실행하세요.`)
  }
  return value
}

async function readStudents(jsonPath) {
  const raw = await readFile(jsonPath, 'utf8')
  const parsed = JSON.parse(raw)

  if (!Array.isArray(parsed)) {
    throw new Error('학생 데이터는 배열(JSON Array)이어야 합니다.')
  }

  return parsed
}

const firebaseConfig = {
  apiKey: requireEnv('VITE_FIREBASE_API_KEY'),
  authDomain: requireEnv('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: requireEnv('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: requireEnv('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: requireEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: requireEnv('VITE_FIREBASE_APP_ID'),
}

for (const key of REQUIRED_ENV_KEYS) {
  requireEnv(key)
}

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)
const students = await readStudents(inputPath)

let count = 0
for (const student of students) {
  const uid = `student_${student.grade}_${student.name}`

  await setDoc(doc(db, 'users', uid), {
    email: '',
    name: student.name,
    baptismalName: student.baptismalName ?? '',
    grade: student.grade,
    phone: student.phone ?? '',
    feastDay: student.feastDay ?? '',
    groups: Array.isArray(student.groups) ? student.groups : [],
    birthDate: student.birthDate ?? '',
    role: 'student',
  })

  const birthDateLabel = student.birthDate || '생년월일 미입력'
  console.log(`✓ ${student.grade} ${student.name} (${student.baptismalName ?? ''}) ${birthDateLabel}`)
  count++
}

console.log(`\n완료: ${count}명 등록`)
