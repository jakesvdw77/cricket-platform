import api from './axiosConfig'

// A club's named contacts — docs/specs/021-club-contacts.md. Single /manage-only namespace (no
// /platform mirror, unlike ClubProfile — see that spec's Architecture note): AccessService.
// canAdministerClub already gives platform_admin a superset pass on these endpoints.
export interface ClubContact {
  id: string
  clubId: string
  contact: { firstName: string; lastName: string; email: string; phone: string }
  role: string
  isPrimary: boolean
  active: boolean
  photoUrl: string | null
  createdAt: string
  updatedAt: string
  updatedBy: string | null
}

// Same field set for create and update — CreateClubContactRequest/UpdateClubContactRequest are
// identical shapes server-side (docs/plans/021-club-contacts.md item 3), unlike Product's
// narrower ProductPayload/UpdateProductPayload split.
export interface ClubContactPayload {
  contact: { firstName: string; lastName: string; email: string; phone: string }
  role: string
  isPrimary: boolean
  photoUrl: string | null
}

function contactsPath(clubId: string): string {
  return `/manage/clubs/${clubId}/contacts`
}

// Plain array response, not Page<T> — a club's contacts are a small, bounded list, deliberately
// not paginated (see the spec's Context note).
export async function listClubContacts(clubId: string): Promise<ClubContact[]> {
  const { data } = await api.get<ClubContact[]>(contactsPath(clubId))
  return data
}

export async function createClubContact(clubId: string, payload: ClubContactPayload): Promise<ClubContact> {
  const { data } = await api.post<ClubContact>(contactsPath(clubId), payload)
  return data
}

export async function updateClubContact(
  clubId: string,
  contactId: string,
  payload: ClubContactPayload,
): Promise<ClubContact> {
  const { data } = await api.put<ClubContact>(`${contactsPath(clubId)}/${contactId}`, payload)
  return data
}

export async function deactivateClubContact(clubId: string, contactId: string): Promise<ClubContact> {
  const { data } = await api.post<ClubContact>(`${contactsPath(clubId)}/${contactId}/deactivate`)
  return data
}

export async function reactivateClubContact(clubId: string, contactId: string): Promise<ClubContact> {
  const { data } = await api.post<ClubContact>(`${contactsPath(clubId)}/${contactId}/reactivate`)
  return data
}
