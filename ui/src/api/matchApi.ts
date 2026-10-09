import api from './axiosConfig'
import type { Page } from './productApi'

// Pre-existing public "upcoming matches" summary (docs/specs/003-club-onboarding.md's own
// deliberately small rollout slice) — a different, unrelated resource from the club-scoped
// Match/MatchPayload below (docs/specs/029-league-management.md): this hits the public
// /matches/upcoming endpoint, not /manage/clubs/{clubId}/matches. Kept side by side in the same
// file rather than split out, since both are genuinely "match" API calls and there's no third
// consumer yet to justify two files.
export interface MatchSummary {
  id: string
  opponent: string
  scheduledAt: string
}

export async function fetchUpcomingMatches(): Promise<MatchSummary[]> {
  const { data } = await api.get<MatchSummary[]>('/matches/upcoming')
  return data
}

// A club's own scheduled fixture — docs/specs/029-league-management.md. Either side is either a
// real Team (any club's — cross-club Team references are backend-supported even though this
// pass's UI only ever lets an admin pick from their own club's teams) or a free-text opponent
// name. Never hard-deleted — deactivate/reactivate only.
export interface Match {
  id: string
  clubId: string
  homeTeamId: string | null
  homeTeamName: string | null
  awayTeamId: string | null
  awayTeamName: string | null
  leagueId: string | null
  seasonId: string
  matchDate: string
  venue: string | null
  active: boolean
  homeSideAnnounced: boolean
  awaySideAnnounced: boolean
  // docs/specs/050-league-schedule-and-fixtures.md: a small logo/crest for a free-text ("external")
  // opponent side — meaningful only alongside the matching *TeamName (a real Team's own avatar
  // comes from Team.logoUrl, resolved via *TeamId, never both at once).
  homeTeamLogoUrl: string | null
  awayTeamLogoUrl: string | null
  // docs/specs/070-league-teams.md: set when that side is a registered league team (the name and
  // logo above are then the league team's copied values). Optional so older fixtures stay valid.
  homeLeagueTeamId?: string | null
  awayLeagueTeamId?: string | null
  // docs/specs/075-match-view-and-edit.md: optional external links (a scoring page, a live stream).
  // Optional so older fixtures stay valid.
  scoringUrl?: string | null
  streamingUrl?: string | null
  // docs/specs/069-match-card-redesign.md: list-response only (non-list endpoints return null / []).
  // Picked = players in that side's playing XI; null for a free-text or other-club side.
  homePickedCount: number | null
  awayPickedCount: number | null
  // The league's playing XI size; null when the match has no league.
  playingXiSize: number | null
  polls: MatchPoll[]
  createdAt: string
  updatedAt: string
  updatedBy: string | null
}

// One availability poll covering a match: a squad poll per club side, or one group poll for the
// whole match (teamId null, pollId = the round id).
export interface MatchPoll {
  type: 'SQUAD' | 'GROUP'
  teamId: string | null
  pollId: string
  roundId: string | null
  open: boolean
}

// Same shape for create and update — CreateMatchRequest/UpdateMatchRequest are identical
// server-side. Exactly one of homeTeamId/homeTeamName, and exactly one of awayTeamId/
// awayTeamName, must be set — validated server-side (400 otherwise).
export interface MatchPayload {
  homeTeamId?: string | null
  homeTeamName?: string | null
  awayTeamId?: string | null
  awayTeamName?: string | null
  // docs/specs/050-league-schedule-and-fixtures.md: only ever sent alongside the matching
  // *TeamName (never alongside the matching *TeamId) — 400 server-side otherwise.
  homeTeamLogoUrl?: string | null
  awayTeamLogoUrl?: string | null
  // docs/specs/070-league-teams.md: a league-team side sends only its id (no team id; the server
  // supplies name and logo).
  homeLeagueTeamId?: string | null
  awayLeagueTeamId?: string | null
  leagueId?: string | null
  seasonId: string
  matchDate: string
  venue?: string | null
  // docs/specs/075-match-view-and-edit.md: optional http(s) links; blank/null clears.
  scoringUrl?: string | null
  streamingUrl?: string | null
}

