import api from './axiosConfig'

// A named Team, placed under a Section — docs/specs/026-teams.md. Single /manage-only namespace
// (no /platform mirror, same precedent as ClubContact/Sponsor/Section): AccessService.
// canAdministerClub already gives platform_admin a superset pass on these endpoints. Never
// hard-deleted — deactivate/reactivate only (see the spec's Non-goals).
export interface Team {
  id: string
  clubId: string
  sectionId: string
  name: string
  // Nullable — same posture as Sponsor.logoUrl/ClubProfile.logoUrl (docs/specs/
  // 027-team-profile.md). null means the team has no logo override of its own; the UI falls back
  // to showing the club's own logo, a UI-layer resolution, not a stored "inherited" state.
  logoUrl: string | null
  active: boolean
  createdAt: string
  updatedAt: string
  updatedBy: string | null
}

// Same shape for create and update — CreateTeamRequest/UpdateTeamRequest are both {name, logoUrl?}
// server-side (docs/specs/027-team-profile.md extends both, Flag #1). sectionId is never part of
// the payload: it's fixed by the URL at create time and never editable afterwards (re-parenting is
// out of scope, see the spec's Non-goals).
export interface TeamPayload {
  name: string
  logoUrl?: string | null
}

function teamsPath(clubId: string, sectionId: string): string {
  return `/manage/clubs/${clubId}/sections/${sectionId}/teams`
}

function clubTeamsPath(clubId: string): string {
  return `/manage/clubs/${clubId}/teams`
}

// Plain array response, not Page<T> — a section's (or a club's) teams are a small, bounded,
// unpaginated list, matching Section/ClubContact's own posture.
export async function listTeamsForSection(clubId: string, sectionId: string): Promise<Team[]> {
  const { data } = await api.get<Team[]>(teamsPath(clubId, sectionId))
  return data
}

// Backs the club-wide Teams directory — every team across every section, in one flat call.
export async function listTeamsForClub(clubId: string): Promise<Team[]> {
  const { data } = await api.get<Team[]>(clubTeamsPath(clubId))
  return data
}

export async function createTeam(clubId: string, sectionId: string, payload: TeamPayload): Promise<Team> {
  const { data } = await api.post<Team>(teamsPath(clubId, sectionId), payload)
  return data
}

export async function updateTeam(
  clubId: string,
  sectionId: string,
  teamId: string,
  payload: TeamPayload,
): Promise<Team> {
  const { data } = await api.put<Team>(`${teamsPath(clubId, sectionId)}/${teamId}`, payload)
  return data
}

export async function deactivateTeam(clubId: string, sectionId: string, teamId: string): Promise<Team> {
  const { data } = await api.post<Team>(`${teamsPath(clubId, sectionId)}/${teamId}/deactivate`)
  return data
}

export async function reactivateTeam(clubId: string, sectionId: string, teamId: string): Promise<Team> {
  const { data } = await api.post<Team>(`${teamsPath(clubId, sectionId)}/${teamId}/reactivate`)
  return data
}
