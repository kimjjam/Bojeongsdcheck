# PROJECT_SUMMARY — 보정성당 출석관리

## 프로젝트 개요

보정성당 청소년부 미사 출석 및 전례 역할 배정을 관리하는 웹앱.  
교사(선생님)와 학생(청소년) 두 역할로 나뉘며, 학생은 개인 휴대폰에서 공개 출석 페이지로 자가 출석 체크를 진행한다.

---

## 기술 스택

| 항목 | 내용 |
|------|------|
| 프레임워크 | React 19 + TypeScript + Vite |
| 스타일 | Tailwind CSS |
| 라우팅 | React Router v7 |
| 백엔드/DB | Firebase (Firestore + Auth) |
| 배포 | dist/ 빌드 후 정적 호스팅 |

---

## 환경변수 (.env)

```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
```

---

## 디렉토리 구조

```
src/
├── App.tsx                        # 라우팅 진입점, 인증 분기
├── main.tsx
├── index.css
├── hooks/
│   └── useAuth.ts                 # Firebase Auth 상태 관리
├── lib/
│   ├── firebase.ts                # Firebase 초기화 (auth, db export)
│   └── firestore.ts               # Firestore CRUD 함수 모음
├── types/
│   └── index.ts                   # 전체 타입 정의
├── components/
│   └── Layout.tsx                 # 공통 레이아웃 (네비, 로그아웃)
└── pages/
    ├── LoginPage.tsx
    ├── AttendanceKioskPage.tsx     # 로그인 없이 접근 가능 (/attend, /kiosk는 리다이렉트)
    ├── NoticesBoardPage.tsx        # 로그인 없이 접근 가능 (/notices)
    ├── teacher/
    │   ├── StudentsPage.tsx        # 학생 목록 및 관리
    │   ├── AttendancePage.tsx      # 출석 체크 (교사용)
    │   ├── AssignmentPage.tsx      # 전례 역할 배정
    │   ├── LiturgyPage.tsx         # 전례 본문 관리
    │   └── NoticesPage.tsx         # 알림장 작성/관리
    └── student/
        └── MyRolePage.tsx          # 내 전례 역할 확인
```

---

## 라우팅 구조

| 경로 | 접근 | 설명 |
|------|------|------|
| `/attend` | 공개 | 학생 개인 출석 페이지 |
| `/kiosk` | 공개 | `/attend` 리다이렉트 |
| `/notices` | 공개 | 알림장 게시판 |
| `/teacher/*` | teacher 역할 | 교사 전용 관리 페이지 |
| `/student/my-role` | student 역할 | 학생 본인 역할 확인 |

---

## Firestore 컬렉션 구조

| 컬렉션 | 설명 |
|--------|------|
| `users/{uid}` | 사용자 정보 (role, name, grade, groups 등) |
| `weeks/{weekId}` | 주차별 전례 본문 (제1독서, 제2독서, 청원기도 1~4) |
| `assignments/{weekId}` | 주차별 전례 역할 배정 |
| `attendance/{weekId}/records/{uid}` | 주차별 출석 기록 |
| `settings/kiosk` | 학생 출석 링크 열림/닫힘 상태 |
| `notices/{id}` | 알림장 게시글 |

- `weekId` 형식: `YYYY-MM-DD` (해당 주의 일요일 날짜)

---

## 주요 타입 요약 (`src/types/index.ts`)

```ts
UserRole = 'teacher' | 'student'
StudentGroup = '전례부' | '성가대' | '반주단'

AppUser { uid, name, baptismalName?, role, grade?, groups?, birthDate? }
WeekData { id, readings1, readings2, intercessions: {1,2,3,4} }
Assignment { weekId, narrator, acolytes[2], intercessions: {1,2,3,4} }
AttendanceRecord { uid, present, timestamp }
Notice { id, title, body, createdAt }
KioskSession { isOpen, openedAt }
LiturgyRole = 'narrator' | 'acolyte_1' | 'acolyte_2' | 'intercession_1~4' | null
```

---

## 인증 방식

- 교사: Firebase Email/Password 로그인
- 학생: Firestore 문서만 존재 (Firebase Auth 계정 없음), uid 형식 `student_{grade}_{name}_{timestamp}`
- 학생 출석/공지 페이지는 인증 없이 접근 가능

---

## 최근 변경 이력

- 2026-05-04 실 배포 대비 UX/기능 개선 6종: weekId 변경 시 키오스크 상태 초기화, 출석 요청 이중 제출 방지(isSubmitting), 생년월일 MM/DD 유효성 검증, 역할 배정 중복 학생 차단, 학생 삭제 커스텀 모달, 알림 500ms 배치+활성 주차 배지, 빠른 입력 append 방식, getWeekList/getUserAttendanceHistory 쿼리 최적화
- 2026-05-03 7가지 이슈 일괄 대응: WeekData에 화답송(responsorialPsalm) 추가, KioskSession에 activeWeekId 추가, AttendancePage에 출석이력 그리드/브라우저 알림/전체 승인 모달/미사 날짜 설정 구현, AttendanceKioskPage에 localStorage 빠른 출석·UI 겹침 수정·activeWeekId 적용, getWeekList에 미래 토요일 자동 포함
- 2026-05-01 /teacher URL 유지형 탭 구조 추가 (/teacher?tab=students 기준), 기존 /teacher/:tab 진입은 canonical URL로 리다이렉트하도록 변경
- 2026-05-01 `AttendanceKioskPage` 출석 완료 헤더를 사원증 스타일로 리디자인 — 랜야드 고리·조직 배너·이니셜 아바타·바코드 장식 추가
- 2026-04-30 `/kiosk`·`/notices` 공개 라우트 삭제, 알림장을 `/attend` 완료 화면에 통합 (NoticesBoardPage 제거)
- 2026-04-29 Cursor 규칙 파일 `.cursorrules` 추가, AGENTS 기준 계획 승인 절차와 문서 갱신 규칙을 Cursor 환경에도 동일 반영
- 2026-04-29 React 19 / Router 7 기준으로 문서와 실제 코드 정합성 수정, 미사용 학생 출석 페이지 및 Vite 기본 자산 정리
- 2026-04-29 `weekId`를 KST 기준으로 계산하도록 수정하고, 역할 배정/출석/전례/알림장 페이지의 React Hooks lint 이슈 정리
- 2026-04-29 포인트/스탬프·전례역할알림·생일축일알림·간식행사 기능 추가 (MyRolePage, LiturgyPage, StudentsPage)
- 2026-04-29 학생 생년월일 로그인(localStorage 세션) 추가 — LoginPage 교사/학생 탭 분리, 키오스크 완료 화면 출석 통계 표시
