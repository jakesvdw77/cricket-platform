import api from './axiosConfig'
import type { Match, MatchFilterOptions } from './matchApi'
import type { Page } from './productApi'

// docs/specs/100-match-results-core.md: the Results list, counters, capture feed and one match's result. Every figure
// that is a length or a count of balls is in BALLS (the API never carries decimal overs); utils/oversFormat.ts is the
// one place that converts to and from "36.4".

export type ResultStatus = 'DRAFT' | 'PUBLISHED'
// A match's own result state, as the Matches list reports it: NONE until a result is saved.
export type MatchResultStatus = 'NONE' | ResultStatus
export type ResultDetailLevel = 'SUMMARY' | 'OUR_SIDE' | 'FULL'
export type ResultOutcomeType = 'WON' | 'TIE' | 'DRAW' | 'NO_RESULT' | 'ABANDONED' | 'FORFEIT'
export type ResultDecidedBy = 'REGULAR' | 'DLS' | 'SUPER_OVER'
// A side as a result sees it: the match's home or away side. FORFEIT's winning side is the side that received the win.
export type ResultSide = 'HOME' | 'AWAY'
export type ResultMarginType = 'RUNS' | 'WICKETS'
export type TossDecision = 'BAT' | 'BOWL'
export type InningsKind = 'REGULAR' | 'SUPER_OVER'

// One innings' totals. On write sequence, kind and allOut may be omitted (the server fills them from position and
// wickets); oversDisplay is derived on read and ignored on write.
export interface Innings {
  sequence?: number | null
  kind?: InningsKind | null
  battingSide: ResultSide | null
  runs: number | null
  wickets: number | null
  balls: number | null
  extras?: number | null
  allOut?: boolean | null
  oversDisplay?: string | null
}

// The canonical shape of a result being captured, and the PUT body. Partial values are allowed on a draft.
export interface ResultDraft {
  outcomeType?: ResultOutcomeType | null
  decidedBy?: ResultDecidedBy | null
  winningSide?: ResultSide | null
  marginType?: ResultMarginType | null
  marginValue?: number | null
  dlsTarget?: number | null
  dlsRevisedBalls?: number | null
  scheduledBalls?: number | null
  ballsPerOver?: number | null
  tossWonBy?: ResultSide | null
  tossDecision?: TossDecision | null
  playingAreaId?: string | null
  note?: string | null
  innings?: Innings[]
}

// A stored result with its innings in sequence order. outcomeType is null only on a draft.
export interface MatchResult {
  id: string
  clubId: string
  matchId: string
  status: ResultStatus
  detailLevel: ResultDetailLevel
  outcomeType: ResultOutcomeType | null
  decidedBy: ResultDecidedBy
  winningSide: ResultSide | null
  marginType: ResultMarginType | null
  marginValue: number | null
  dlsTarget: number | null
  dlsRevisedBalls: number | null
  scheduledBalls: number | null
  ballsPerOver: number
  tossWonBy: ResultSide | null
  tossDecision: TossDecision | null
  playingAreaId: string | null
  playingAreaName: string | null
  note: string | null
  source: string | null
  externalId: string | null
  publishedAt: string | null
  publishedBy: string | null
  createdAt: string
  updatedAt: string
  updatedBy: string | null
  innings: Innings[]
}

// One row of the Results list: the match as the Matches list shows it, with its result (draft or published).
export interface ResultListItem {
  match: Match
  result: MatchResult
}

// The Results counters for the same filters the list uses; each equals the list's total for the same `focus`
// (awaiting: the awaiting endpoint's total).
export interface ResultsSummary {
  played: number
  won: number
  lost: number
  tiedOrNone: number
  drafts: number
  awaiting: number
}

// A validation dry run in plain English. Errors block publishing; warnings are acknowledged at publish.
export interface ResultValidation {
  canPublish: boolean
  errors: string[]
  warnings: string[]
}

// The quick filter behind a Results counter (the server's ResultListFocus values).
export type ResultListFocus = 'played' | 'won' | 'lost' | 'tied-or-none' | 'drafts'

export interface ResultFilters {
  sectionId?: string
  leagueId?: string
  seasonId?: string
  teamId?: string
  search?: string
  // Match dates, inclusive, as yyyy-MM-dd.
  from?: string
  to?: string
}

export interface ListResultsParams extends ResultFilters {
  page: number
  size?: number
  // Spring Data sort, e.g. 'matchDate,desc' (the usual order of a results list).
  sort?: string
  outcome?: ResultOutcomeType[]
  status?: ResultStatus
  focus?: ResultListFocus
}

export interface ListAwaitingParams extends ResultFilters {
  page: number
  size?: number
  sort?: string
  // Adds future-dated matches (the capture picker's "Include upcoming" switch).
  includeUpcoming?: boolean
}

function resultsPath(clubId: string): string {
  return `/manage/clubs/${clubId}/results`
}

