import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query'
import api from './axiosConfig'

// docs/specs/103-player-stats.md ("API Contract (leaderboards)"): the leaderboard catalogue, one board page by page, the
// awards view and the club-wide filter options. Every figure, rank and tie-break is decided by the server; this file only
// types the responses. The shapes mirror the backend DTOs (LeaderboardCatalogueDto, the standings table response, AwardsViewDto,
// LeaderboardFilterOptionsDto) exactly.

export type LeaderboardGroup = 'BATTING' | 'BOWLING' | 'FIELDING' | 'AWARDS'

export type MinimumKind = 'NONE' | 'INNINGS' | 'OVERS'

// One catalogue entry, also echoed on every board page and awards category.
export interface LeaderboardBoardInfo {
  code: string
  group: LeaderboardGroup
  label: string
  figureLabel: string
  direction: 'HIGHEST' | 'LOWEST'
  minimumKind: MinimumKind
  // the help text, which states the tie-breaks
  help: string
  // a club may pick this board as an award category
  awardEligible: boolean
  // one of the nine headline categories
  awardDefault: boolean
}

// One tab of the board selector, with its boards in display order.
export interface LeaderboardCatalogueGroup {
  group: LeaderboardGroup
  label: string
  // lower-case route segment of the standings table (batting, bowling, fielding); null on Awards
  code: string | null
  // the column code sorted by default (empty on Awards)
  defaultSort: string | null
  // the awards categories (and the chooser) still read the boards
  boards: LeaderboardBoardInfo[]
  // the table columns of a standings group, in display order (empty on the Awards group)
  columns: LeaderboardColumn[]
}

// One column of a standings table (decision 26); `code` is also the lower-case sort code.
export interface LeaderboardColumn {
  code: string
  label: string
  // the full name, used by the Sort by select (the table heading keeps the short label)
  longLabel?: string
  sortable: boolean
  direction: 'HIGHEST' | 'LOWEST'
  minimumKind: MinimumKind
}

export interface LeaderboardCatalogue {
  groups: LeaderboardCatalogueGroup[]
}

export const catalogueBoards = (catalogue: LeaderboardCatalogue | undefined): LeaderboardBoardInfo[] =>
  (catalogue?.groups ?? []).flatMap((group) => group.boards)

export interface LeaderboardFilters {
  seasonId?: string | null
  leagueId?: string | null
  teamId?: string | null
  sectionId?: string | null
}

export interface LeaderboardScope extends LeaderboardFilters {
  kind: 'CLUB_VERIFIED'
}

export interface HighestScoreFigure {
  runs: number
  notOut: boolean
}

export interface BestBowlingFigure {
  wickets: number
  runs: number
}

// A number, `{ wickets, runs }` (best bowling), `{ runs, notOut }` (highest score), or null for the unranked group.
export type LeaderboardFigure = number | BestBowlingFigure | HighestScoreFigure | null

// The sample behind a rate figure. Batting boards set innings and ballsFaced; bowling boards set balls, overs (null when over
// lengths are mixed), ballsPerOver (null when mixed) and wickets. The rest are null.
export interface LeaderboardSample {
  innings: number | null
  ballsFaced: number | null
  balls: number | null
  overs: number | null
  ballsPerOver: number | null
  wickets: number | null
}

export function isBowlingSample(sample: LeaderboardSample): boolean {
  return sample.balls !== null && sample.balls !== undefined
}

// The match behind a single-innings board row; matchDate is an ISO instant.
export interface LeaderboardRowDetail {
  matchId: string
  matchDate: string
  opponent: string | null
}

export interface LeaderboardRow {
  // null for the unranked group
  rank: number | null
  playerId: string
  firstName: string
  lastName: string
  active: boolean
  figure: LeaderboardFigure
  matches: number
  // batting innings on batting boards, bowling innings on bowling boards, null on fielding and awards
  innings: number | null
  sample: LeaderboardSample | null
  smallSample: boolean
  detail: LeaderboardRowDetail | null
}

export interface LeaderboardMinimum {
  applies: boolean
  // null = no minimum
  value: number | null
  suggestedDefault: number | null
  unit: MinimumKind
}

