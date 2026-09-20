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
  createdAt: string
  updatedAt: string
  updatedBy: string | null
}

// Same shape for create and update — CreateMatchRequest/UpdateMatchRequest are identical
// server-side. Exactly one of homeTeamId/homeTeamName, and exactly one of awayTeamId/
// awayTeamName, must be set — validated server-side (400 otherwise).
export interface MatchPayload {
  homeTeamId?: string | null
  homeTeamName?: string | null
  awayTeamId?: string | null
  awayTeamName?: string | null
  leagueId?: string | null
  seasonId: string
  matchDate: string
  venue?: string | null
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
  { page, size = 20, sort, search, sectionId, leagueId, seasonId, upcomingOnly }: ListMatchesParams,
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
      ...(upcomingOnly ? { upcomingOnly } : {}),
    },
  })
  return data
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
  { search, sectionId, leagueId, seasonId, upcomingOnly }: {
    search?: string
    sectionId?: string
    leagueId?: string
    seasonId?: string
    upcomingOnly?: boolean
  },
): Promise<MatchFilterOptions> {
  const { data } = await api.get<MatchFilterOptions>(`${matchesPath(clubId)}/filter-options`, {
    params: {
      ...(search ? { search } : {}),
      ...(sectionId ? { sectionId } : {}),
      ...(leagueId ? { leagueId } : {}),
      ...(seasonId ? { seasonId } : {}),
      ...(upcomingOnly ? { upcomingOnly } : {}),
    },
  })
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