function matchResultPath(clubId: string, matchId: string): string {
  return `/manage/clubs/${clubId}/matches/${matchId}/result`
}

// All under ['managed-club', clubId, 'results'], so one invalidateQueries refreshes the list, counters, picker feed and
// a single result.
export const resultsKey = (clubId: string) => ['managed-club', clubId, 'results'] as const
export const resultKeys = {
  all: resultsKey,
  list: (clubId: string, params: Omit<ListResultsParams, 'size'>) => [...resultsKey(clubId), 'list', params] as const,
  summary: (clubId: string, filters: ResultFilters = {}) => [...resultsKey(clubId), 'summary', filters] as const,
  awaiting: (clubId: string, params: Omit<ListAwaitingParams, 'size'>) =>
    [...resultsKey(clubId), 'awaiting', params] as const,
  filterOptions: (clubId: string, filters: ResultFilters = {}) => [...resultsKey(clubId), 'filter-options', filters] as const,
  detail: (clubId: string, matchId: string) => [...resultsKey(clubId), 'detail', matchId] as const,
}

// Only the filters that are set are sent.
function filterParams(filters: ResultFilters): Record<string, string> {
  const params: Record<string, string> = {}
  if (filters.sectionId) params.sectionId = filters.sectionId
  if (filters.leagueId) params.leagueId = filters.leagueId
  if (filters.seasonId) params.seasonId = filters.seasonId
  if (filters.teamId) params.teamId = filters.teamId
  if (filters.search) params.search = filters.search
  if (filters.from) params.from = filters.from
  if (filters.to) params.to = filters.to
  return params
}

export async function listResults(
  clubId: string,
  { page, size = 20, sort, outcome, status, focus, ...filters }: ListResultsParams,
): Promise<Page<ResultListItem>> {
  const { data } = await api.get<Page<ResultListItem>>(resultsPath(clubId), {
    params: {
      page,
      size,
      ...(sort ? { sort } : {}),
      ...filterParams(filters),
      // Comma separated: Spring binds it to a List, where axios' default `outcome[]=` form would not bind.
      ...(outcome && outcome.length > 0 ? { outcome: outcome.join(',') } : {}),
      ...(status ? { status } : {}),
      ...(focus ? { focus } : {}),
    },
  })
  return data
}

export async function getResultsSummary(clubId: string, filters: ResultFilters = {}): Promise<ResultsSummary> {
  const { data } = await api.get<ResultsSummary>(`${resultsPath(clubId)}/summary`, { params: filterParams(filters) })
  return data
}

export async function listResultFilterOptions(clubId: string, filters: ResultFilters = {}): Promise<MatchFilterOptions> {
  const { data } = await api.get<MatchFilterOptions>(`${resultsPath(clubId)}/filter-options`, {
    params: filterParams(filters),
  })
  return data
}

// Active matches with no result (past ones by default), the capture picker's feed.
export async function listAwaitingResults(
  clubId: string,
  { page, size = 20, sort, includeUpcoming, ...filters }: ListAwaitingParams,
): Promise<Page<Match>> {
  const { data } = await api.get<Page<Match>>(`${resultsPath(clubId)}/awaiting`, {
    params: {
      page,
      size,
      ...(sort ? { sort } : {}),
      ...filterParams(filters),
      ...(includeUpcoming ? { includeUpcoming } : {}),
    },
  })
  return data
}

export async function getMatchResult(clubId: string, matchId: string): Promise<MatchResult> {
  const { data } = await api.get<MatchResult>(matchResultPath(clubId, matchId))
  return data
}

// Creates the draft on first save, replaces it after; refused (409) while the result is published.
export async function saveResultDraft(clubId: string, matchId: string, draft: ResultDraft): Promise<MatchResult> {
  const { data } = await api.put<MatchResult>(matchResultPath(clubId, matchId), draft)
  return data
}

// Dry run: validates the body when given, otherwise the stored result.
export async function validateResult(clubId: string, matchId: string, draft?: ResultDraft): Promise<ResultValidation> {
  const { data } = await api.post<ResultValidation>(`${matchResultPath(clubId, matchId)}/validate`, draft)
  return data
}

// acknowledgedWarnings must be true when validation produced warnings.
export async function publishResult(
  clubId: string,
  matchId: string,
  acknowledgedWarnings = false,
): Promise<MatchResult> {
  const { data } = await api.post<MatchResult>(`${matchResultPath(clubId, matchId)}/publish`, { acknowledgedWarnings })
  return data
}

export async function unpublishResult(clubId: string, matchId: string): Promise<MatchResult> {
  const { data } = await api.post<MatchResult>(`${matchResultPath(clubId, matchId)}/unpublish`)
  return data
}

export async function deleteResultDraft(clubId: string, matchId: string): Promise<void> {
  await api.delete(matchResultPath(clubId, matchId))
}
