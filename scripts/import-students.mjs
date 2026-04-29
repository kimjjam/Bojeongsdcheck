// 학생 일괄 등록 스크립트
// 실행 방법: node scripts/import-students.mjs

import { initializeApp } from 'firebase/app'
import { getFirestore, doc, setDoc } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyB8k-pFPAG3U-i3Hb7Zn836GjXvJRnH-pU",
  authDomain: "bojeongsdcheck.firebaseapp.com",
  projectId: "bojeongsdcheck",
  storageBucket: "bojeongsdcheck.firebasestorage.app",
  messagingSenderId: "743733554268",
  appId: "1:743733554268:web:58b84f9d24cd5a2131ca99",
}

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)

// ──────────────────────────────────────────────
// 학생 데이터 (학년, 이름, 세례명)
// ──────────────────────────────────────────────
const students = [
  // 고등 1학년
  { grade: '고1', name: '김도연',  baptismalName: '야고보' },
  { grade: '고1', name: '김해슬',  baptismalName: '소피아' },

  // 고등 2학년
  { grade: '고2', name: '김선주',  baptismalName: '요세피나' },
  { grade: '고2', name: '김성찬',  baptismalName: '유대첼베드로' },
  { grade: '고2', name: '박지유',  baptismalName: '미카엘라' },
  { grade: '고2', name: '송지효',  baptismalName: '글라라' },
  { grade: '고2', name: '송채운',  baptismalName: '프리스카' },
  { grade: '고2', name: '유다현',  baptismalName: '플로라' },

  // 고등 3학년
  { grade: '고3', name: '허민경',  baptismalName: '마르티나' },

  // 중 1학년
  { grade: '중1', name: '김병희',  baptismalName: '루카' },
  { grade: '중1', name: '김선우',  baptismalName: '그레이스' },
  { grade: '중1', name: '김해인',  baptismalName: '비비안나' },
  { grade: '중1', name: '노가은',  baptismalName: '미카엘라' },
  { grade: '중1', name: '박지은',  baptismalName: '라파엘라' },
  { grade: '중1', name: '박현준',  baptismalName: '프란치스코' },
  { grade: '중1', name: '배운서',  baptismalName: '아나스타시아' },
  { grade: '중1', name: '송은수',  baptismalName: '프란치스코' },
  { grade: '중1', name: '신대호',  baptismalName: '프란치스코' },
  { grade: '중1', name: '유성준',  baptismalName: '사도요한' },
  { grade: '중1', name: '윤우진',  baptismalName: '사무엘' },
  { grade: '중1', name: '이건우',  baptismalName: '안드레아' },
  { grade: '중1', name: '이온별',  baptismalName: '올리비아' },
  { grade: '중1', name: '임소영',  baptismalName: '루시아' },
  { grade: '중1', name: '정연준',  baptismalName: '베드로' },
  { grade: '중1', name: '최윤아',  baptismalName: '그라체' },

  // 중 2학년
  { grade: '중2', name: '김민재',  baptismalName: '펠릭스' },
  { grade: '중2', name: '김서연',  baptismalName: '라파엘라' },
  { grade: '중2', name: '김원준',  baptismalName: '미카엘' },
  { grade: '중2', name: '김주원',  baptismalName: '루카' },
  { grade: '중2', name: '배민제',  baptismalName: '스테파노' },
  { grade: '중2', name: '손채빈',  baptismalName: '리디아' },
  { grade: '중2', name: '송유찬',  baptismalName: '프란치스코' },
  { grade: '중2', name: '송윤수',  baptismalName: '패트릭' },
  { grade: '중2', name: '송효린',  baptismalName: '안젤라' },
  { grade: '중2', name: '이다니',  baptismalName: '스콜라스티카' },
  { grade: '중2', name: '이하람',  baptismalName: '보나' },
  { grade: '중2', name: '전유주',  baptismalName: '로사베네리니' },
  { grade: '중2', name: '채연우',  baptismalName: '로사리아' },
  { grade: '중2', name: '한재이',  baptismalName: '레지나' },

  // 중 3학년
  { grade: '중3', name: '김도영',  baptismalName: '요한' },
  { grade: '중3', name: '김윤재',  baptismalName: '마르첼리노' },
  { grade: '중3', name: '사공난',  baptismalName: '마리아비앙카' },
  { grade: '중3', name: '이준우',  baptismalName: '다니엘' },
]

// ──────────────────────────────────────────────
// Firestore에 등록 (Auth 계정 없이 문서만 생성)
// ──────────────────────────────────────────────
let count = 0
for (const s of students) {
  // 중복 방지용 결정적 ID: grade + name 조합
  const uid = `student_${s.grade}_${s.name}`
  await setDoc(doc(db, 'users', uid), {
    name: s.name,
    baptismalName: s.baptismalName,
    grade: s.grade,
    role: 'student',
    email: '',
  })
  console.log(`✓ ${s.grade} ${s.name} (${s.baptismalName})`)
  count++
}

console.log(`\n완료: ${count}명 등록`)
process.exit(0)
