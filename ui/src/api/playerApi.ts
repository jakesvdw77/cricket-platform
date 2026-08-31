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
  createdAt: string
  updatedAt: string
  updatedBy: string | null
}

// Same shape for create and update (the backend's UpdatePlayerRequest is byte-for-byte
// CreatePlayerRequest, per the spec's API Contract — "Same body shape as create"). sectionIds is
// never part of this payload: create never takes sectionIds (tagging happens via the separate
// link/unlink endpoints below, after the player exists), and update never re-tags sections either.
export interface PlayerPayload {
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
}

function playersPath(clubId: string): string {
  return `/manage/clubs/${clubId}/players`
}

// Plain array response, not Page<T> — a club's players are a small, bounded, unpaginated list,
// matching Section/Team/Sponsor's own posture.
export async function listPlayers(clubId: string): Promise<Player[]> {
  const { data } = await api.get<Player[]>(playersPath(clubId))
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
