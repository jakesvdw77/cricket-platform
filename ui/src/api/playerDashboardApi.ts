import { keepPreviousData, useQuery } from '@tanstack/react-query'
import api from './axiosConfig'
import { filterParams, playerStatsKey } from './playerStatsApi'
import type { NotCapturedItem, PlayerStatsBasis, PlayerStatsFilters, PlayerStatsScope } from './playerStatsApi'

// docs/specs/117-stats-dashboard.md: the player Dashboard's series (GET .../players/{playerId}/stats/dashboard). One read per page;
// every plotted number, share, average, reference value and trend hint is the server's (PlayerDashboardSeriesBuilder through
// PlayerStatsCalculator): the client only draws. Mirrors PlayerDashboardDto. A figure with no valid basis is null (a gap), never 0.
// Series are oldest first.

export interface DashboardWindow {
  // per-match charts show this many most recent points
  pointLimit: number
  // running trends and donuts cover at most this many counted matches
  historyCap: number
}

export interface DashboardBattingInnings {
  matchId: string
  resultId: string
  matchDate: string | null
  // null in a derby (see `derby`)
  opponentName: string | null
  derby: boolean
  runs: number | null
  // null when the innings did not record valid balls
  balls: number | null
  notOut: boolean
  // the stored dismissal type name ("CAUGHT", "NOT_OUT", ...)
  howOut: string | null
}

export interface DashboardBattingSummary {
  inningsTotal: number
  shown: number
  notOuts: number
  runs: number
  // the batting average over the whole scope (the optional reference line); null with no dismissal
  averageRuns: number | null
}

export interface DashboardDismissal {
  type: string
  label: string
  count: number
  percent: number | null
}

export interface DashboardTrendPoint {
  matchId: string
  resultId: string
  matchDate: string | null
  opponentName: string | null
  derby: boolean
  cumulativeRuns: number
  cumulativeDismissals: number
  // null until the first dismissal
  average: number | null
}

export interface DashboardBowlingMatch {
  matchId: string
  resultId: string
  matchDate: string | null
  opponentName: string | null
  derby: boolean
  balls: number
  ballsPerOver: number
  maidens: number
  runs: number
  wickets: number
  // null at zero balls
  economy: number | null
}

export interface DashboardWicketType {
  type: string
  label: string
  count: number
  percent: number | null
}

export interface DashboardWicketTypes {
  types: DashboardWicketType[]
  notItemised: { count: number; percent: number | null }
  total: number
  itemised: number
  coverage: { wicketsItemised: number; wicketsTotal: number; inningsItemised: number; inningsWithWickets: number }
}

export type DashboardTrendDirection = 'UP' | 'DOWN' | 'FLAT'

export interface DashboardEconomySummary {
  // the Bowling tab's Econ (the dashed reference line); null with no balls
  overallEconomy: number | null
  matchesCounted: number
  matchesWithEconomy: number
  totalPoints: number
  shown: number
  // the trend hint: null unless each half has at least three matches
  recentEconomy: number | null
  earlierEconomy: number | null
  direction: DashboardTrendDirection | null
}

export interface PlayerDashboard {
  playerId: string
  scope: PlayerStatsScope
  basis: PlayerStatsBasis
  window: DashboardWindow
  truncated: boolean
  truncatedSince: string | null
  battingInnings: DashboardBattingInnings[]
  battingSummary: DashboardBattingSummary
  dismissals: DashboardDismissal[]
  battingTrend: DashboardTrendPoint[]
  bowlingMatches: DashboardBowlingMatch[]
  wicketTypes: DashboardWicketTypes
  economySummary: DashboardEconomySummary
  notCaptured: NotCapturedItem[]
}

// Under the stats prefix, so every existing invalidation of a player's statistics refreshes the Dashboard too.
export const playerDashboardKey = (clubId: string, playerId: string, filters: PlayerStatsFilters = {}) =>
  [
    ...playerStatsKey(clubId, playerId),
    'dashboard',
    {
      seasonId: filters.seasonId ?? null,
      leagueId: filters.leagueId ?? null,
      teamId: filters.teamId ?? null,
      sectionId: filters.sectionId ?? null,
      competition: filters.competition ?? null,
    },
  ] as const

export async function getPlayerDashboard(clubId: string, playerId: string, filters: PlayerStatsFilters = {}): Promise<PlayerDashboard> {
  const { data } = await api.get<PlayerDashboard>(`/manage/clubs/${clubId}/players/${playerId}/stats/dashboard`, { params: filterParams(filters) })
  return data
}

// The page asks for it while the Dashboard tab is active, with exactly the FilterBar's filters, in parallel with the stats read.
// keepPreviousData keeps the last charts on screen (dimmed) while a filter change loads.
export function usePlayerDashboard(clubId: string | undefined, playerId: string | undefined, filters: PlayerStatsFilters, enabled = true) {
  return useQuery({
    queryKey: playerDashboardKey(clubId as string, playerId as string, filters),
    queryFn: () => getPlayerDashboard(clubId as string, playerId as string, filters),
    enabled: Boolean(clubId) && Boolean(playerId) && enabled,
    placeholderData: keepPreviousData,
  })
}
