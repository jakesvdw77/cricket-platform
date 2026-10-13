import api from './axiosConfig'
import type { FieldCategory, FieldVerificationStatus, PlayingArea, PlayingAreaPayload } from './playingAreaApi'
import type { Page } from './productApi'

// docs/specs/099-fields-directory.md: the platform-admin moderation API under /api/v1/platform/playing-areas (gated to
// platform_admin by URL). Written against the spec's API Contract.

export interface PlatformLinkedClub {
  id: string
  name: string
}

// The admin's full record: every linked club, the matches using it and possible duplicates.
export interface PlatformPlayingArea extends PlayingArea {
  linkedClubs?: PlatformLinkedClub[]
}

export interface ListPlatformPlayingAreasParams {
  page?: number
  size?: number
  // Defaults to UNVERIFIED server-side; oldest first.
  verification?: FieldVerificationStatus
  q?: string
  category?: FieldCategory
  country?: string
  // Newest first instead of the server's oldest first.
  sort?: string
}

export interface PlatformPlayingAreasSummary {
  unverified: number
  verified: number
  rejected: number
}

export const PLATFORM_FIELDS_KEY = ['platform', 'playing-areas'] as const
export const platformFieldsSummaryKey = [...PLATFORM_FIELDS_KEY, 'summary'] as const

const BASE = '/platform/playing-areas'

// The server sends the clubs using a field as a list; the screens read a count.
function withClubCount<T extends PlayingArea>(area: T): T {
  return area.linkedClubs ? { ...area, linkedClubCount: area.linkedClubs.length } : area
}

export async function listPlatformPlayingAreas(params: ListPlatformPlayingAreasParams = {}): Promise<Page<PlayingArea>> {
  const { page = 0, size = 20, verification, q, category, country, sort } = params
  const { data } = await api.get<Page<PlayingArea>>(BASE, {
    params: {
      page,
      size,
      ...(verification ? { verification } : {}),
      ...(q ? { q } : {}),
      ...(category ? { category } : {}),
      ...(country ? { country } : {}),
      ...(sort ? { sort } : {}),
    },
  })
  return { ...data, content: data.content.map(withClubCount) }
}

export async function getPlatformPlayingAreasSummary(): Promise<PlatformPlayingAreasSummary> {
  const { data } = await api.get<PlatformPlayingAreasSummary>(`${BASE}/summary`)
  return data
}

export async function getPlatformPlayingArea(id: string): Promise<PlatformPlayingArea> {
  const { data } = await api.get<PlatformPlayingArea>(`${BASE}/${id}`)
  return withClubCount(data)
}

// Edit any field in any state; editing a verified field keeps it verified.
export async function updatePlatformPlayingArea(id: string, payload: PlayingAreaPayload): Promise<PlatformPlayingArea> {
  const { data } = await api.put<PlatformPlayingArea>(`${BASE}/${id}`, payload)
  return withClubCount(data)
}

export async function verifyPlayingArea(id: string): Promise<PlayingArea> {
  const { data } = await api.post<PlayingArea>(`${BASE}/${id}/verify`)
  return withClubCount(data)
}

export async function rejectPlayingArea(id: string, reason: string): Promise<PlayingArea> {
  const { data } = await api.post<PlayingArea>(`${BASE}/${id}/reject`, { reason })
  return withClubCount(data)
}

export async function reopenPlayingArea(id: string): Promise<PlayingArea> {
  const { data } = await api.post<PlayingArea>(`${BASE}/${id}/reopen`)
  return withClubCount(data)
}

// One transaction on the server: matches and club links move to the target, this record is hidden.
export async function mergePlayingArea(id: string, targetPlayingAreaId: string): Promise<PlayingArea> {
  const { data } = await api.post<PlayingArea>(`${BASE}/${id}/merge`, { targetPlayingAreaId })
  return withClubCount(data)
}
