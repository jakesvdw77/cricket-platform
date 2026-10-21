import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query'
import api from './axiosConfig'
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

export const TEAM_STATS_PAGE_SIZE = 25

// All under ['managed-club', clubId, 'team-stats', ...], so one prefix refreshes the table and (later) the team pages.
export const teamStatsKey = (clubId: string) => ['managed-club', clubId, 'team-stats'] as const
export const teamStatsKeys = {
  all: teamStatsKey,
  filterOptions: (clubId: string) => [...teamStatsKey(clubId), 'filter-options'] as const,
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

export async function getTeamStatsFilterOptions(clubId: string): Promise<TeamStatsFilterOptions> {
  const { data } = await api.get<TeamStatsFilterOptions>(`${basePath(clubId)}/filter-options`)
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

export function useTeamStatsFilterOptions(clubId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: teamStatsKeys.filterOptions(clubId as string),
    queryFn: () => getTeamStatsFilterOptions(clubId as string),
    enabled: Boolean(clubId) && enabled,
  })
}
