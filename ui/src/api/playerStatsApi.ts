import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query'
import api from './axiosConfig'
import { statsFilterParams } from './statsFilterParams'
import type { DismissalType } from './matchResultApi'

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
export function filterParams(filters: PlayerStatsFilters): Record<string, string> {
  return statsFilterParams({ ...filters })
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

// docs/specs/115-player-match-list.md: one page of the player's counted matches (GET .../players/{playerId}/stats/matches).
// Every figure and status is decided on the server (PlayerMatchRowBuilder); the client formats only. Overs are balls.
export type PlayerMatchResultCode = 'WON' | 'LOST' | 'TIED' | 'DRAWN' | 'NO_RESULT' | 'ABANDONED' | 'INTERNAL'
export type PlayerMatchBattingStatus = 'NO_CARD' | 'DID_NOT_BAT' | 'BATTED'
export type PlayerMatchBowlingStatus = 'NO_CARD' | 'DID_NOT_BOWL' | 'BOWLED'
export type PlayerMatchFieldingStatus = 'NO_CARD' | 'RECORDED'

export interface PlayerMatchOurTeam {
  // HOME or AWAY
  side: string
  // null when the side is a free-text name
  teamId: string | null
  teamName: string
}

export interface PlayerMatchInnings {
  runs: number | null
  // null when not recorded (or the balls = 0, runs > 0 case)
  balls: number | null
  notOut: boolean
  howOut: DismissalType | null
  fours: number | null
  sixes: number | null
}

export interface PlayerMatchBatting {
  status: PlayerMatchBattingStatus
  // figures present only when status = BATTED
  innings?: PlayerMatchInnings[] | null
  inningsCount?: number | null
  runs?: number | null
  ballsFaced?: number | null
  fours?: number | null
  sixes?: number | null
}

export interface PlayerMatchSpell {
  balls: number
  maidens: number
  runs: number
  wickets: number
  dots: number | null
  wides: number | null
  noBalls: number | null
}

export interface PlayerMatchBowling {
  status: PlayerMatchBowlingStatus
  // figures present only when status = BOWLED
  spells?: PlayerMatchSpell[] | null
  balls?: number | null
  maidens?: number | null
  runs?: number | null
  wickets?: number | null
  dots?: number | null
}

export interface PlayerMatchFielding {
  status: PlayerMatchFieldingStatus
  catches?: number | null
  stumpings?: number | null
  runOuts?: number | null
}

export interface PlayerMatchRow {
  matchId: string
  resultId: string
  // ISO instant
  matchDate: string
  ourTeams: PlayerMatchOurTeam[]
  // null for a derby
  opponentName: string | null
  derby: boolean
  leagueId: string | null
  leagueName: string | null
  competition: StatsCompetition
  result: PlayerMatchResultCode
  ballsPerOver: number
  hasBattingCard: boolean
  hasBowlingCard: boolean
  batting: PlayerMatchBatting
  bowling: PlayerMatchBowling
  fielding: PlayerMatchFielding
  awards: PlayerAwardCounts
}

export interface PlayerMatchList {
  playerId: string
  scope: PlayerStatsScope
  page: { number: number; size: number; totalElements: number; hasMore: boolean }
  rows: PlayerMatchRow[]
}

export type MatchDirection = 'asc' | 'desc'
export const PLAYER_MATCHES_PAGE_SIZE = 20

export async function getPlayerMatches(
  clubId: string,
  playerId: string,
  filters: PlayerStatsFilters,
  direction: MatchDirection,
  page: number,
  size = PLAYER_MATCHES_PAGE_SIZE,
): Promise<PlayerMatchList> {
  const { data } = await api.get<PlayerMatchList>(`/manage/clubs/${clubId}/players/${playerId}/stats/matches`, {
    params: { ...filterParams(filters), direction, page, size },
  })
  return data
}

// Show more asks the server for the next page and the pages are flattened here; rows are never sliced in the browser.
// Under the stats prefix, so an unpublish or guest link that refreshes the stats refreshes this too.
export function usePlayerMatches(
  clubId: string | undefined,
  playerId: string | undefined,
  filters: PlayerStatsFilters,
  direction: MatchDirection,
) {
  const query = useInfiniteQuery({
    queryKey: [
      ...playerStatsKey(clubId as string, playerId as string),
      'matches',
      {
        seasonId: filters.seasonId ?? null,
        leagueId: filters.leagueId ?? null,
        teamId: filters.teamId ?? null,
        sectionId: filters.sectionId ?? null,
        competition: filters.competition ?? null,
      },
      direction,
    ],
    queryFn: ({ pageParam }) => getPlayerMatches(clubId as string, playerId as string, filters, direction, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last) => (last.page.hasMore ? last.page.number + 1 : undefined),
    enabled: Boolean(clubId) && Boolean(playerId),
    placeholderData: keepPreviousData,
  })
  const pages = query.data?.pages ?? []
  return {
    ...query,
    firstPage: pages[0],
    lastPage: pages[pages.length - 1],
    rows: pages.flatMap((page) => page.rows),
  }
}
