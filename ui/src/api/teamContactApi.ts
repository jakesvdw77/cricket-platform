import api from './axiosConfig'
import type { ClubContact } from './clubContactApi'

// A team's linked ClubContact records, each carrying a team-specific role — docs/specs/
// 027-team-profile.md. Mirrors SectionContact's shape (sectionApi.ts's listSectionContacts/
// linkSectionContact/unlinkSectionContact) with one addition: unlike a bare ClubContactDto list,
// TeamContactDto wraps the embedded contact alongside its own id/role/createdAt, since the same
// ClubContact can hold a different role on a different team.
export interface TeamContact {
  id: string
  contact: ClubContact
  role: string
  createdAt: string
}

function teamContactsPath(clubId: string, sectionId: string, teamId: string): string {
  return `/manage/clubs/${clubId}/sections/${sectionId}/teams/${teamId}/contacts`
}

// Plain array response, not Page<T> — a team's contacts are a small, bounded list, same posture
// as every other join list in this codebase.
export async function listTeamContacts(clubId: string, sectionId: string, teamId: string): Promise<TeamContact[]> {
  const { data } = await api.get<TeamContact[]>(teamContactsPath(clubId, sectionId, teamId))
  return data
}

export async function linkTeamContact(
  clubId: string,
  sectionId: string,
  teamId: string,
  contactId: string,
  role: string,
): Promise<void> {
  await api.post(`${teamContactsPath(clubId, sectionId, teamId)}/${contactId}/link`, { role })
}

export async function unlinkTeamContact(
  clubId: string,
  sectionId: string,
  teamId: string,
  contactId: string,
): Promise<void> {
  await api.post(`${teamContactsPath(clubId, sectionId, teamId)}/${contactId}/unlink`)
}
