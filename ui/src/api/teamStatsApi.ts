import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query'
import api from './axiosConfig'
import { statsFilterParams } from './statsFilterParams'
import type { LeaderboardPageInfo, SortDirection } from './leaderboardApi'

// docs/specs/116-team-stats.md ("API Contract", "The table (TeamStatsTableDto)"): the Teams table and its filter options. Every
// figure, rank and tie-break is decided by the server (TeamStatsCalculator, TeamTableRanker); this file only types the responses.
// The shapes mirror TeamStatsTableDto and TeamStatsFilterOptionsDto.

export type TeamStatsCompetition = 'LEAGUE' | 'FRIENDLY'

export type TeamStatsMinimumKind = 'NONE' | 'MATCHES'

// One column of the table, in display order; `code` is also the lower-case sort code.
export interface TeamStatsColumn {
  code: string
  label: string
  longLabel?: string
  sortable: boolean
  direction: 'HIGHEST' | 'LOWEST'
  minimumKind: TeamStatsMinimumKind
  // the heading's help text (the NRR rule)
  help?: string | null
}

export type TeamNetRunRateStatus = 'SHOWN' | 'NOT_ONE_COMPETITION' | 'NO_USABLE_RESULTS'

// One cell: `value` is a plain number or null; the highest total also carries runs and wickets, net run rate its status.
export interface TeamStatsCell {
  value: number | null
  runs?: number | null
  wickets?: number | null
  status?: TeamNetRunRateStatus | null
  rule?: string | null
  matchesUsed?: number | null
  matchesCounted?: number | null
}

export interface TeamStatsTableRow {
  // null for the unranked group
  rank: number | null
  teamId: string
  teamName: string
  sectionName: string | null
  active: boolean
  // keyed by column code
  values: Record<string, TeamStatsCell | undefined>
}

export interface TeamStatsTableBasis {
  resultsCounted: number
  internalResults: number
  resultsNoBallBowled: number
  forfeits: number
  teamsListed: number
  teamsRanked: number
  belowMinimum: number
}

export interface TeamStatsTable {
  columns: TeamStatsColumn[]
  sort: { code: string; direction: 'HIGHEST' | 'LOWEST' }
  scope: { kind: 'CLUB_VERIFIED'; seasonId: string | null; leagueId: string | null; sectionId: string | null; competition: TeamStatsCompetition | null }
  minimum: { applies: boolean; value: number | null; unit: 'MATCHES' }
  basis: TeamStatsTableBasis
  page: LeaderboardPageInfo
  rows: TeamStatsTableRow[]
}

export interface TeamStatsFilterOptions {
  seasonIds: string[]
  leagueIds: string[]
  sectionIds: string[]
  competitions: string[]
}

export interface TeamStatsTableParams {
  seasonId?: string | null
  leagueId?: string | null
  sectionId?: string | null
  competition?: TeamStatsCompetition | null
  sort: string
  direction: SortDirection | null
  minimum: number | null
}

// docs/specs/116-team-stats.md ("The team page (TeamStatsDto)"): one team's full statistics. Mirrors TeamStatsDto; every figure
// is the server's (TeamStatsCalculator), null where it is not defined.
export interface TeamStatsMatchRef {
  matchId: string
  matchDate: string | null
  opponentName: string | null
}

export interface TeamStatsExtrasCoverage {
  inningsRecorded: number
  inningsCounted: number
}

export interface TeamStatsTotal extends TeamStatsMatchRef {
  runs: number
  wickets: number
  allOut: boolean
}

export type TeamFormResult = 'WON' | 'LOST' | 'TIED' | 'DRAWN' | 'NO_RESULT'

export interface TeamFormItem {
  matchId: string
  resultId: string
  matchDate: string | null
  opponentName: string | null
  derby: boolean
  result: TeamFormResult
  forfeit: boolean
}

export interface TeamStatsNotCapturedItem {
  code: string
  label: string
  reason: string
}

export interface TeamStatsRecord {
  played: number
  won: number
  lost: number
  tied: number
  drawn: number
  noResult: number
  decisive: number
  winPercent: number | null
}

export interface TeamStatsNetRunRate {
  status: TeamNetRunRateStatus
  value: number | null
  rule: string
  matchesUsed: number
  matchesCounted: number
  leagueId: string | null
  seasonId: string | null
}

export interface TeamStatsPageData {
  teamId: string
  teamName: string
  sectionId: string | null
  active: boolean
  scope: { kind: 'CLUB_VERIFIED'; seasonId: string | null; leagueId: string | null; competition: TeamStatsCompetition | null }
  basis: {
    resultsCounted: number
    internalResults: number
    resultsNoBallBowled: number
    forfeits: { received: number; conceded: number }
    resultsWithBothInnings: number
  }
  record: TeamStatsRecord
  form: TeamFormItem[]
  batting: {
    runs: number | null
    wicketsLost: number | null
    innings: number
    runsPerInnings: number | null
    battingAverage: number | null
    runRate: number | null
    ballsFaced: number | null
    highestTotal: TeamStatsTotal | null
    lowestTotal: TeamStatsTotal | null
    coverage: { inningsUsable: number; inningsCounted: number; inningsClassifiable: number }
  }
  chasing: {
    highestSuccessfulChase: (TeamStatsMatchRef & { runs: number; target: number; wickets: number }) | null
    largestVictoryByRuns: (TeamStatsMatchRef & { margin: number }) | null
    largestVictoryByWickets: (TeamStatsMatchRef & { margin: number; ballsRemaining: number | null }) | null
  }
  bowling: {
    wicketsTaken: number | null
    runsConceded: number | null
    ballsBowled: number | null
    bowlingAverage: number | null
    economy: number | null
    coverage: { inningsUsable: number; inningsCounted: number }
  }
  extras: {
    conceded: number | null
    averagePerMatch: number | null
    wides: number | null
    noBalls: number | null
    byes: number | null
    legByes: number | null
    penaltyRuns: number | null
    // innings that recorded the total / each component, of the opposition innings counted
    coverage: { inningsWithExtras: number; inningsCounted: number }
    componentCoverage: Record<'wides' | 'noBalls' | 'byes' | 'legByes' | 'penaltyRuns', TeamStatsExtrasCoverage>
  }
  netRunRate: TeamStatsNetRunRate
  notCaptured: TeamStatsNotCapturedItem[]
}

