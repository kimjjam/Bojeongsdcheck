import { useState, useEffect } from 'react'
import { getAssignment, getWeekData, getThisWeekId } from '../../lib/firestore'
import { useAttendanceStats } from '../../hooks/useAttendanceStats'
import type { AppUser, LiturgyRole } from '../../types'

interface Props { user: AppUser }

export default function MyRolePage({ user }: Props) {
  const [role, setRole] = useState<LiturgyRole>(null)
  const [content, setContent] = useState<string | null>(null)
  const [contentLabel, setContentLabel] = useState('')
  const [snack, setSnack] = useState<string | undefined>()
  const [events, setEvents] = useState<string[] | undefined>()
  const [loading, setLoading] = useState(true)
  const weekId = getThisWeekId()

  const { stats, loading: statsLoading } = useAttendanceStats(user.uid)

  useEffect(() => {
    const load = async () => {
      const [assignment, weekData] = await Promise.all([
        getAssignment(weekId),
        getWeekData(weekId),
      ])

      setSnack(weekData?.snack)
      setEvents(weekData?.events)

      if (!assignment) { setLoading(false); return }

      let foundRole: LiturgyRole = null
      let foundContent: string | null = null
      let foundLabel = ''

      if (assignment.narrator === user.uid) {
        foundRole = 'narrator'
      } else if (assignment.acolytes[0] === user.uid) {
        foundRole = 'acolyte_1'
        foundContent = weekData?.readings1 ?? null
        foundLabel = '제1독서'
      } else if (assignment.acolytes[1] === user.uid) {
        foundRole = 'acolyte_2'
        foundContent = weekData?.readings2 ?? null
        foundLabel = '제2독서'
      } else {
        for (const n of [1, 2, 3, 4] as const) {
          if (assignment.intercessions[n] === user.uid) {
            foundRole = `intercession_${n}` as LiturgyRole
            foundContent = weekData?.intercessions[n] ?? null
            foundLabel = `보편지향기도 ${n}번`
            break
          }
        }
      }

      setRole(foundRole); setContent(foundContent); setContentLabel(foundLabel)
      setLoading(false)
    }
    load()
  }, [user.uid, weekId])

  const roleLabel: Record<NonNullable<LiturgyRole>, string> = {
    narrator:       '해설',
    acolyte_1:      '복사 (제1독서)',
    acolyte_2:      '복사 (제2독서)',
    intercession_1: '보편지향기도 1번',
    intercession_2: '보편지향기도 2번',
    intercession_3: '보편지향기도 3번',
    intercession_4: '보편지향기도 4번',
  }

  const roleColor: Record<NonNullable<LiturgyRole>, string> = {
    narrator:       'bg-purple-100 text-purple-700',
    acolyte_1:      'bg-blue-100 text-blue-700',
    acolyte_2:      'bg-blue-100 text-blue-700',
    intercession_1: 'bg-amber-100 text-amber-700',
    intercession_2: 'bg-amber-100 text-amber-700',
    intercession_3: 'bg-amber-100 text-amber-700',
    intercession_4: 'bg-amber-100 text-amber-700',
  }

  return (
    <div className="p-4 space-y-4">
      <div>
        <h2 className="text-lg font-bold text-gray-800">이번 주 내 역할</h2>
        <p className="text-sm text-gray-500">{weekId}</p>
      </div>

      {/* 1순위: 전례 역할 알림 배너 */}
      {!loading && role && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-center gap-3">
          <div className="text-2xl">🔔</div>
          <div>
            <p className="font-bold text-amber-800 text-sm">이번 주 전례 담당입니다!</p>
            <p className="text-amber-600 text-xs mt-0.5">{roleLabel[role]} 역할을 맡았어요</p>
          </div>
        </div>
      )}

      {/* 2순위: 포인트/스탬프 */}
      <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
        <p className="text-sm font-semibold text-gray-700">출석 현황</p>
        {statsLoading ? (
          <div className="text-xs text-gray-400 text-center py-2">불러오는 중...</div>
        ) : (
          <>
            <div className="flex gap-3">
              <div className="flex-1 bg-orange-50 rounded-xl p-3 text-center">
                <div className="text-2xl font-bold text-orange-500">{stats.streak}</div>
                <div className="text-xs text-orange-400 mt-0.5">🔥 연속 출석</div>
              </div>
              <div className="flex-1 bg-blue-50 rounded-xl p-3 text-center">
                <div className="text-2xl font-bold text-blue-500">{stats.total}</div>
                <div className="text-xs text-blue-400 mt-0.5">✅ 총 출석</div>
              </div>
            </div>
            {stats.stamps.length > 0 && (
              <div>
                <p className="text-xs text-gray-400 mb-2">최근 {stats.stamps.length}주 출석 스탬프</p>
                <div className="flex gap-1.5 flex-wrap">
                  {[...stats.stamps].reverse().map((present, i) => (
                    <div
                      key={i}
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                        present
                          ? 'bg-[#1e3a5f] border-[#1e3a5f] text-white'
                          : 'bg-white border-gray-200 text-gray-300'
                      }`}
                    >
                      {present ? '✓' : ''}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* 4순위: 간식/행사 */}
      {(snack || (events && events.length > 0)) && (
        <div className="bg-white rounded-xl shadow-sm p-4 space-y-2">
          <p className="text-sm font-semibold text-gray-700">이번 주 정보</p>
          {snack && (
            <div className="flex items-center gap-2 text-sm text-gray-600 bg-yellow-50 rounded-lg px-3 py-2">
              <span>🍪</span>
              <span>간식: <span className="font-medium">{snack}</span></span>
            </div>
          )}
          {events && events.length > 0 && (
            <div className="bg-sky-50 rounded-lg px-3 py-2 space-y-1">
              <div className="flex items-center gap-1 text-xs text-sky-500 font-medium mb-1">
                <span>📅</span><span>행사 일정</span>
              </div>
              {events.map((ev, i) => (
                <p key={i} className="text-sm text-gray-600">• {ev}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 기존: 역할 상세 */}
      {loading ? (
        <div className="text-center py-10 text-gray-400">불러오는 중...</div>
      ) : !role ? (
        <div className="bg-gray-50 rounded-xl p-8 text-center">
          <div className="text-4xl mb-3">😊</div>
          <p className="text-gray-500">이번 주 배정된 역할이 없어요</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className={`rounded-xl p-4 text-center ${roleColor[role]}`}>
            <div className="text-3xl font-bold mb-1">✝️</div>
            <div className="text-lg font-bold">{roleLabel[role]}</div>
          </div>

          {role === 'narrator' && (
            <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-600 text-center">
              <p>해설 역할은 별도 내용이 없습니다.</p>
              <p className="mt-1 text-gray-400">미사 진행에 맞게 해설을 담당해 주세요.</p>
            </div>
          )}

          {(role === 'acolyte_1' || role === 'acolyte_2' || role?.startsWith('intercession_')) && (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="bg-[#1e3a5f] text-white px-4 py-2.5 text-sm font-semibold">
                📖 {contentLabel}
              </div>
              <div className="p-4">
                {content ? (
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{content}</p>
                ) : (
                  <p className="text-sm text-gray-400 italic">아직 내용이 입력되지 않았습니다. 교사에게 문의하세요.</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
