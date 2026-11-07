import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query'
import api from './axiosConfig'
import { myPlayersKey } from './myPlayersApi'
import type { MyResultOutcome, MyResultScope } from './meResultsApi'
import type { BattingStats, BowlingStats, FieldingStats, NotCapturedItem, PlayerAwardCounts, PlayerRecord, PlayerStats } from './playerStatsApi'
import type { DashboardBattingSummary, DashboardEconomySummary, DashboardWicketTypes, DashboardWindow } from './playerDashboardApi'
import type { LeaderboardGroup, LeaderboardPageInfo, LeaderboardTable, LeaderboardTableRow } from './leaderboardApi'
import type { TeamNetRunRateStatus, TeamStatsNotCapturedItem, TeamStatsPageData } from './teamStatsApi'
import type { TeamDashboardDotBallsSummary, TeamDashboardExtrasSummary, TeamDashboardResultsSummary } from './teamDashboardApi'

// docs/specs/147 (Player Hub stats): the held player's own statistics, team statistics and leaderboards as flip cards.
// Backend: GET /api/v1/me/players/{playerKey}/stats[/innings], /team-stats and /leaderboards/{group|standing|awards|filters}, authorised by
// the caller's own active link; the club and the player come from the held player, never the request. Only published results with
// Show In Player Hub on count. The page filters (Season, League, Team) are the Results page's `results/filters` read.
// The client computes no figure: every number below is the server's, formatted by pages/view/myPlayers/stats/statsFormat.ts.

// ===== PAYLOAD TYPES: MyStatsDto and the drill page mirror backend/.../dto/MyStatsDto.java and MyStatsInningsPageDto.java. ======
// ===== MyTeamStatsDto mirrors MyTeamStatsDto.java; the leaderboard types are still the spec's description until slice 4. Change only this block. =======

export type MyStatsAgeBand = 'ADULT' | 'UNDER_13' | 'AGE_13_17' | 'UNKNOWN'
export type MyStatsDrillKind = 'BATTING' | 'BOWLING' | 'FIELDING' | 'MATCHES'

// Names the player's own first name, opponents and bowlers as recorded by the manager, and teammates by full name (inside the Hub only).
// A figure with no valid denominator or an unrecorded value is null (a gap), never 0. Instants are ISO strings, BigDecimals numbers.

export interface MyStatsScope {
  seasonId: string | null
  leagueId: string | null
  teamId: string | null
  competition: 'LEAGUE' | 'FRIENDLY' | null
}

export interface MyStatsBasis {
  // M in "Based on N of M results".
  resultsCounted: number
  resultsWithBattingCard: number
  resultsWithBowlingCard: number
  resultsWithFieldingCard: number
  // Upcoming active matches of the player's teams in the season; null with no season chosen.
  fixturesRemaining: number | null
  // The per-match history blocks cover the newest `historyCap` matches only when this is true.
  truncated: boolean
  historyCap: number
}

export interface MyStatsSeriesInnings {
  matchId: string
  matchDate: string
  opponentName: string | null
  derby: boolean
  runs: number | null
  balls: number | null
  notOut: boolean
  howOut: string | null
}

// A slice of how the player gets out; `filter` is its BATTING drill token.
export interface MyStatsDismissal {
  type: string
  label: string
  count: number
  percent: number | null
  filter: string | null
}

export interface MyStatsTrendPoint {
  matchId: string
  matchDate: string
  opponentName: string | null
  derby: boolean
  cumulativeRuns: number
  cumulativeDismissals: number
  average: number | null
}

export interface MyStatsBowlingMatch {
  matchId: string
  matchDate: string
  opponentName: string | null
  derby: boolean
  balls: number
  ballsPerOver: number
  maidens: number
  runs: number
  wickets: number
  economy: number | null
}

export interface MyStatsSeries {
  window: DashboardWindow
  battingInnings: MyStatsSeriesInnings[]
  battingSummary: DashboardBattingSummary
  dismissals: MyStatsDismissal[]
  battingTrend: MyStatsTrendPoint[]
  bowlingMatches: MyStatsBowlingMatch[]
  wicketTypes: DashboardWicketTypes
  economySummary: DashboardEconomySummary
}

