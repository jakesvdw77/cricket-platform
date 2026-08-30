import api from './axiosConfig'

// A sponsor's named contacts — docs/specs/024-sponsor-contacts.md. Structural mirror of
// clubContactApi.ts, one level deeper (scoped to a sponsorId, not just a clubId), and
// deliberately no photoUrl field (spec Non-goals). Single /manage-only namespace (no /platform
// mirror): AccessService.canAdministerClub already gives platform_admin a superset pass.
export interface SponsorContact {
  id: string
  sponsorId: string
  contact: { firstName: string; lastName: string; email: string; phone: string }
  role: string
  isPrimary: boolean
  active: boolean
  createdAt: string
  updatedAt: string
  updatedBy: string | null
}

// Same field set for create and update — CreateSponsorContactRequest/UpdateSponsorContactRequest
// are identical shapes server-side, same as clubContactApi.ts's ClubContactPayload precedent.
export interface SponsorContactPayload {
  contact: { firstName: string; lastName: string; email: string; phone: string }
  role: string
  isPrimary: boolean
}

function contactsPath(clubId: string, sponsorId: string): string {
  return `/manage/clubs/${clubId}/sponsors/${sponsorId}/contacts`
}

// Plain array response, not Page<T> — a sponsor's contacts are a small, bounded list,
// deliberately not paginated (same justification as clubContactApi.ts's listClubContacts).
export async function listSponsorContacts(clubId: string, sponsorId: string): Promise<SponsorContact[]> {
  const { data } = await api.get<SponsorContact[]>(contactsPath(clubId, sponsorId))
  return data
}

export async function createSponsorContact(
  clubId: string,
  sponsorId: string,
  payload: SponsorContactPayload,
): Promise<SponsorContact> {
  const { data } = await api.post<SponsorContact>(contactsPath(clubId, sponsorId), payload)
  return data
}

export async function updateSponsorContact(
  clubId: string,
  sponsorId: string,
  contactId: string,
  payload: SponsorContactPayload,
): Promise<SponsorContact> {
  const { data } = await api.put<SponsorContact>(`${contactsPath(clubId, sponsorId)}/${contactId}`, payload)
  return data
}

export async function deactivateSponsorContact(
  clubId: string,
  sponsorId: string,
  contactId: string,
): Promise<SponsorContact> {
  const { data } = await api.post<SponsorContact>(`${contactsPath(clubId, sponsorId)}/${contactId}/deactivate`)
  return data
}

export async function reactivateSponsorContact(
  clubId: string,
  sponsorId: string,
  contactId: string,
): Promise<SponsorContact> {
  const { data } = await api.post<SponsorContact>(`${contactsPath(clubId, sponsorId)}/${contactId}/reactivate`)
  return data
}
