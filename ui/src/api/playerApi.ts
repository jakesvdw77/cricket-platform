import api from './axiosConfig'
import type { Section } from './sectionApi'

// A club's player roster — docs/specs/028-players.md. One flat PlayerDto composed server-side
// from Person (identity) + PlayerProfile (everything else) + sectionIds (bare ids, joined against
// listSections(clubId) client-side, same pattern TeamDirectory.tsx already uses for section
// names). Single /manage-only namespace (no /platform mirror, same precedent as Section/Team/
// Sponsor): AccessService.canAdministerClub already gives platform_admin a superset pass on these
// endpoints.
export type Gender = 'MALE' | 'FEMALE'
export type BattingStance = 'RIGHT_HANDED' | 'LEFT_HANDED'
export type BowlingArm = 'RIGHT_ARM' | 'LEFT_ARM'
export type BowlingType =
  | 'FAST'
  | 'FAST_MEDIUM'
  | 'MEDIUM_FAST'
  | 'MEDIUM'
  | 'OFF_BREAK'
  | 'LEG_BREAK'
  | 'ORTHODOX_SPIN'
  | 'WRIST_SPIN'
  | 'GOOGLY'

export interface Player {
  id: string
  personId: string
  clubId: string
  firstName: string
  lastName: string
  dateOfBirth: string | null
  gender: Gender | null
  photoUrl: string | null
  clubMembershipNumber: string | null
  medicalAidProvider: string | null
  medicalAidMemberNumber: string | null
  phone: string | null
  email: string | null
  altContactName: string | null
  altContactPhone: string | null
  battingStance: BattingStance | null
  bowlingArm: BowlingArm | null
  bowlingType: BowlingType | null
  isWicketKeeper: boolean
  active: boolean
  sectionIds: string[]
  // docs/specs/031-jersey-numbers.md: the player's own "usual"/standing number, independent of any
  // specific team/season squad membership (see teamSquadApi.ts's SquadMember.squadJerseyNumber).
  jerseyNumber: number | null
  createdAt: string
  updatedAt: string
  updatedBy: string | null
  // docs/specs/088-players-polls-alignment.md: VERIFIED for every manager-created player; UNVERIFIED will come from
  // the future self-registration flow; REJECTED players are hidden from the default list. A suspended player is
  // `active: false`, not a status here.
  verificationStatus: PlayerVerificationStatus
}

export type PlayerVerificationStatus = 'VERIFIED' | 'UNVERIFIED' | 'REJECTED'

// Same shape for create and update (the backend's UpdatePlayerRequest is byte-for-byte
// CreatePlayerRequest, per the spec's API Contract — "Same body shape as create"). sectionIds is
// never part of this payload: create never takes sectionIds (tagging happens via the separate
// link/unlink endpoints below, after the player exists), and update never re-tags sections either.
export interface PlayerPayload {
  firstName: string
  lastName: string
  // docs/specs/077: required on create and update (ISO yyyy-MM-dd, 1900-01-01 to today).
  dateOfBirth: string
  gender: Gender | null
  photoUrl: string | null
  clubMembershipNumber: string | null
  medicalAidProvider: string | null
  medicalAidMemberNumber: string | null
  phone: string | null
  email: string | null
  altContactName: string | null
  altContactPhone: string | null
  battingStance: BattingStance | null
  bowlingArm: BowlingArm | null
  bowlingType: BowlingType | null
  isWicketKeeper: boolean
  // docs/specs/031-jersey-numbers.md, nullable, no uniqueness enforced against it.
  jerseyNumber: number | null
}

function playersPath(clubId: string): string {
  return `/manage/clubs/${clubId}/players`
}

export interface ListPlayersParams {
  // docs/specs/035-section-scoped-access.md: narrows to one section's (and its descendants')
  // players — a section-scoped caller's own default is already narrowed server-side regardless of
  // this param; it's an optional, further-narrowing convenience for any caller.
  sectionId?: string
  // docs/specs/077: only players with no date of birth (combines with sectionId).
  missingDateOfBirth?: boolean
  // docs/specs/088: false also leaves out suspended (inactive) and rejected players; unverified players always stay.
  // Omitted, the server default (everyone) applies, so the pickers that call listPlayers are unchanged.
  includeInactive?: boolean
  // A Players quick filter (the same definitions the summary counters count). The two season focuses need seasonId.
  focus?: PlayerListFocus
  seasonId?: string
}