export interface MyStatsRollingPoint {
  matchId: string
  matchDate: string
  average: number | null
}

export interface MyStatsRolling {
  // The window: the last `span` innings, per batted innings, oldest first.
  span: number
  points: MyStatsRollingPoint[]
  // Null when either half is too small.
  hint: { recent: number | null; earlier: number | null; direction: 'UP' | 'DOWN' | 'FLAT' } | null
}

// The graph guide lines for the age band; they never change a counted figure.
export interface MyStatsGuides {
  low: number
  high: number
  basis: string
}

// A band of scores (key 0-9, 10-29, 30-49 or 50+); `filter` is its BATTING drill token.
export interface MyStatsBand {
  key: string
  label: string
  innings: number
  percent: number | null
  filter: string | null
}

export interface MyStatsInningsSplit {
  innings: number
  notOuts: number
  runs: number
  average: number | null
  filter: string | null
}

export interface MyStatsScore {
  matchId: string
  matchDate: string
  runs: number | null
  notOut: boolean
}

export interface MyStatsOpposition {
  opponentName: string
  innings: number
  runs: number
  average: number | null
  scores: MyStatsScore[]
}

export interface MyStatsNameCount {
  name: string
  count: number
}

export interface MyStatsPositionGroup {
  key: string
  label: string
  count: number
}

export interface MyStatsMilestone {
  current: number
  target: number
  toGo: number
}

export interface MyStatsPersonalBests {
  highestScore: { runs: number; notOut: boolean; matchId: string } | null
  bestBowling: { wickets: number; runs: number; matchId: string } | null
  mostCatches: { catches: number; matchId: string } | null
  bestStrikeRate: { strikeRate: number; runs: number; balls: number; matchId: string } | null
  minimumBalls: number
}

export interface MyStatsRecordSplit {
  matches: number
  won: number
  lost: number
  tied: number
  drawn: number
  winPercent: number | null
}

export interface MyStatsFieldSplit {
  innings: number
  dismissals: number
  runs: number
  average: number | null
}

export interface MyStatsSeason {
  seasonId: string
  label: string
  matches: number
  innings: number
  runs: number
  average: number | null
  wickets: number
}

export interface MyStatsDisciplineSpell {
  matchId: string
  matchDate: string
  opponentName: string | null
  balls: number
  ballsPerOver: number
  wides: number | null
  noBalls: number | null
}

export interface MyStatsBowlingDiscipline {
  wides: number
  noBalls: number
  widesPerOver: number | null
  noBallsPerOver: number | null
  inningsRecorded: number
  inningsCounted: number
  byInnings: MyStatsDisciplineSpell[]
}

export interface MyStatsAvailability {
  pollsTotal: number
  pollsAnswered: number
  answeredAvailable: number
  matchesSelected: number
  matchesPlayed: number
}

export interface MyStatsDto {
  scope: MyStatsScope
  playerFirstName: string | null
  ageBand: MyStatsAgeBand
  basis: MyStatsBasis
  batting: BattingStats
  bowling: BowlingStats
  fielding: FieldingStats
  awards: PlayerAwardCounts
  record: PlayerRecord
  form: PlayerStats['form']
  series: MyStatsSeries
  rolling: MyStatsRolling
  guides: MyStatsGuides
  bands: MyStatsBand[]
  byInningsNumber: { battingFirst: MyStatsInningsSplit; chasing: MyStatsInningsSplit }
  byOpposition: MyStatsOpposition[]
  dismissedBy: { bowlers: MyStatsNameCount[]; notRecorded: number; total: number }
  wicketsByPosition: { groups: MyStatsPositionGroup[]; notRecorded: number; total: number; caughtBy: MyStatsNameCount[] }
  milestones: { runs: MyStatsMilestone; wickets: MyStatsMilestone; catches: MyStatsMilestone; personalBests: MyStatsPersonalBests }
  teamRecordWhenScoring: { threshold: number; scored: MyStatsRecordSplit; notScored: MyStatsRecordSplit; scoredFilter: string | null; notScoredFilter: string | null }
  homeAway: { home: MyStatsFieldSplit; away: MyStatsFieldSplit; unknownFieldMatches: number }
  bySeason: MyStatsSeason[]
  bowlingDiscipline: MyStatsBowlingDiscipline
  availability: MyStatsAvailability
  // Null until the Team stats and Leaderboards slices (spec 147 slices 3 and 4).
  teamFielding: { catches: number; runOuts: number; stumpings: number } | null
  teamFieldingRank: number | null
  standing: { rank: number | null; playersRanked: number | null; average: number | null; innings: number | null } | null
  notCaptured: NotCapturedItem[]
}