export interface ListMatchesParams {
  page: number
  size?: number
  // Spring Data's native Pageable sort format — the controller's own default is
  // 'matchDate,desc'.
  sort?: string
  // docs/specs/042-match-list-filters-and-search.md: real, backend-driven search over
  // opponent/team name (case-insensitive contains) — MatchController.list() now has a `search`
  // query param and actually applies it. Previously accepted here but silently dropped by the
  // backend (see git history); that gap is closed.
  search?: string
  // docs/specs/035-section-scoped-access.md: narrows to one section's (and its descendants')
  // matches — a real, query-level backend filter (this list is genuinely paginated), not a
  // client-side one. A section-scoped caller's own default is already narrowed server-side
  // regardless of this param; it's an optional, further-narrowing convenience for any caller.
  sectionId?: string
  // docs/specs/042-match-list-filters-and-search.md: narrows to one league/season — combinable
  // with sectionId/search/upcomingOnly in any combination.
  leagueId?: string
  seasonId?: string
  // docs/specs/087-matches-polls-alignment.md: a team on either side of the match, and one of the Matches quick
  // filters (the same definitions the summary counters count). Both are real backend params.
  teamId?: string
  focus?: MatchListFocus
  // docs/specs/037-match-improvements.md: restricts results to matches dated today or later
  // (server/database local date). Omitted or false preserves today's exact unfiltered behaviour —
  // purely additive. MatchList.tsx sends `true` by default (no UI toggle yet); a future "Show past
  // matches" control is just flipping this boolean, no further frontend/backend work.
  upcomingOnly?: boolean
}

function matchesPath(clubId: string): string {
  return `/manage/clubs/${clubId}/matches`
}

// Paginated — the first list in this feature area that can't just fetch everything (a club's
// match history grows every week across every season), per docs/standards/frontend.md's
// pagination rule.
export async function listMatches(
  clubId: string,
  { page, size = 20, sort, search, sectionId, leagueId, seasonId, teamId, focus, upcomingOnly }: ListMatchesParams,
): Promise<Page<Match>> {
  const { data } = await api.get<Page<Match>>(matchesPath(clubId), {
    params: {
      page,
      size,
      ...(sort ? { sort } : {}),
      ...(search ? { search } : {}),
      ...(sectionId ? { sectionId } : {}),
      ...(leagueId ? { leagueId } : {}),
      ...(seasonId ? { seasonId } : {}),
      ...(teamId ? { teamId } : {}),
      ...(focus ? { focus } : {}),
      ...(upcomingOnly ? { upcomingOnly } : {}),
    },
  })
  return data
}

const ALL_MATCHES_PAGE_SIZE = 200
const ALL_MATCHES_MAX_PAGES = 25

// docs/specs/072-league-view-pages.md: every match of one league and season, oldest first - the
// schedule, next-match countdown and share generators need the whole season, and listMatches alone
// returns just one page (default 20). A league's single season is a small bounded set, so this is a
// bounded read, not browser-side pagination of an unbounded collection. Pages of 200 are requested
// while more remain, stopping at 25 pages as a safety bound (returns what it has by then).
export async function listAllMatches(
  clubId: string,
  { leagueId, seasonId }: { leagueId: string; seasonId: string },
): Promise<Match[]> {
  const matches: Match[] = []
  for (let page = 0; page < ALL_MATCHES_MAX_PAGES; page += 1) {
    const result = await listMatches(clubId, {
      page,
      size: ALL_MATCHES_PAGE_SIZE,
      sort: 'matchDate,asc',
      leagueId,
      seasonId,
    })
    matches.push(...result.content)
    if (page + 1 >= result.totalPages) {
      break
    }
  }
  return matches
}

// docs/specs/042-match-list-filters-and-search.md: given the *currently selected* filters, returns
// which section/league/season ids are actually reachable — each array computed ignoring that same
// dimension's own current selection, so picking a filter never makes itself disappear from its own
// dropdown. Unpaginated (no page/size/sort) — the frontend uses this only to narrow its own
// already-loaded Section/League/Season option lists, never to render rows directly.
//
// teamIds is different in kind: it drives Search's own autocomplete suggestions, narrowed by
// whichever section/league/season filters are active (so a team outside the current Section/
// League/Season selection is never suggested) but deliberately NOT by the search text itself —
// suggesting names to help decide what to type would be circular otherwise.
export interface MatchFilterOptions {
  sectionIds: string[]
  leagueIds: string[]
  seasonIds: string[]
  teamIds: string[]
}