export interface TeamStatsPageFilters {
  seasonId?: string | null
  leagueId?: string | null
  competition?: TeamStatsCompetition | null
}

export const TEAM_STATS_PAGE_SIZE = 25

// All under ['managed-club', clubId, 'team-stats', ...], so one prefix refreshes the table and (later) the team pages.
export const teamStatsKey = (clubId: string) => ['managed-club', clubId, 'team-stats'] as const
export const teamStatsKeys = {
  all: teamStatsKey,
  filterOptions: (clubId: string, teamId?: string) =>
    (teamId ? [...teamStatsKey(clubId), 'filter-options', teamId] : [...teamStatsKey(clubId), 'filter-options']) as readonly string[],
  team: (clubId: string, teamId: string, filters: TeamStatsPageFilters) =>
    [...teamStatsKey(clubId), 'team', teamId, { seasonId: filters.seasonId ?? null, leagueId: filters.leagueId ?? null, competition: filters.competition ?? null }] as const,
  table: (clubId: string, params: TeamStatsTableParams) =>
    [
      ...teamStatsKey(clubId),
      'table',
      params.sort,
      params.direction,
      params.seasonId ?? null,
      params.leagueId ?? null,
      params.sectionId ?? null,
      params.competition ?? null,
      params.minimum,
    ] as const,
}

const basePath = (clubId: string) => `/manage/clubs/${clubId}/team-stats`

export async function getTeamStatsTable(clubId: string, params: TeamStatsTableParams, page: number, size: number): Promise<TeamStatsTable> {
  const query: Record<string, string | number> = { sort: params.sort, page, size }
  if (params.seasonId) query.seasonId = params.seasonId
  if (params.leagueId) query.leagueId = params.leagueId
  if (params.sectionId) query.sectionId = params.sectionId
  if (params.competition) query.competition = params.competition
  // Absent means the column's natural direction / no minimum.
  if (params.direction) query.direction = params.direction
  if (params.minimum !== null) query.minimum = params.minimum
  const { data } = await api.get<TeamStatsTable>(basePath(clubId), { params: query })
  return data
}

// teamId (optional) narrows every list to that team's own counted results (the team page); absent = the whole club.
export async function getTeamStatsFilterOptions(clubId: string, teamId?: string): Promise<TeamStatsFilterOptions> {
  const { data } = await api.get<TeamStatsFilterOptions>(`${basePath(clubId)}/filter-options`, { params: teamId ? { teamId } : undefined })
  return data
}

// The Teams table, page by page: Show more asks the server for the next page and the pages are flattened here. Rows are never
// sliced in the browser (docs/standards/frontend.md).
export function useTeamStatsTable(clubId: string | undefined, params: TeamStatsTableParams, enabled = true) {
  const query = useInfiniteQuery({
    queryKey: teamStatsKeys.table(clubId as string, params),
    queryFn: ({ pageParam }) => getTeamStatsTable(clubId as string, params, pageParam, TEAM_STATS_PAGE_SIZE),
    initialPageParam: 0,
    getNextPageParam: (last) => (last.page.hasMore ? last.page.number + 1 : undefined),
    enabled: Boolean(clubId) && enabled,
    placeholderData: keepPreviousData,
  })
  const pages = query.data?.pages ?? []
  return {
    ...query,
    // the first page carries columns, sort, scope, minimum and basis; the last carries the running paging totals
    firstPage: pages[0],
    lastPage: pages[pages.length - 1],
    rows: pages.flatMap((page) => page.rows),
  }
}

export function useTeamStatsFilterOptions(clubId: string | undefined, enabled = true, teamId?: string) {
  return useQuery({
    queryKey: teamStatsKeys.filterOptions(clubId as string, teamId),
    queryFn: () => getTeamStatsFilterOptions(clubId as string, teamId),
    enabled: Boolean(clubId) && enabled,
  })
}

export async function getTeamStats(clubId: string, teamId: string, filters: TeamStatsPageFilters): Promise<TeamStatsPageData> {
  const { data } = await api.get<TeamStatsPageData>(`/manage/clubs/${clubId}/teams/${teamId}/stats`, { params: statsFilterParams({ ...filters }) })
  return data
}

// One team's page. keepPrevious keeps the last figures on screen while a filter change loads.
export function useTeamStats(
  clubId: string | undefined,
  teamId: string | undefined,
  filters: TeamStatsPageFilters = {},
  options: { keepPrevious?: boolean; enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: teamStatsKeys.team(clubId as string, teamId as string, filters),
    queryFn: () => getTeamStats(clubId as string, teamId as string, filters),
    enabled: Boolean(clubId) && Boolean(teamId) && (options.enabled ?? true),
    ...(options.keepPrevious ? { placeholderData: keepPreviousData } : {}),
  })
}