// The match drill (GET .../stats/innings): mirrors backend/.../dto/MyStatsInningsPageDto.java. `title` and `filterLabel` are plain header
// words; only the block of the row's kind is filled (a MATCHES row fills all three where the player took part). A figure that was not
// recorded is null, never 0. Rows are newest first and cut on the server.
export interface MyStatsInningsBatting {
  // Null on a MATCHES row (the match's batting totals).
  inningsNumber: number | null
  runs: number | null
  balls: number | null
  fours: number | null
  sixes: number | null
  notOut: boolean
  howOut: string | null
  bowlerName: string | null
  strikeRate: number | null
}

export interface MyStatsInningsBowling {
  balls: number
  ballsPerOver: number
  maidens: number
  runs: number
  wickets: number
  economy: number | null
  wides: number | null
  noBalls: number | null
  dots: number | null
}

export interface MyStatsInningsFielding {
  catches: number
  stumpings: number
  runOuts: number
}

export interface MyStatsInningsRow {
  matchId: string
  matchDate: string
  opponentName: string | null
  derby: boolean
  ourTeamName: string
  // The result from the player's side.
  result: MyResultOutcome
  batting: MyStatsInningsBatting | null
  bowling: MyStatsInningsBowling | null
  fielding: MyStatsInningsFielding | null
}

export interface MyStatsInningsPage {
  kind: MyStatsDrillKind
  filter: string | null
  title: string
  filterLabel: string | null
  truncated: boolean
  page: LeaderboardPageInfo
  rows: MyStatsInningsRow[]
}

// ----- MyTeamStatsDto: mirrors backend/.../dto/MyTeamStatsDto.java field for field (slice 3). The record, batting, chasing, bowling,
// extras and net run rate blocks are the manager Team stats page's own shapes (TeamStatsPageData). A gap is null, never 0.
export type MyTeamResultCode = 'WON' | 'LOST' | 'TIED' | 'DRAWN' | 'NO_RESULT'

export interface MyTeamScope {
  seasonId: string | null
  leagueId: string | null
  teamId: string | null
  competition: 'LEAGUE' | 'FRIENDLY' | null
}

export interface MyTeamCount {
  recorded: number
  counted: number
}

export interface MyTeamCoverage {
  battingOrder: MyTeamCount
  toss: MyTeamCount
  availability: MyTeamCount
  runCards: MyTeamCount
  wicketCards: MyTeamCount
  closeMargins: MyTeamCount
}

export interface MyTeamBasis {
  // M in "Based on N of M results".
  resultsCounted: number
  internalResults: number
  resultsNoBallBowled: number
  forfeits: { received: number; conceded: number }
  resultsWithBothInnings: number
  // The history blocks cover the newest `historyCap` results only when true.
  truncated: boolean
  historyCap: number
  coverage: MyTeamCoverage
}

export interface MyTeamFormEntry {
  matchId: string
  matchDate: string | null
  opponentName: string | null
  derby: boolean
  result: MyTeamResultCode
  forfeit: boolean
}

export interface MyTeamResultPoint {
  matchId: string
  matchDate: string | null
  opponentName: string | null
  derby: boolean
  forfeit: boolean
  result: MyTeamResultCode
  ownRuns: number | null
  ownWickets: number | null
  ownBalls: number | null
  oppRuns: number | null
  oppWickets: number | null
  oppBalls: number | null
  ownRunRate: number | null
  oppRunRate: number | null
}

