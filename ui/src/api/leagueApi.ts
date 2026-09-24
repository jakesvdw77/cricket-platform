import api from './axiosConfig'

// A club's own internal league — docs/specs/029-league-management.md. Single /manage-only
// namespace (no /platform mirror, same precedent as Section/Team/Sponsor/Player):
// AccessService.canAdministerClub already gives platform_admin a superset pass on these
// endpoints. Never hard-deleted — deactivate/reactivate only.
export type LeagueSource = 'INTERNAL' | 'EXTERNAL'

export interface League {
  id: string
  clubId: string
  name: string
  source: LeagueSource
  maxPlayingXiSize: number
  allowSubstitutions: boolean
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
}

// Same shape for create and update — CreateLeagueRequest/UpdateLeagueRequest are byte-for-byte
// identical server-side (docs/specs/029-league-management.md's API Contract).
export interface LeaguePayload {
  name: string
  source?: LeagueSource | null
  maxPlayingXiSize?: number | null
  allowSubstitutions?: boolean | null
  minAge?: number | null
  maxAge?: number | null
  ageCutoffDate?: string | null
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
