import { keepPreviousData, useQuery } from '@tanstack/react-query'
import api from './axiosConfig'
import { statsFilterParams } from './statsFilterParams'
import { teamStatsKey } from './teamStatsApi'
import type { TeamNetRunRateStatus, TeamStatsNotCapturedItem, TeamStatsPageData, TeamStatsPageFilters } from './teamStatsApi'
import type { DashboardTrendDirection, DashboardWindow } from './playerDashboardApi'

// docs/specs/117-stats-dashboard.md: the team Dashboard's series (GET .../teams/{teamId}/stats/dashboard). One read per page, only while
// the block is shown; every plotted number is the server's (TeamDashboardSeriesBuilder through TeamStatsCalculator). Mirrors
// TeamDashboardDto. An unrecorded or unusable figure is null (a gap), never 0. Series are oldest first.

export type TeamDashboardResultCode = 'WON' | 'LOST' | 'TIED' | 'DRAWN' | 'NO_RESULT'

export interface TeamDashboardResult {
  matchId: string
  resultId: string
  matchDate: string | null
  opponentName: string | null
  derby: boolean
  // a win or loss by forfeit: no innings, every figure below is null
  forfeit: boolean
  result: TeamDashboardResultCode
  ownRuns: number | null
  ownWickets: number | null
  ownBalls: number | null
  oppRuns: number | null
  oppWickets: number | null
  oppBalls: number | null
  ownRunRate: number | null
  oppRunRate: number | null
}

export interface TeamDashboardResultsSummary {
  played: number
  won: number
  lost: number
  tied: number
  drawn: number
  noResult: number
  // Share of played, 1 decimal, null when nothing was played (server-computed).
  wonPercent: number | null
  lostPercent: number | null
  tiedPercent: number | null
  drawnPercent: number | null
  noResultPercent: number | null
  forfeits: number
  totalPoints: number
  shown: number
  withRuns: number
}

export interface TeamDashboardRunRatePoint {
  matchId: string
  resultId: string
  matchDate: string | null
  opponentName: string | null
  teamRunRate: number | null
  oppositionRunRate: number | null
}

export interface TeamDashboardNetRunRatePoint {
  matchId: string
  resultId: string
  matchDate: string | null
  opponentName: string | null
  value: number | null
}

export interface TeamDashboardNetRunRateTrend {
  status: TeamNetRunRateStatus
  // only when SHOWN
  points: TeamDashboardNetRunRatePoint[] | null
}

export interface TeamDashboardExtrasPoint {
  matchId: string
  resultId: string
  matchDate: string | null
  opponentName: string | null
  derby: boolean
  // null = not recorded (never 0)
  wides: number | null
  noBalls: number | null
  byes: number | null
  legByes: number | null
  penaltyRuns: number | null
  itemised: boolean
  // the stored total of a total-only innings (no component), else null
  notItemised: number | null
  // null = no extras recorded at all (a gap)
  total: number | null
}

export interface TeamDashboardExtrasSummary {
  matchesCounted: number
  matchesWithExtras: number
  matchesItemised: number
  totalPoints: number
  shown: number
  widesRecorded: number
  noBallsRecorded: number
  byesRecorded: number
  legByesRecorded: number
  penaltyRunsRecorded: number
}

export interface TeamDashboardDotBallsPoint {
  matchId: string
  resultId: string
  matchDate: string | null
  opponentName: string | null
  derby: boolean
  ballsBowled: number | null
  dots: number | null
  dotPercent: number | null
}

export interface TeamDashboardDotBallsSummary {
  matchesCounted: number
  matchesWithDots: number
  totalPoints: number
  shown: number
  // the pooled figure (the dashed reference line)
  averageDotPercent: number | null
  recentAverage: number | null
  earlierAverage: number | null
  direction: DashboardTrendDirection | null
}

export interface TeamDashboard {
  teamId: string
  teamName: string
  scope: TeamStatsPageData['scope']
  basis: TeamStatsPageData['basis']
  window: DashboardWindow
  truncated: boolean
  truncatedSince: string | null
  results: TeamDashboardResult[]
  resultsSummary: TeamDashboardResultsSummary
  runRateTrend: TeamDashboardRunRatePoint[]
  netRunRateTrend: TeamDashboardNetRunRateTrend
  extrasConceded: TeamDashboardExtrasPoint[]
  extrasSummary: TeamDashboardExtrasSummary
  dotBalls: TeamDashboardDotBallsPoint[]
  dotBallsSummary: TeamDashboardDotBallsSummary
  notCaptured: TeamStatsNotCapturedItem[]
}

// Under the team-stats prefix, so every existing invalidation of the team figures refreshes the Dashboard too.
export const teamDashboardKey = (clubId: string, teamId: string, filters: TeamStatsPageFilters) =>
  [...teamStatsKey(clubId), 'dashboard', teamId, { seasonId: filters.seasonId ?? null, leagueId: filters.leagueId ?? null, competition: filters.competition ?? null }] as const

export async function getTeamDashboard(clubId: string, teamId: string, filters: TeamStatsPageFilters): Promise<TeamDashboard> {
  const { data } = await api.get<TeamDashboard>(`/manage/clubs/${clubId}/teams/${teamId}/stats/dashboard`, { params: statsFilterParams({ ...filters }) })
  return data
}

// Enabled only while the page is ready and the block is shown (no request while it is hidden); the filters are the page's own.
export function useTeamDashboard(clubId: string | undefined, teamId: string | undefined, filters: TeamStatsPageFilters, enabled = true) {
  return useQuery({
    queryKey: teamDashboardKey(clubId as string, teamId as string, filters),
    queryFn: () => getTeamDashboard(clubId as string, teamId as string, filters),
    enabled: Boolean(clubId) && Boolean(teamId) && enabled,
    placeholderData: keepPreviousData,
  })
}
