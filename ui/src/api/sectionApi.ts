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

// A section with a linked contact is soft-deactivated (200 + the updated Section); one with
// nothing attached (no children, no linked contacts) is actually deleted server-side (204, no
// body) rather than left as an inactive placeholder — see docs/specs/025-club-structure.md's Data
// Model Changes Remove rule. `null` return means it was deleted.
export async function deactivateSection(clubId: string, sectionId: string): Promise<Section | null> {
  const { data } = await api.post<Section | '' | null>(`${sectionsPath(clubId)}/${sectionId}/deactivate`)
  // A 204 body comes back as '' (or occasionally null/undefined, depending on the response) —
  // a real Section is always truthy, so this normalizes every "nothing came back" case to null.
  return data || null
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

// docs/specs/094-club-structure-and-seasons.md: one request behind the Club profile's key figures
// and the read-only section panel. `totals.teams` is active teams and `totals.players` active,
// non-rejected club players; `leagues` are those the section's teams are entered in for the
// resolved season (the current one unless seasonId is sent).
export interface SectionsSummaryTotals {
  sections: number
  teams: number
  players: number
}

export interface SummaryLeagueRef {
  id: string
  name: string
}

export interface SectionSummary {
  sectionId: string
  teamCount: number
  activeTeamCount: number
  playerCount: number
  subtreeTeamCount: number
  subtreePlayerCount: number
  leagues: SummaryLeagueRef[]
}

export interface SectionsSummary {
  totals: SectionsSummaryTotals
  sections: SectionSummary[]
}

export interface SectionsSummaryParams {
  seasonId?: string
}

// Under the sections prefix ['managed-club', clubId, 'sections'] so invalidating that key also
// refreshes the summary.
export function sectionsSummaryKey(clubId: string, seasonId?: string) {
  return ['managed-club', clubId, 'sections', 'summary', ...(seasonId ? [seasonId] : [])] as const
}

export async function getSectionsSummary(
  clubId: string,
  { seasonId }: SectionsSummaryParams = {},
): Promise<SectionsSummary> {
  const { data } = await api.get<SectionsSummary>(`${sectionsPath(clubId)}/summary`, {
    params: seasonId ? { seasonId } : {},
  })
  return data
}