export interface MyTeamRunRatePoint {
  matchId: string
  matchDate: string | null
  opponentName: string | null
  teamRunRate: number | null
  oppositionRunRate: number | null
}

export interface MyTeamNetRunRatePoint {
  matchId: string
  matchDate: string | null
  opponentName: string | null
  value: number | null
}

export interface MyTeamExtrasPoint {
  matchId: string
  matchDate: string | null
  opponentName: string | null
  derby: boolean
  wides: number | null
  noBalls: number | null
  byes: number | null
  legByes: number | null
  penaltyRuns: number | null
  itemised: boolean
  notItemised: number | null
  total: number | null
}

export interface MyTeamDotBallsPoint {
  matchId: string
  matchDate: string | null
  opponentName: string | null
  derby: boolean
  ballsBowled: number | null
  dots: number | null
  dotPercent: number | null
}

export interface MyTeamSeries {
  window: DashboardWindow
  results: MyTeamResultPoint[]
  resultsSummary: TeamDashboardResultsSummary
  runRateTrend: MyTeamRunRatePoint[]
  netRunRateTrend: { status: TeamNetRunRateStatus; points: MyTeamNetRunRatePoint[] | null }
  // The extras the team gave away, by match (the Extras card's back).
  extrasConceded: MyTeamExtrasPoint[]
  extrasSummary: TeamDashboardExtrasSummary
  dotBalls: MyTeamDotBallsPoint[]
  dotBallsSummary: TeamDashboardDotBallsSummary
}

export interface MyTeamShareLine {
  // PLAYER (full name), GUESTS, OTHERS, EXTRAS (runs only) or NOT_ATTRIBUTED; they add up to `total`.
  kind: 'PLAYER' | 'GUESTS' | 'OTHERS' | 'EXTRAS' | 'NOT_ATTRIBUTED'
  label: string
  value: number
  sharePercent: number | null
}

export interface MyTeamShareBlock {
  total: number | null
  lines: MyTeamShareLine[]
  inningsWithCard: number
  inningsCounted: number
}

export interface MyTeamSplit {
  played: number
  won: number
}

export interface MyTeamMeeting {
  matchId: string
  matchDate: string | null
  result: MyTeamResultCode
  forfeit: boolean
}

export interface MyTeamHeadToHead {
  // Null: no opponent name recorded.
  opponentName: string | null
  played: number
  won: number
  lost: number
  tied: number
  drawn: number
  noResult: number
  // Oldest first.
  results: MyTeamMeeting[]
}

export interface MyTeamExtrasComponent {
  value: number | null
  inningsRecorded: number
  inningsCounted: number
}

export interface MyTeamExtrasSide {
  total: number | null
  sharePercent: number | null
  wides: MyTeamExtrasComponent
  noBalls: MyTeamExtrasComponent
  byes: MyTeamExtrasComponent
  legByes: MyTeamExtrasComponent
  penaltyRuns: MyTeamExtrasComponent
  inningsWithExtras: number
  inningsCounted: number
}

export interface MyTeamStatsDto {
  scope: MyTeamScope
  teamName: string
  basis: MyTeamBasis
  record: TeamStatsPageData['record']
  form: MyTeamFormEntry[]
  batting: TeamStatsPageData['batting']
  chasing: TeamStatsPageData['chasing']
  bowling: TeamStatsPageData['bowling']
  extras: TeamStatsPageData['extras']
  netRunRate: TeamStatsPageData['netRunRate']
  series: MyTeamSeries
  contribution: { runs: MyTeamShareBlock; wickets: MyTeamShareBlock }
  battingOrder: { battingFirst: MyTeamSplit; chasing: MyTeamSplit; recorded: number; counted: number }
  // `won` is null when no result recorded the toss; `partly` when only some did (`known` of `counted`).
  tossWon: { won: number | null; known: number; counted: number; partly: boolean }
  headToHead: MyTeamHeadToHead[]
  // averageAvailable is null without a poll.
  squad: { playersUsed: number; guestAppearances: number; averageAvailable: number | null; matchesWithPoll: number; counted: number; partly: boolean }
  closeGames: { played: number; won: number; closeRuns: number; closeWickets: number; decided: number; withMargin: number }
  extrasCard: { gaveAway: MyTeamExtrasSide; received: MyTeamExtrasSide; partly: boolean }
  notCaptured: TeamStatsNotCapturedItem[]
}

