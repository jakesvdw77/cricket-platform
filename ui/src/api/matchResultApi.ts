import api from './axiosConfig'
import type { Match, MatchFilterOptions } from './matchApi'
import type { Page } from './productApi'
import type { PlayingRole } from './matchSideApi'

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

// docs/specs/101-match-results-our-side-scorecard.md. DismissalType mirrors the backend enum; utils/dismissal.ts holds
// the labels and the wicket / bowler-credited flags.
export type DismissalType =
  | 'NOT_OUT'
  | 'DID_NOT_BAT'
  | 'BOWLED'
  | 'CAUGHT'
  | 'CAUGHT_AND_BOWLED'
  | 'LBW'
  | 'STUMPED'
  | 'RUN_OUT'
  | 'HIT_WICKET'
  | 'HANDLED_BALL'
  | 'OBSTRUCTING_FIELD'
  | 'HIT_BALL_TWICE'
  | 'TIMED_OUT'
  | 'RETIRED_NOT_OUT'
  | 'RETIRED_OUT'
export type AwardType = 'PLAYER_OF_MATCH' | 'TEAM_PLAYER_OF_MATCH'
// The manager's edit of a standout suggestion: FEATURE adds a player the rules did not suggest, HIDE removes a
// suggestion, null follows the suggestion.
export type FeaturedOverride = 'FEATURE' | 'HIDE'
// The wizard step an issue is fixed on. The scorecard steps carry the side in the issue's `side`.
export type ResultWizardStep = 'RESULT' | 'TOSS' | 'SCORES' | 'TEAMS' | 'BATTING' | 'BOWLING' | 'AWARDS'
// Whether a bowler's wickets / a fielder's credits are typed (MANUAL) or recomputed by the server from the dismissals.
export type CreditSource = 'MANUAL' | 'DERIVED'
export type ScorecardSelectionState = 'NONE' | 'NOT_ANNOUNCED' | 'ANNOUNCED'
export type ResultIssueSeverity = 'ERROR' | 'WARNING' | 'INFO'
export type ScorecardStatus = 'NONE' | 'PARTIAL' | 'COMPLETE'

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
  // docs/specs/101: the batting side's extras breakdown in runs. When any part is sent, `extras` is their sum (a total
  // that disagrees is a save error, so `extras` is never sent from the form).
  wides?: number | null
  noBalls?: number | null
  byes?: number | null
  legByes?: number | null
  penaltyRuns?: number | null
  // Wickets not credited to a bowler (run-outs and similar), the opposition's side of the bowling reconciliation.
  nonBowlerWickets?: number | null
  // Client-only (never sent): true when the manager typed the figure, false when the scorecard calculated it, absent when
  // unknown (a loaded result). A typed figure that differs from the calculation is "corrected" and is not overwritten.
  runsCorrected?: boolean
  wicketsCorrected?: boolean
  ballsCorrected?: boolean
  // The same for the extras the bowlers' wides and no-balls add up to.
  widesCorrected?: boolean
  noBallsCorrected?: boolean
}

// docs/specs/101: who played for one of the sides. A new row carries a `clientKey` (entries refer to it by
// `playerClientKey`); a stored one has an `id`. `firstName`, `lastName`, `guest`, `linkedBy` and `linkedAt` are
// read-only. A guest has no `playerProfileId` and a `displayName`. `opposition` marks a player of the side that is not
// ours: a name only (no profile, planned order, replaced player or link).
export interface ResultPlayer {
  id?: string | null
  clientKey?: string | null
  side: ResultSide
  playerProfileId: string | null
  displayName: string | null
  plannedBattingOrder: number | null
  replacedPlayerProfileId: string | null
  substitute: boolean
  opposition?: boolean
  firstName?: string | null
  lastName?: string | null
  guest?: boolean
  linkedBy?: string | null
  linkedAt?: string | null
}

// Fields every entry shares. `suggested` and `featured` are read-only (the rules' suggestion and the effective value,
// frozen at publish); the manager writes only `featuredOverride`.
interface ScorecardEntryBase {
  id?: string | null
  battingSide: ResultSide
  inningsKind?: InningsKind | null
  resultPlayerId?: string | null
  playerClientKey?: string | null
  featuredOverride: FeaturedOverride | null
  suggested?: boolean | null
  featured?: boolean | null
}