// Innings that recorded the figure out of innings counted; set only for boards built on optional columns.
export interface LeaderboardCoverage {
  used: number
  counted: number
}

export interface LeaderboardBasis {
  resultsCounted: number
  playersListed: number
  playersRanked: number
  belowMinimum: number
  coverage: LeaderboardCoverage | null
}

export interface LeaderboardPageInfo {
  number: number
  size: number
  totalElements: number
  hasMore: boolean
}

// One cell of a standings row: `value` for plain numbers, runs + notOut for highest score, wickets + runs for best bowling.
// Everything is null when the figure is not defined.
export interface LeaderboardCell {
  value: number | null
  runs: number | null
  wickets: number | null
  notOut: boolean | null
  // the bowling overs cell only: balls bowled and balls per over (null when over lengths are mixed)
  balls?: number | null
  ballsPerOver?: number | null
}

export interface LeaderboardTableRow {
  // null for the unranked group
  rank: number | null
  playerId: string
  firstName: string
  lastName: string
  active: boolean
  teamName: string | null
  smallSample: boolean
  // keyed by column code
  values: Record<string, LeaderboardCell | undefined>
}

export interface LeaderboardTable {
  group: LeaderboardGroup
  columns: LeaderboardColumn[]
  sort: { code: string; direction: 'HIGHEST' | 'LOWEST' }
  scope: LeaderboardScope
  minimum: LeaderboardMinimum
  basis: LeaderboardBasis
  page: LeaderboardPageInfo
  rows: LeaderboardTableRow[]
}

// The requested sort direction; absent means the column's natural direction.
export type SortDirection = 'asc' | 'desc'

export const STANDINGS_GROUPS = ['batting', 'bowling', 'fielding'] as const
export type StandingsGroup = (typeof STANDINGS_GROUPS)[number]
export const DEFAULT_SORT: Record<StandingsGroup, string> = { batting: 'runs', bowling: 'wickets', fielding: 'total' }

export interface AwardsMinimums {
  // the values used
  innings: number
  overs: number
  defaultInnings: number
  defaultOvers: number
}

export interface AwardsBasis {
  resultsCounted: number
  playersConsidered: number
}

// A leader is the same row shape as a board row (a tie gives joint winners).
export interface AwardsCategory {
  board: LeaderboardBoardInfo
  leaders: LeaderboardRow[]
}

// A category nobody qualified for, with the reason ("No bowler reached the minimum overs").
export interface AwardsOmission {
  board: LeaderboardBoardInfo
  reason: string
}

export interface AwardsView {
  scope: LeaderboardScope
  basis: AwardsBasis
  minimums: AwardsMinimums
  categories: AwardsCategory[]
  omitted: AwardsOmission[]
}

export interface LeaderboardFilterOptions {
  seasonIds: string[]
  leagueIds: string[]
  teamIds: string[]
  sectionIds: string[]
  competitions: string[]
}

// All under ['managed-club', clubId, 'leaderboards', ...], so one prefix refreshes every board and the awards view.
export const leaderboardsKey = (clubId: string) => ['managed-club', clubId, 'leaderboards'] as const
export const leaderboardKeys = {
  all: leaderboardsKey,
  catalogue: (clubId: string) => [...leaderboardsKey(clubId), 'catalogue'] as const,
  filterOptions: (clubId: string) => [...leaderboardsKey(clubId), 'filter-options'] as const,
  awardsAll: (clubId: string) => [...leaderboardsKey(clubId), 'awards'] as const,
  awards: (clubId: string, filters: LeaderboardFilters, minimumInnings: number | null, minimumOvers: number | null) =>
    [...leaderboardsKey(clubId), 'awards', filters.seasonId ?? null, filters.leagueId ?? null, filters.teamId ?? null, filters.sectionId ?? null, minimumInnings, minimumOvers] as const,
  table: (clubId: string, group: string, sort: string, direction: SortDirection | null, filters: LeaderboardFilters, minimum: number | null) =>
    [...leaderboardsKey(clubId), 'table', group, sort, direction, filters.seasonId ?? null, filters.leagueId ?? null, filters.teamId ?? null, filters.sectionId ?? null, minimum] as const,
}

