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
export async function listLeagues(clubId: string): Promise<League[]> {
  const { data } = await api.get<League[]>(leaguesPath(clubId))
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
