import { keepPreviousData, useQuery } from '@tanstack/react-query'
import api from './axiosConfig'

// docs/specs/103-player-stats.md: one player's statistics from published results (GET .../players/{playerId}/stats).
// Every figure is computed by the server (PlayerStatsCalculator); this file only types it. The shapes mirror the spec's
// PlayerStatsDto table. Where the spec names a field but not its inner shape (positions[], form[] items, dismissalModes
// keys, notCaptured codes) the shape below is a best reading of the spec and is flagged in the slice 3 report: a mismatch
// with the backend is a one-file fix here. Overs are never carried (balls only); utils/oversFormat does the display.

export type StatsCompetition = 'LEAGUE' | 'FRIENDLY'

export interface PlayerStatsFilters {
  seasonId?: string | null
  leagueId?: string | null
  teamId?: string | null
  sectionId?: string | null
  competition?: StatsCompetition | null
}

export interface PlayerStatsScope {
  kind: 'CLUB_VERIFIED'
  seasonId: string | null
  leagueId: string | null
  teamId: string | null
  sectionId?: string | null
  competition: StatsCompetition | null
}

export interface PlayerStatsBasis {
  matchesCounted: number
  resultsWithBattingCard: number
  resultsWithBowlingCard: number
}

export interface HighestScore {
  runs: number
  notOut: boolean
}

// Innings by batting position (guessed inner shape; the average is null with no dismissals).
export interface BattingPositionStats {
  position: number
  innings: number
  runs: number
  average: number | null
}

export interface BattingCoverage {
  inningsWithBalls: number
  inningsWithBoundaries: number
  inningsCounted: number
}

export interface BattingStats {
  matches: number
  innings: number
  notOuts: number
  dismissals: number
  runs: number
  ballsFaced: number
  fours: number
  sixes: number
  ducks: number
  goldenDucks: number
  thirtyPlus: number
  fiftyPlus: number
  hundredPlus: number
  centuries: number
  halfCenturies: number
  highestScore: HighestScore | null
  // DismissalType name -> count (the how-out values of the dismissals; not-out innings are notOuts)
  dismissalModes: Record<string, number>
  positions: BattingPositionStats[]
  average: number | null
  strikeRate: number | null
  boundaryPercentage: number | null
  ballsPerBoundary: number | null
  coverage: BattingCoverage
}

export interface BestBowling {
  wickets: number
  runs: number
}

export interface BowlingCoverage {
  inningsWithWides: number
  inningsWithNoBalls: number
  inningsWithDots: number
  inningsCounted: number
}

export interface BowlingStats {
  inningsBowled: number
  ballsBowled: number
  // the distinct balls-per-over values behind the counted innings
  ballsPerOver: number[]
  mixedOverLengths: boolean
  runsConceded: number
  wickets: number
  maidens: number
  wides: number
  noBalls: number
  dots: number
  threeWicketHauls: number
  fourWicketHauls: number
  fiveWicketHauls: number
  best: BestBowling | null
  // DismissalType name -> count (bowler-credited modes)
  dismissalModes: Record<string, number>
  // wickets with no bowler attributed on the dismissal ("Not recorded")
  dismissalsNotRecorded: number
  average: number | null
  economy: number | null
  strikeRate: number | null
  dotBallPercentage: number | null
  coverage: BowlingCoverage
}

export interface FieldingStats {
  catches: number
  stumpings: number
  runOuts: number
  dismissals: number
  dismissalsPerMatch: number | null
}

export interface PlayerAwardCounts {
  playerOfTheMatch: number
  teamPlayerOfTheMatch: number
}

export interface PlayerRecord {
  won: number
  lost: number
  tied: number
  drawn: number
  internal: number
}

// Newest first. matchDate is an ISO instant.
export interface BattingFormEntry {
  matchId: string
  matchDate: string
  // null when not recorded
  runs: number | null
  notOut: boolean
  balls: number | null
}