export type PlayerListFocus = 'in-squad' | 'selected' | 'unverified'

// Plain array response, not Page<T> — a club's players are a small, bounded, unpaginated list,
// matching Section/Team/Sponsor's own posture.
export async function listPlayers(clubId: string, params: ListPlayersParams = {}): Promise<Player[]> {
  const { data } = await api.get<Player[]>(playersPath(clubId), {
    params: {
      ...(params.sectionId ? { sectionId: params.sectionId } : {}),
      ...(params.missingDateOfBirth ? { missingDateOfBirth: true } : {}),
      ...(params.includeInactive === false ? { includeInactive: false } : {}),
      ...(params.focus ? { focus: params.focus } : {}),
      ...(params.seasonId ? { seasonId: params.seasonId } : {}),
    },
  })
  return data
}

// docs/specs/088: the Players page counters for exactly the filters the list uses. playersShown is the list's size;
// the other three equal its size with that focus. The two season figures are 0 without a seasonId.
export interface PlayersSummary {
  playersShown: number
  inSquad: number
  selected: number
  unverified: number
}

export interface PlayersSummaryFilters {
  sectionId?: string
  missingDateOfBirth?: boolean
  includeInactive?: boolean
  seasonId?: string
}

// Under the list's own ['managed-club', clubId, 'players'] prefix, so every invalidation that refreshes the list (a
// status change, an edit) refreshes the counters too.
export const playersSummaryKey = (clubId: string, filters: PlayersSummaryFilters = {}) =>
  ['managed-club', clubId, 'players', 'summary', filters] as const

export async function getPlayersSummary(clubId: string, filters: PlayersSummaryFilters = {}): Promise<PlayersSummary> {
  const params: Record<string, string | boolean> = {}
  if (filters.sectionId) params.sectionId = filters.sectionId
  if (filters.missingDateOfBirth) params.missingDateOfBirth = true
  if (filters.includeInactive === false) params.includeInactive = false
  if (filters.seasonId) params.seasonId = filters.seasonId
  const { data } = await api.get<PlayersSummary>(`${playersPath(clubId)}/summary`, { params })
  return data
}

// docs/specs/088: accept a player request (or undo a reject), and reject an unverified one (kept but hidden).
export async function verifyPlayer(clubId: string, playerId: string): Promise<Player> {
  const { data } = await api.post<Player>(`${playersPath(clubId)}/${playerId}/verify`)
  return data
}

export async function rejectPlayer(clubId: string, playerId: string): Promise<Player> {
  const { data } = await api.post<Player>(`${playersPath(clubId)}/${playerId}/reject`)
  return data
}

export async function createPlayer(clubId: string, payload: PlayerPayload): Promise<Player> {
  const { data } = await api.post<Player>(playersPath(clubId), payload)
  return data
}

export async function updatePlayer(clubId: string, playerId: string, payload: PlayerPayload): Promise<Player> {
  const { data } = await api.put<Player>(`${playersPath(clubId)}/${playerId}`, payload)
  return data
}

export async function deactivatePlayer(clubId: string, playerId: string): Promise<Player> {
  const { data } = await api.post<Player>(`${playersPath(clubId)}/${playerId}/deactivate`)
  return data
}

export async function reactivatePlayer(clubId: string, playerId: string): Promise<Player> {
  const { data } = await api.post<Player>(`${playersPath(clubId)}/${playerId}/reactivate`)
  return data
}

// Reuses Section from sectionApi.ts — GET .../players/{id}/sections returns the same SectionDto
// shape server-side, no new type needed.
export async function listPlayerSections(clubId: string, playerId: string): Promise<Section[]> {
  const { data } = await api.get<Section[]>(`${playersPath(clubId)}/${playerId}/sections`)
  return data
}

export async function linkPlayerSection(clubId: string, playerId: string, sectionId: string): Promise<void> {
  await api.post(`${playersPath(clubId)}/${playerId}/sections/${sectionId}/link`)
}

export async function unlinkPlayerSection(clubId: string, playerId: string, sectionId: string): Promise<void> {
  await api.post(`${playersPath(clubId)}/${playerId}/sections/${sectionId}/unlink`)
}
