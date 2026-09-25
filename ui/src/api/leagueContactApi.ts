import api from './axiosConfig'

// A league's named contacts — docs/specs/054-league-contacts.md. Structural mirror of
// sponsorContactApi.ts, one level deeper (scoped to a leagueId, not just a clubId), and
// deliberately no photoUrl field (spec Non-goals). Single /manage-only namespace (no /platform
// mirror): AccessService.canAdministerClub already gives platform_admin a superset pass.
export interface LeagueContact {
  id: string
  leagueId: string
  contact: { firstName: string; lastName: string; email: string; phone: string }
  role: string
  isPrimary: boolean
  active: boolean
  createdAt: string
  updatedAt: string
  updatedBy: string | null
}

// Same field set for create and update — CreateLeagueContactRequest/UpdateLeagueContactRequest
// are identical shapes server-side, same as sponsorContactApi.ts's SponsorContactPayload
// precedent.
export interface LeagueContactPayload {
  contact: { firstName: string; lastName: string; email: string; phone: string }
  role: string
  isPrimary: boolean
}

function contactsPath(clubId: string, leagueId: string): string {
  return `/manage/clubs/${clubId}/leagues/${leagueId}/contacts`
}

// Plain array response, not Page<T> — a league's contacts are a small, bounded list,
// deliberately not paginated (same justification as sponsorContactApi.ts's listSponsorContacts).
export async function listLeagueContacts(clubId: string, leagueId: string): Promise<LeagueContact[]> {
  const { data } = await api.get<LeagueContact[]>(contactsPath(clubId, leagueId))
  return data
}

export async function createLeagueContact(
  clubId: string,
  leagueId: string,
  payload: LeagueContactPayload,
): Promise<LeagueContact> {
  const { data } = await api.post<LeagueContact>(contactsPath(clubId, leagueId), payload)
  return data
}

export async function updateLeagueContact(
  clubId: string,
  leagueId: string,
  contactId: string,
  payload: LeagueContactPayload,
): Promise<LeagueContact> {
  const { data } = await api.put<LeagueContact>(`${contactsPath(clubId, leagueId)}/${contactId}`, payload)
  return data
}

export async function deactivateLeagueContact(
  clubId: string,
  leagueId: string,
  contactId: string,
): Promise<LeagueContact> {
  const { data } = await api.post<LeagueContact>(`${contactsPath(clubId, leagueId)}/${contactId}/deactivate`)
  return data
}

export async function reactivateLeagueContact(
  clubId: string,
  leagueId: string,
  contactId: string,
): Promise<LeagueContact> {
  const { data } = await api.post<LeagueContact>(`${contactsPath(clubId, leagueId)}/${contactId}/reactivate`)
  return data
}