export interface MyLeaderboardColumn {
  code: string
  label: string
  longLabel?: string
  sortable: boolean
  direction: 'HIGHEST' | 'LOWEST'
  minimumKind: 'NONE' | 'INNINGS' | 'OVERS'
  // Folded behind the More Columns toggle (a server constant).
  more: boolean
}

export interface MyLeaderboardRow extends LeaderboardTableRow {
  // True for the held player's own row.
  mine: boolean
}

export interface MyLeaderboardTable extends Omit<LeaderboardTable, 'columns' | 'rows'> {
  columns: MyLeaderboardColumn[]
  rows: MyLeaderboardRow[]
  // The held player's row and rank even when not on the returned page; null with no figure in scope.
  me: (MyLeaderboardRow & { page: number }) | null
}

export interface MyStanding {
  // The rank in each headline column within the reach, with the number of players listed and the sample behind it.
  rows: { code: string; label: string; rank: number | null; of: number; sample: string | null; figure: number | null }[]
  minimumNote: string | null
  basis: { resultsCounted: number; playersListed: number }
}

export interface MyBoardsFilters {
  currentSeasonId?: string | null
  seasons: { id: string; name: string }[]
  leagues: { id: string; name: string }[]
  teams: { id: string; name: string }[]
  combos: { seasonId: string; leagueId: string | null; teamId: string }[]
}
// ===== END PAYLOAD TYPES ===========================================================================================================

export type MyLeaderboardGroup = Exclude<Lowercase<LeaderboardGroup>, 'awards'>
export type MyLeaderboardDirection = 'asc' | 'desc'

export interface MyLeaderboardParams {
  sort?: string | null
  direction?: MyLeaderboardDirection | null
  minimum?: number | null
}

export const MY_STATS_INNINGS_PAGE_SIZE = 20
export const MY_LEADERBOARD_PAGE_SIZE = 25

const scopeParams = (scope: MyResultScope) => ({
  ...(scope.seasonId ? { seasonId: scope.seasonId } : {}),
  ...(scope.teamId ? { teamId: scope.teamId } : {}),
  ...(scope.leagueId ? { leagueId: scope.leagueId } : {}),
  ...(scope.competition ? { competition: scope.competition } : {}),
})

// Everything is under ['me', 'players', key, ...], so unlinking a player or a key change refreshes it with the rest of the Hub.
export const myStatsKey = (key: string | undefined) => [...myPlayersKey, key, 'stats'] as const
export const myTeamStatsKey = (key: string | undefined) => [...myPlayersKey, key, 'team-stats'] as const
export const myLeaderboardsKey = (key: string | undefined) => [...myPlayersKey, key, 'leaderboards'] as const

export async function getMyStats(key: string, scope: MyResultScope): Promise<MyStatsDto> {
  const { data } = await api.get<MyStatsDto>(`/me/players/${key}/stats`, { params: scopeParams(scope) })
  return data
}

export async function getMyStatsInnings(key: string, kind: MyStatsDrillKind, filter: string | null, scope: MyResultScope, page: number): Promise<MyStatsInningsPage> {
  const { data } = await api.get<MyStatsInningsPage>(`/me/players/${key}/stats/innings`, {
    params: { kind, ...(filter ? { filter } : {}), ...scopeParams(scope), page, size: MY_STATS_INNINGS_PAGE_SIZE },
  })
  return data
}

export async function getMyTeamStats(key: string, scope: MyResultScope): Promise<MyTeamStatsDto> {
  const { data } = await api.get<MyTeamStatsDto>(`/me/players/${key}/team-stats`, { params: scopeParams(scope) })
  return data
}