export interface BowlingFormEntry {
  matchId: string
  matchDate: string
  wickets: number
  runs: number
  balls: number
  ballsPerOver: number
}

export interface NotCapturedItem {
  code: string
  // which tab of the breakdown page lists it
  tab: 'BATTING' | 'BOWLING' | 'FIELDING'
  label: string
  reason: string
}

export interface PlayerStats {
  playerId: string
  scope: PlayerStatsScope
  basis: PlayerStatsBasis
  batting: BattingStats
  bowling: BowlingStats
  fielding: FieldingStats
  awards: PlayerAwardCounts
  record: PlayerRecord
  form: { batting: BattingFormEntry[]; bowling: BowlingFormEntry[] }
  notCaptured: NotCapturedItem[]
}

// All under ['managed-club', clubId, 'players', playerId, 'stats', ...filters], so one prefix refreshes every filter.
export const playerStatsKey = (clubId: string, playerId: string) => ['managed-club', clubId, 'players', playerId, 'stats'] as const
export const playerStatsKeys = {
  all: playerStatsKey,
  filtered: (clubId: string, playerId: string, filters: PlayerStatsFilters = {}) =>
    [
      ...playerStatsKey(clubId, playerId),
      filters.seasonId ?? null,
      filters.leagueId ?? null,
      filters.teamId ?? null,
      filters.sectionId ?? null,
      filters.competition ?? null,
    ] as const,
}

// Only the filters that are set are sent; none is career.
function filterParams(filters: PlayerStatsFilters): Record<string, string> {
  const params: Record<string, string> = {}
  if (filters.seasonId) params.seasonId = filters.seasonId
  if (filters.leagueId) params.leagueId = filters.leagueId
  if (filters.teamId) params.teamId = filters.teamId
  if (filters.sectionId) params.sectionId = filters.sectionId
  if (filters.competition) params.competition = filters.competition
  return params
}

export async function getPlayerStats(clubId: string, playerId: string, filters: PlayerStatsFilters = {}): Promise<PlayerStats> {
  const { data } = await api.get<PlayerStats>(`/manage/clubs/${clubId}/players/${playerId}/stats`, {
    params: filterParams(filters),
  })
  return data
}

export function usePlayerStats(
  clubId: string | undefined,
  playerId: string | undefined,
  filters: PlayerStatsFilters = {},
  // keepPrevious: the breakdown page keeps the last figures on screen while a filter change loads
  options: { keepPrevious?: boolean } = {},
) {
  return useQuery({
    queryKey: playerStatsKeys.filtered(clubId as string, playerId as string, filters),
    queryFn: () => getPlayerStats(clubId as string, playerId as string, filters),
    enabled: Boolean(clubId) && Boolean(playerId),
    ...(options.keepPrevious ? { placeholderData: keepPreviousData } : {}),
  })
}

// docs/specs/103-player-stats.md decision 22: the values the player has counted appearances for, with no filter applied.
export interface PlayerStatsFilterOptions {
  seasonIds: string[]
  leagueIds: string[]
  teamIds: string[]
  // the sections of the teams the player played for (the page adds their ancestors)
  sectionIds: string[]
  competitions: StatsCompetition[]
}

export const playerStatsFilterOptionsKey = (clubId: string, playerId: string) =>
  [...playerStatsKey(clubId, playerId), 'filter-options'] as const

export async function getPlayerStatsFilterOptions(clubId: string, playerId: string): Promise<PlayerStatsFilterOptions> {
  const { data } = await api.get<PlayerStatsFilterOptions>(`/manage/clubs/${clubId}/players/${playerId}/stats/filter-options`)
  return data
}

export function usePlayerStatsFilterOptions(clubId: string | undefined, playerId: string | undefined) {
  return useQuery({
    queryKey: playerStatsFilterOptionsKey(clubId as string, playerId as string),
    queryFn: () => getPlayerStatsFilterOptions(clubId as string, playerId as string),
    enabled: Boolean(clubId) && Boolean(playerId),
  })
}
