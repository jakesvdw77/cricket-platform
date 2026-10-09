import api from './axiosConfig'
import type { SocialLink } from '../components/marketing/SocialLinksRow'

// A club's own internal league — docs/specs/029-league-management.md. Single /manage-only
// namespace (no /platform mirror, same precedent as Section/Team/Sponsor/Player):
// AccessService.canAdministerClub already gives platform_admin a superset pass on these
// endpoints. Never hard-deleted — deactivate/reactivate only. allowSubstitutions moved off this
// entity to the per-season LeaguePlayingConditionsApi (052 amendment) — it was never enforced by
// any backend rule and, unlike this long-lived row, plausibly differs by season.
export type LeagueSource = 'INTERNAL' | 'EXTERNAL'

// docs/specs/053-league-extended-profile.md: a purely descriptive tag — never validated against,
// or cross-checked with, LeaguePlayingConditions' own match-format fields (see that spec's
// Non-goals). A fixed, closed enum (LeagueFormat, backend), not a club-authored free-text string.
export type LeagueFormat = 'T20' | 'T30' | 'T45' | 'T50' | 'ONE_DAY' | 'THREE_DAY' | 'FIVE_DAY'

// Single source of display labels — LeagueForm/LeagueList/LeagueDetailPage all import this rather
// than each keeping their own drifting copy.
export const LEAGUE_FORMAT_LABELS: Record<LeagueFormat, string> = {
  T20: 'T20',
  T30: 'T30',
  T45: 'T45',
  T50: 'T50',
  ONE_DAY: '1 Day',
  THREE_DAY: '3 Day',
  FIVE_DAY: '5 Day',
}

export interface LeagueSeasonTeam {
  name: string
  abbreviation: string | null
  logoUrl: string | null
  own: boolean
}

export interface League {
  id: string
  clubId: string
  name: string
  source: LeagueSource
  maxPlayingXiSize: number
  minAge: number | null
  maxAge: number | null
  ageCutoffDate: string | null
  active: boolean
  createdAt: string
  updatedAt: string
  updatedBy: string | null
  // docs/specs/050-league-schedule-and-fixtures.md: computed (non-persisted) fields, resolved
  // server-side against the club's own current Season (LeagueServiceImpl.list) — never sent on a
  // create/update payload, read-only summary data for LeagueList's card badges/footer action.
  currentSeasonTeamCount: number
  currentSeasonLabel: string | null
  currentSeasonPlayingConditionsUrl: string | null
  // docs/specs/071-league-card-redesign.md: season-progress aggregates for the current season, only
  // filled on the list response (null on create/update/deactivate/reactivate). `teams` is the club's
  // own affiliated teams first, then the active league teams, already name-sorted by the server.
  matchCount: number | null
  playedCount: number | null
  firstMatchDate: string | null
  lastMatchDate: string | null
  nextMatchDate: string | null
  teams: LeagueSeasonTeam[] | null
  // docs/specs/053-league-extended-profile.md: League-level (not season-scoped — see that spec's
  // Non-goals), the same club-facing profile shape ClubProfile/Sponsor already have.
  format: LeagueFormat | null
  logoUrl: string | null
  phone: string | null
  website: string | null
  email: string | null
  socialLinks: SocialLink[]
}

// Same shape for create and update — CreateLeagueRequest/UpdateLeagueRequest are byte-for-byte
// identical server-side (docs/specs/029-league-management.md's API Contract).
export interface LeaguePayload {
  name: string
  source?: LeagueSource | null
  maxPlayingXiSize?: number | null
  minAge?: number | null
  maxAge?: number | null
  ageCutoffDate?: string | null
  format?: LeagueFormat | null
  logoUrl?: string | null
  phone?: string | null
  website?: string | null
  email?: string | null
  socialLinks?: SocialLink[]
}

function leaguesPath(clubId: string): string {
  return `/manage/clubs/${clubId}/leagues`
}

// Plain array response, not Page<T> — a club's own leagues are a small, bounded list, matching
// Section/Team/Sponsor's own posture.
// docs/specs/091: the quick filter behind a Leagues counter.
export type LeagueListFocus = 'active' | 'this-week' | 'attention'

export interface ListLeaguesParams {
  // The season the computed fields describe; omitted = the club's current season.
  seasonId?: string
  // Default true (every league); the Leagues page sends false.
  includeInactive?: boolean
  focus?: LeagueListFocus
}

export async function listLeagues(clubId: string, params: ListLeaguesParams = {}): Promise<League[]> {
  const { data } = await api.get<League[]>(leaguesPath(clubId), {
    params: {
      ...(params.seasonId ? { seasonId: params.seasonId } : {}),
      ...(params.includeInactive === false ? { includeInactive: false } : {}),
      ...(params.focus ? { focus: params.focus } : {}),
    },
  })
  return data
}

// docs/specs/091: the Leagues page counters for the list's season and inactive filter. activeLeagues and needAttention
// equal the list's size with that focus; matchesThisWeek is a match count (its filter keeps leagues that have one).
export interface LeaguesSummary {
  leaguesShown: number
  active: number
  teamsEntered: number
  players: number
  seasons: number
  matchesThisWeek: number
  needAttention: number
}

export type LeaguesSummaryFilters = Pick<ListLeaguesParams, 'seasonId' | 'includeInactive'>

// Under the list's own ['managed-club', clubId, 'leagues'] prefix, so every invalidation that refreshes the leagues
// refreshes the counters too.
export const leaguesSummaryKey = (clubId: string, filters: LeaguesSummaryFilters = {}) =>
  ['managed-club', clubId, 'leagues', 'summary', filters] as const

export async function getLeaguesSummary(clubId: string, filters: LeaguesSummaryFilters = {}): Promise<LeaguesSummary> {
  const params: Record<string, string | boolean> = {}
  if (filters.seasonId) params.seasonId = filters.seasonId
  if (filters.includeInactive === false) params.includeInactive = false
  const { data } = await api.get<LeaguesSummary>(`${leaguesPath(clubId)}/summary`, { params })
  return data
}

export async function createLeague(clubId: string, payload: LeaguePayload): Promise<League> {
  const { data } = await api.post<League>(leaguesPath(clubId), payload)
  return data
}

export async function updateLeague(clubId: string, leagueId: string, payload: LeaguePayload): Promise<League> {
  const { data } = await api.put<League>(`${leaguesPath(clubId)}/${leagueId}`, payload)
  return data
}

export async function deactivateLeague(clubId: string, leagueId: string): Promise<League> {
  const { data } = await api.post<League>(`${leaguesPath(clubId)}/${leagueId}/deactivate`)
  return data
}

export async function reactivateLeague(clubId: string, leagueId: string): Promise<League> {
  const { data } = await api.post<League>(`${leaguesPath(clubId)}/${leagueId}/reactivate`)
  return data
}