export async function getMyLeaderboard(key: string, group: MyLeaderboardGroup, scope: MyResultScope, options: MyLeaderboardParams, page: number): Promise<MyLeaderboardTable> {
  const { data } = await api.get<MyLeaderboardTable>(`/me/players/${key}/leaderboards/${group}`, {
    params: {
      ...scopeParams(scope),
      ...(options.sort ? { sort: options.sort } : {}),
      ...(options.direction ? { direction: options.direction } : {}),
      ...(options.minimum !== undefined && options.minimum !== null ? { minimum: options.minimum } : {}),
      page,
      size: MY_LEADERBOARD_PAGE_SIZE,
    },
  })
  return data
}

export async function getMyStanding(key: string, scope: MyResultScope): Promise<MyStanding> {
  const { data } = await api.get<MyStanding>(`/me/players/${key}/leaderboards/standing`, { params: scopeParams(scope) })
  return data
}

export async function getMyBoardsFilters(key: string): Promise<MyBoardsFilters> {
  const { data } = await api.get<MyBoardsFilters>(`/me/players/${key}/leaderboards/filters`)
  return data
}

// The My stats page's one payload; every card reads it. Kept while a filter change loads so the cards do not jump.
export function useMyStats(key: string | undefined, scope: MyResultScope, enabled = true) {
  return useQuery({
    queryKey: [...myStatsKey(key), scopeParams(scope)],
    queryFn: () => getMyStats(key as string, scope),
    placeholderData: keepPreviousData,
    retry: false,
    enabled: Boolean(key) && enabled,
  })
}

// The match drill behind a tile: more rows are asked of the server (never sliced in the browser) and flattened by the caller.
export function useMyStatsInnings(key: string | undefined, kind: MyStatsDrillKind, filter: string | null, scope: MyResultScope, enabled = true) {
  return useInfiniteQuery({
    queryKey: [...myStatsKey(key), 'innings', kind, filter, scopeParams(scope)],
    queryFn: ({ pageParam }) => getMyStatsInnings(key as string, kind, filter, scope, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last) => (last.page.hasMore ? last.page.number + 1 : undefined),
    placeholderData: keepPreviousData,
    retry: false,
    enabled: Boolean(key) && enabled,
  })
}

// The Team stats page's one payload; the scope's teamId is required (and must be one of the player's teams).
export function useMyTeamStats(key: string | undefined, scope: MyResultScope, enabled = true) {
  return useQuery({
    queryKey: [...myTeamStatsKey(key), scopeParams(scope)],
    queryFn: () => getMyTeamStats(key as string, scope),
    placeholderData: keepPreviousData,
    retry: false,
    enabled: Boolean(key) && Boolean(scope.teamId) && enabled,
  })
}

// A standings table, page by page (Show More); sort and direction are the server's.
export function useMyLeaderboard(key: string | undefined, group: MyLeaderboardGroup, scope: MyResultScope, options: MyLeaderboardParams = {}, enabled = true) {
  return useInfiniteQuery({
    queryKey: [...myLeaderboardsKey(key), group, scopeParams(scope), options.sort ?? null, options.direction ?? null, options.minimum ?? null],
    queryFn: ({ pageParam }) => getMyLeaderboard(key as string, group, scope, options, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last) => (last.page.hasMore ? last.page.number + 1 : undefined),
    placeholderData: keepPreviousData,
    retry: false,
    enabled: Boolean(key) && enabled,
  })
}

// The "Where Sam stands" card payload.
export function useMyStanding(key: string | undefined, scope: MyResultScope, enabled = true) {
  return useQuery({
    queryKey: [...myLeaderboardsKey(key), 'standing', scopeParams(scope)],
    queryFn: () => getMyStanding(key as string, scope),
    placeholderData: keepPreviousData,
    retry: false,
    enabled: Boolean(key) && enabled,
  })
}

// The Season, League and Team options inside the leaderboard reach (wider than the player's own Results options).
export function useMyBoardsFilters(key: string | undefined, enabled = true) {
  return useQuery({
    queryKey: [...myLeaderboardsKey(key), 'filters'],
    queryFn: () => getMyBoardsFilters(key as string),
    retry: false,
    enabled: Boolean(key) && enabled,
  })
}