// One batter of our side. `battingSide` is the side that batted (ours); `position` is the actual batting order.
export interface BattingEntry extends ScorecardEntryBase {
  position: number | null
  howOut: DismissalType | null
  runs: number | null
  balls: number | null
  fours: number | null
  sixes: number | null
  // The dismissal's bowler and fielder: the key (stored id, else client key) of a player of the FIELDING side, only where
  // the how out allows them (utils/dismissal allowsBowler / allowsFielder). Optional always.
  bowlerPlayerId?: string | null
  fielderPlayerId?: string | null
  // Client-only (never sent): the zero figures were filled in when the row became a batted row and the manager has not typed
  // any figure on it yet (cleared on the first edit); such a row counts as batted but says nothing about runs.
  untouched?: boolean
  // Client-only (never sent): the Not out / Did not bat was set by the wicket fill, not by the manager (utils/wicketFill).
  auto?: boolean
}

// One bowler of our side. `battingSide` is the OTHER side (the one that batted). `balls` is balls, never decimal overs.
export interface BowlingEntry extends ScorecardEntryBase {
  bowlingOrder: number | null
  balls: number | null
  maidens: number | null
  runs: number | null
  wickets: number | null
  wides: number | null
  noBalls: number | null
  // Optional dot balls, at most `balls`; null is "not on the scorecard".
  dots?: number | null
  // DERIVED: `wickets` is recomputed by the server from the dismissals on every save. Absent means MANUAL.
  wicketsSource?: CreditSource
  // Read-only: what the dismissals credit this bowler.
  derivedWickets?: number | null
  // Client-only (never sent): the row was created from a dismissal that names this bowler; it goes again if that dismissal
  // changes and nothing else was typed on it.
  auto?: boolean
  // Client-only (never sent): a row whose zero defaults the manager has not touched yet (cleared on the first edit).
  untouched?: boolean
}

export interface FieldingEntry extends ScorecardEntryBase {
  catches: number | null
  stumpings: number | null
  runOuts: number | null
  // One flag for the three counters. Absent means MANUAL.
  creditsSource?: CreditSource
  // Read-only: what the dismissals credit this fielder.
  derivedCatches?: number | null
  derivedStumpings?: number | null
  derivedRunOuts?: number | null
}

// `resultPlayerId` / `playerClientKey` name one of our players; `displayName` is free text for an opposition player.
export interface MatchAward {
  id?: string | null
  awardType: AwardType
  side: ResultSide | null
  resultPlayerId?: string | null
  playerClientKey?: string | null
  displayName?: string | null
  // Read-only: the resolved name shown on the card.
  playerName?: string | null
}

// Read-only: an innings' extras breakdown as the scorecard read reports it (written through Innings).
export interface ScorecardInnings {
  battingSide: ResultSide
  wides: number | null
  noBalls: number | null
  byes: number | null
  legByes: number | null
  penaltyRuns: number | null
  extras: number | null
  nonBowlerWickets: number | null
  // True when the innings has batting entries: the number is derived from the dismissals and read-only.
  nonBowlerWicketsDerived?: boolean
}

export interface ScorecardSideStatus {
  side: ResultSide
  status: ScorecardStatus
}

// The scorecard of either side (one or two ours sides, and the opposition's names). On write only players, batting, bowling, fielding and awards are read;
// `innings` and `status` are read-only. Absent on a draft means "untouched"; present replaces the whole scorecard.
export interface Scorecard {
  players: ResultPlayer[]
  batting: BattingEntry[]
  bowling: BowlingEntry[]
  fielding: FieldingEntry[]
  awards: MatchAward[]
  innings?: ScorecardInnings[]
  status?: ScorecardSideStatus[]
}

// The proposed line-up of each ours side from the team selection (two in a derby); `players` is empty when no team was
// selected. `plannedBattingOrder` is null for a player without an order and for the 12th man.
export interface ScorecardPrefillPlayer {
  playerProfileId: string
  firstName: string
  lastName: string
  plannedBattingOrder: number | null
  role: PlayingRole
  substitute: boolean
}

export interface ScorecardPrefillSide {
  side: ResultSide
  teamId: string
  teamName: string
  players: ScorecardPrefillPlayer[]
  // NONE: no selection found; NOT_ANNOUNCED: a selection exists but is not announced. Absent for a squad-built side.
  selectionState?: ScorecardSelectionState
}

export interface ScorecardPrefill {
  sides: ScorecardPrefillSide[]
}

