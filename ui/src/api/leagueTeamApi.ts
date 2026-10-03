import api from './axiosConfig'

// docs/specs/070-league-teams.md: a lightweight opponent (name, abbreviation, logo) registered for
// one league and one season, picked on matches instead of typing a free-text name. Club admin only.
export interface LeagueTeam {
  id: string
  leagueId: string
  seasonId: string
  name: string
  abbreviation: string | null
  logoUrl: string | null
  active: boolean
  // Matches using this league team on either side; 0 outside the list endpoint.
  referencedByMatchCount: number
}

export interface LeagueTeamPayload {
  name: string
  abbreviation?: string | null
  logoUrl?: string | null
}

export interface CopyLeagueTeamsPayload {
  sourceLeagueId: string
  sourceSeasonId: string
  leagueTeamIds: string[]
}

export interface SkippedLeagueTeam {
  name: string
  reason: string
}

export interface CopyLeagueTeamsResult {
  created: LeagueTeam[]
  skipped: SkippedLeagueTeam[]
}

export type LeagueTeamRemoveOutcome = 'DELETED' | 'DEACTIVATED'

export interface RemoveLeagueTeamResult {
  outcome: LeagueTeamRemoveOutcome
  leagueTeam: LeagueTeam | null
}

export function leagueTeamsQueryKey(clubId: string, leagueId: string, seasonId: string) {
  return ['managed-club', clubId, 'leagues', leagueId, 'seasons', seasonId, 'league-teams']
}

function leagueTeamsPath(clubId: string, leagueId: string, seasonId: string): string {
  return `/manage/clubs/${clubId}/leagues/${leagueId}/seasons/${seasonId}/league-teams`
}

export async function listLeagueTeams(
  clubId: string,
  leagueId: string,
  seasonId: string,
  { activeOnly }: { activeOnly?: boolean } = {},
): Promise<LeagueTeam[]> {
  const { data } = await api.get<LeagueTeam[]>(leagueTeamsPath(clubId, leagueId, seasonId), {
    params: activeOnly ? { activeOnly: true } : undefined,
  })
  return data
}

export async function createLeagueTeam(
  clubId: string,
  leagueId: string,
  seasonId: string,
  payload: LeagueTeamPayload,
): Promise<LeagueTeam> {
  const { data } = await api.post<LeagueTeam>(leagueTeamsPath(clubId, leagueId, seasonId), payload)
  return data
}

export async function updateLeagueTeam(
  clubId: string,
  leagueId: string,
  seasonId: string,
  leagueTeamId: string,
  payload: LeagueTeamPayload,
): Promise<LeagueTeam> {
  const { data } = await api.put<LeagueTeam>(`${leagueTeamsPath(clubId, leagueId, seasonId)}/${leagueTeamId}`, payload)
  return data
}

export async function deactivateLeagueTeam(
  clubId: string,
  leagueId: string,
  seasonId: string,
  leagueTeamId: string,
): Promise<LeagueTeam> {
  const { data } = await api.post<LeagueTeam>(`${leagueTeamsPath(clubId, leagueId, seasonId)}/${leagueTeamId}/deactivate`)
  return data
}

export async function reactivateLeagueTeam(
  clubId: string,
  leagueId: string,
  seasonId: string,
  leagueTeamId: string,
): Promise<LeagueTeam> {
  const { data } = await api.post<LeagueTeam>(`${leagueTeamsPath(clubId, leagueId, seasonId)}/${leagueTeamId}/reactivate`)
  return data
}

export async function removeLeagueTeam(
  clubId: string,
  leagueId: string,
  seasonId: string,
  leagueTeamId: string,
): Promise<RemoveLeagueTeamResult> {
  const { data } = await api.post<RemoveLeagueTeamResult>(
    `${leagueTeamsPath(clubId, leagueId, seasonId)}/${leagueTeamId}/remove`,
  )
  return data
}

export async function copyLeagueTeams(
  clubId: string,
  leagueId: string,
  seasonId: string,
  payload: CopyLeagueTeamsPayload,
): Promise<CopyLeagueTeamsResult> {
  const { data } = await api.post<CopyLeagueTeamsResult>(`${leagueTeamsPath(clubId, leagueId, seasonId)}/copy`, payload)
  return data
}
