import api from './axiosConfig'
import type { ClubContact } from './clubContactApi'

// A club's self-referential section tree — docs/specs/025-club-structure.md. Single /manage-only
// namespace (no /platform mirror, same precedent as ClubContact/Sponsor/SponsorContact):
// AccessService.canAdministerClub already gives platform_admin a superset pass on these endpoints.
export interface Section {
  id: string
  clubId: string
  parentSectionId: string | null
  name: string
  minAge: number | null
  maxAge: number | null
  gender: 'MALE' | 'FEMALE' | null
  active: boolean
  createdAt: string
  updatedAt: string
  updatedBy: string | null
}

// Same shape for create and update, except parentSectionId — only settable at create time
// (re-parenting is out of scope, see the spec's Non-goals). Optional on the type since
// UpdateSectionRequest has no such field server-side.
export interface SectionPayload {
  name: string
  parentSectionId?: string | null
  minAge: number | null
  maxAge: number | null
  gender: 'MALE' | 'FEMALE' | null
}

function sectionsPath(clubId: string): string {
  return `/manage/clubs/${clubId}/sections`
}

// Plain array response, not Page<T> — a club's section tree is a small, bounded, fully-fetched
// list (see the spec's API Contract Architecture note): the client builds the tree from the flat
// list plus parentSectionId pointers, not a recursively-nested payload.
export async function listSections(clubId: string): Promise<Section[]> {
  const { data } = await api.get<Section[]>(sectionsPath(clubId))
  return data
}

export async function createSection(clubId: string, payload: SectionPayload): Promise<Section> {
  const { data } = await api.post<Section>(sectionsPath(clubId), payload)
  return data
}

export async function updateSection(
  clubId: string,
  sectionId: string,
  payload: SectionPayload,
): Promise<Section> {
  const { data } = await api.put<Section>(`${sectionsPath(clubId)}/${sectionId}`, payload)
  return data
}

export async function deactivateSection(clubId: string, sectionId: string): Promise<Section> {
  const { data } = await api.post<Section>(`${sectionsPath(clubId)}/${sectionId}/deactivate`)
  return data
}

export async function reactivateSection(clubId: string, sectionId: string): Promise<Section> {
  const { data } = await api.post<Section>(`${sectionsPath(clubId)}/${sectionId}/reactivate`)
  return data
}

// Reuses ClubContact from clubContactApi.ts — GET .../sections/{id}/contacts returns the same
// ClubContactDto shape server-side (docs/plans/025-club-structure.md item 5), no new type needed.
export async function listSectionContacts(clubId: string, sectionId: string): Promise<ClubContact[]> {
  const { data } = await api.get<ClubContact[]>(`${sectionsPath(clubId)}/${sectionId}/contacts`)
  return data
}

export async function linkSectionContact(clubId: string, sectionId: string, contactId: string): Promise<void> {
  await api.post(`${sectionsPath(clubId)}/${sectionId}/contacts/${contactId}/link`)
}

export async function unlinkSectionContact(clubId: string, sectionId: string, contactId: string): Promise<void> {
  await api.post(`${sectionsPath(clubId)}/${sectionId}/contacts/${contactId}/unlink`)
}
