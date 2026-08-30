import api from './axiosConfig'
import type { Sponsor } from './sponsorApi'

// A team's linked Sponsor records — docs/specs/027-team-profile.md. Bare join, mirroring
// SectionContact's list shape exactly (no extra join data to carry, unlike TeamContact's role) —
// returns Sponsor[] directly, reusing sponsorApi.ts's existing type rather than redefining it.
function teamSponsorsPath(clubId: string, sectionId: string, teamId: string): string {
  return `/manage/clubs/${clubId}/sections/${sectionId}/teams/${teamId}/sponsors`
}

// Plain array response, not Page<T> — a team's sponsors are a small, bounded list, same posture
// as every other join list in this codebase.
export async function listTeamSponsors(clubId: string, sectionId: string, teamId: string): Promise<Sponsor[]> {
  const { data } = await api.get<Sponsor[]>(teamSponsorsPath(clubId, sectionId, teamId))
  return data
}

export async function linkTeamSponsor(
  clubId: string,
  sectionId: string,
  teamId: string,
  sponsorId: string,
): Promise<void> {
  await api.post(`${teamSponsorsPath(clubId, sectionId, teamId)}/${sponsorId}/link`)
}

export async function unlinkTeamSponsor(
  clubId: string,
  sectionId: string,
  teamId: string,
  sponsorId: string,
): Promise<void> {
  await api.post(`${teamSponsorsPath(clubId, sectionId, teamId)}/${sponsorId}/unlink`)
}