export async function listMatchFilterOptions(
  clubId: string,
  { search, sectionId, leagueId, seasonId, teamId, upcomingOnly }: {
    search?: string
    sectionId?: string
    leagueId?: string
    seasonId?: string
    teamId?: string
    upcomingOnly?: boolean
  },
): Promise<MatchFilterOptions> {
  const { data } = await api.get<MatchFilterOptions>(`${matchesPath(clubId)}/filter-options`, {
    params: {
      ...(search ? { search } : {}),
      ...(sectionId ? { sectionId } : {}),
      ...(leagueId ? { leagueId } : {}),
      ...(seasonId ? { seasonId } : {}),
      ...(teamId ? { teamId } : {}),
      ...(upcomingOnly ? { upcomingOnly } : {}),
    },
  })
  return data
}

// docs/specs/087-matches-polls-alignment.md: the Matches page counters for exactly the filters the list uses. The
// three quick filters are active, upcoming matches only and equal the list's total for the same `focus`.
export type MatchListFocus = 'this-week' | 'not-announced' | 'no-poll'

export interface MatchesSummary {
  matchesShown: number
  thisWeek: number
  teamsNotAnnounced: number
  withoutPoll: number
}

export interface MatchesSummaryFilters {
  sectionId?: string
  leagueId?: string
  seasonId?: string
  teamId?: string
  search?: string
  // The inverse of the list's upcomingOnly: past matches are counted in matchesShown.
  includePast?: boolean
}

// Under the list's own ['managed-club', clubId, 'matches'] prefix, so every invalidation that refreshes the list
// (poll changes, match edits) refreshes the counters too.
export const matchesSummaryKey = (clubId: string, filters: MatchesSummaryFilters = {}) =>
  ['managed-club', clubId, 'matches', 'summary', filters] as const

// Only the filters that are set are sent; the server default is includePast false.
export async function getMatchesSummary(clubId: string, filters: MatchesSummaryFilters = {}): Promise<MatchesSummary> {
  const params: Record<string, string | boolean> = {}
  if (filters.sectionId) params.sectionId = filters.sectionId
  if (filters.leagueId) params.leagueId = filters.leagueId
  if (filters.seasonId) params.seasonId = filters.seasonId
  if (filters.teamId) params.teamId = filters.teamId
  if (filters.search) params.search = filters.search
  if (filters.includePast) params.includePast = true
  const { data } = await api.get<MatchesSummary>(`${matchesPath(clubId)}/summary`, { params })
  return data
}

export async function getMatch(clubId: string, matchId: string): Promise<Match> {
  const { data } = await api.get<Match>(`${matchesPath(clubId)}/${matchId}`)
  return data
}

export async function createMatch(clubId: string, payload: MatchPayload): Promise<Match> {
  const { data } = await api.post<Match>(matchesPath(clubId), payload)
  return data
}

export async function updateMatch(clubId: string, matchId: string, payload: MatchPayload): Promise<Match> {
  const { data } = await api.put<Match>(`${matchesPath(clubId)}/${matchId}`, payload)
  return data
}

export async function deactivateMatch(clubId: string, matchId: string): Promise<Match> {
  const { data } = await api.post<Match>(`${matchesPath(clubId)}/${matchId}/deactivate`)
  return data
}

export async function reactivateMatch(clubId: string, matchId: string): Promise<Match> {
  const { data } = await api.post<Match>(`${matchesPath(clubId)}/${matchId}/reactivate`)
  return data
}

// docs/specs/037-match-improvements.md item 9's "Re-select from Previous Match" picker — a
// Team's own previous matches for a given Season, nested off clubId + teamId + seasonId
// (TeamPreviousMatchController.java) rather than the club-wide, paginated /matches list above.
// Already filtered/ordered server-side: same team (either side), exact seasonId, exact leagueId
// match (including null-to-null), active, already-played, and has at least one MatchSidePlayer —
// newest-first. Returns a plain, unpaginated Match[] reusing the existing MatchDto shape, so no
// new frontend type is needed.
export async function listPreviousMatches(
  clubId: string,
  teamId: string,
  seasonId: string,
  { leagueId, excludeMatchId }: { leagueId?: string | null; excludeMatchId?: string },
): Promise<Match[]> {
  const { data } = await api.get<Match[]>(
    `/manage/clubs/${clubId}/teams/${teamId}/seasons/${seasonId}/matches/previous`,
    { params: { ...(leagueId ? { leagueId } : {}), ...(excludeMatchId ? { excludeMatchId } : {}) } },
  )
  return data
}
