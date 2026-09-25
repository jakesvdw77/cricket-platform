import api from './axiosConfig'
import type { SocialLink } from '../components/marketing/SocialLinksRow'

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
  // docs/specs/057-team-extended-profile.md: the same club-facing profile shape 053 already gave
  // League — every one nullable/optional, reusing SocialLinkDto/SocialLink unchanged.
  abbreviation: string | null
  groundName: string | null
  socialLinks: SocialLink[]
  active: boolean
  createdAt: string
  updatedAt: string
  updatedBy: string | null
}

// Same shape for create and update — CreateTeamRequest/UpdateTeamRequest are both
// {name, logoUrl?, abbreviation?, groundName?, socialLinks?} server-side (docs/specs/
// 027-team-profile.md extends both, Flag #1; docs/specs/057-team-extended-profile.md adds the
// three profile fields). sectionId is never part of the payload: it's fixed by the URL at create
// time and never editable afterwards (re-parenting is out of scope, see the spec's Non-goals).
export interface TeamPayload {
  name: string
  logoUrl?: string | null
  abbreviation?: string | null
  groundName?: string | null
  socialLinks?: SocialLink[]
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

export interface ListTeamsForClubParams {
  // docs/specs/035-section-scoped-access.md: narrows to one section's (and its descendants')
  // teams — a section-scoped caller's own default is already narrowed server-side regardless of
  // this param; it's an optional, further-narrowing convenience for any caller.
  sectionId?: string
}

// Backs the club-wide Teams directory — every team across every section, in one flat call.
export async function listTeamsForClub(clubId: string, params: ListTeamsForClubParams = {}): Promise<Team[]> {
  const { data } = await api.get<Team[]>(clubTeamsPath(clubId), {
    params: { ...(params.sectionId ? { sectionId: params.sectionId } : {}) },
  })
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