// A guest name the club has used before, for the name field's suggestions.
export interface GuestName {
  displayName: string
  uses: number
  lastUsed: string
}

// A name used for the opposition in an earlier fixture, a text-only suggestion on the Teams step.
export interface OppositionName {
  displayName: string
  uses: number
  lastMatchDate: string | null
}

// One validation issue with a stable `code` (the Review step matches on it, never on the message), the wizard `step` to
// fix it on, the `side` of the scorecard it belongs to (null for match-level issues) and its `severity`.
export interface ResultIssue {
  code: string
  step: ResultWizardStep | null
  side: ResultSide | null
  severity: ResultIssueSeverity
  message: string
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
  // docs/specs/101: absent / null = untouched on a save; present replaces our side's whole scorecard.
  scorecard?: Scorecard | null
  // Client-only (never sent): the manager edited the margin away from what the scores give (see calculatedMargin).
  marginCorrected?: boolean
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
  // docs/specs/101: true when the scorecard has at least one player (read it with getScorecard).
  hasScorecard: boolean
  // True when one of those players is the opposition's.
  hasOppositionScorecard?: boolean
}

// One row of the Results list: the match as the Matches list shows it, with its result (draft or published).
export interface ResultListItem {
  match: Match
  result: MatchResult
  // docs/specs/101: the official player of the match's name, or null when none was recorded.
  playerOfTheMatch: string | null
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
  // docs/specs/101: the same errors and warnings plus info lines, each with a code, step and side. The string lists
  // stay for callers that predate it.
  issues: ResultIssue[]
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
  scorecard: (clubId: string, matchId: string) => [...resultsKey(clubId), 'scorecard', matchId] as const,
  scorecardPrefill: (clubId: string, matchId: string) => [...resultsKey(clubId), 'scorecard-prefill', matchId] as const,
  guestNames: (clubId: string, params: GuestNamesParams) => [...resultsKey(clubId), 'guest-names', params] as const,
  oppositionNames: (clubId: string, params: OppositionNamesParams) => [...resultsKey(clubId), 'opposition-names', params] as const,
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

// docs/specs/101: the proposed line-up of each ours side from the team selection. Writes nothing.
export async function getScorecardPrefill(clubId: string, matchId: string): Promise<ScorecardPrefill> {
  const { data } = await api.get<ScorecardPrefill>(`${matchResultPath(clubId, matchId)}/scorecard/prefill`)
  return data
}

// The stored scorecard of a match's result, with the suggested / effective standout flags and each side's status.
export async function getScorecard(clubId: string, matchId: string): Promise<Scorecard> {
  const { data } = await api.get<Scorecard>(`${matchResultPath(clubId, matchId)}/scorecard`)
  return data
}

// Links a guest row to a registered player of this club: the one write allowed on a published result.
export async function linkResultPlayer(
  clubId: string,
  matchId: string,
  resultPlayerId: string,
  playerProfileId: string,
): Promise<ResultPlayer> {
  const { data } = await api.post<ResultPlayer>(`${matchResultPath(clubId, matchId)}/players/${resultPlayerId}/link`, {
    playerProfileId,
  })
  return data
}

export interface GuestNamesParams {
  teamId?: string
  // Narrows by name as typed.
  q?: string
  page?: number
  size?: number
}

// Guest names the club has used before (most used first), for the guest name field's suggestions.
export async function listGuestNames(
  clubId: string,
  { teamId, q, page = 0, size = 10 }: GuestNamesParams = {},
): Promise<Page<GuestName>> {
  const { data } = await api.get<Page<GuestName>>(`${resultsPath(clubId)}/guest-names`, {
    params: { page, size, ...(teamId ? { teamId } : {}), ...(q ? { q } : {}) },
  })
  return data
}

export interface OppositionNamesParams {
  // The match being captured: the server finds the opposing team from it and hides names already on the result's list.
  matchId?: string
  q?: string
  page?: number
  size?: number
}

// Names used for this match's opposition in earlier fixtures of the club (most recent first). Suggestions only: text,
// no identity.
export async function listOppositionNames(
  clubId: string,
  { matchId, q, page = 0, size = 12 }: OppositionNamesParams = {},
): Promise<Page<OppositionName>> {
  const { data } = await api.get<Page<OppositionName>>(`${resultsPath(clubId)}/opposition-names`, {
    params: { page, size, ...(matchId ? { matchId } : {}), ...(q ? { q } : {}) },
  })
  return data
}