// Only the filters that are set are sent; none is all time.
function filterParams(filters: LeaderboardFilters): Record<string, string> {
  const params: Record<string, string> = {}
  if (filters.seasonId) params.seasonId = filters.seasonId
  if (filters.leagueId) params.leagueId = filters.leagueId
  if (filters.teamId) params.teamId = filters.teamId
  if (filters.sectionId) params.sectionId = filters.sectionId
  return params
}

const basePath = (clubId: string) => `/manage/clubs/${clubId}/leaderboards`

export async function getLeaderboardCatalogue(clubId: string): Promise<LeaderboardCatalogue> {
  const { data } = await api.get<LeaderboardCatalogue>(basePath(clubId))
  return data
}

export async function getLeaderboardTable(
  clubId: string,
  group: StandingsGroup,
  sort: string,
  direction: SortDirection | null,
  filters: LeaderboardFilters,
  minimum: number | null,
  page: number,
  size: number,
): Promise<LeaderboardTable> {
  const params: Record<string, string | number> = { ...filterParams(filters), sort, page, size }
  // Absent means the column's natural direction.
  if (direction) params.direction = direction
  // Absent means no minimum (the opposite of the awards route).
  if (minimum !== null) params.minimum = minimum
  const { data } = await api.get<LeaderboardTable>(`${basePath(clubId)}/${group}`, { params })
  return data
}

export async function getAwardsView(
  clubId: string,
  filters: LeaderboardFilters,
  minimumInnings: number | null,
  minimumOvers: number | null,
): Promise<AwardsView> {
  const params: Record<string, string | number> = { ...filterParams(filters) }
  // Absent means the filter-aware defaults, echoed in the response.
  if (minimumInnings !== null) params.minimumInnings = minimumInnings
  if (minimumOvers !== null) params.minimumOvers = minimumOvers
  const { data } = await api.get<AwardsView>(`${basePath(clubId)}/awards`, { params })
  return data
}

export async function getLeaderboardFilterOptions(clubId: string): Promise<LeaderboardFilterOptions> {
  const { data } = await api.get<LeaderboardFilterOptions>(`${basePath(clubId)}/filter-options`)
  return data
}

export function useLeaderboardCatalogue(clubId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: leaderboardKeys.catalogue(clubId as string),
    queryFn: () => getLeaderboardCatalogue(clubId as string),
    enabled: Boolean(clubId) && enabled,
    staleTime: 10 * 60 * 1000,
  })
}

export const LEADERBOARD_PAGE_SIZE = 10

// One standings table, page by page: Show more asks the server for the next page and the pages are flattened here. Rows are
// never sliced in the browser (docs/standards/frontend.md).
export function useLeaderboardTable(
  clubId: string | undefined,
  group: StandingsGroup,
  sort: string,
  direction: SortDirection | null,
  filters: LeaderboardFilters,
  minimum: number | null,
  enabled = true,
) {
  const query = useInfiniteQuery({
    queryKey: leaderboardKeys.table(clubId as string, group, sort, direction, filters, minimum),
    queryFn: ({ pageParam }) => getLeaderboardTable(clubId as string, group, sort, direction, filters, minimum, pageParam, LEADERBOARD_PAGE_SIZE),
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

export function useAwardsView(
  clubId: string | undefined,
  filters: LeaderboardFilters,
  minimumInnings: number | null,
  minimumOvers: number | null,
  enabled = true,
) {
  return useQuery({
    queryKey: leaderboardKeys.awards(clubId as string, filters, minimumInnings, minimumOvers),
    queryFn: () => getAwardsView(clubId as string, filters, minimumInnings, minimumOvers),
    enabled: Boolean(clubId) && enabled,
    placeholderData: keepPreviousData,
  })
}

export function useLeaderboardFilterOptions(clubId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: leaderboardKeys.filterOptions(clubId as string),
    queryFn: () => getLeaderboardFilterOptions(clubId as string),
    enabled: Boolean(clubId) && enabled,
  })
}
