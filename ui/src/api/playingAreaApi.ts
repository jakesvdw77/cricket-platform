import api from './axiosConfig'
import type { Address } from './clubApi'
import type { Page } from './productApi'

// docs/specs/099-fields-directory.md: the club-scoped Fields directory API. The backend record is a `PlayingArea`
// (area_type CRICKET_FIELD); the UI only ever says "Field". The directory is platform-wide, `clubId` scopes the caller
// and the `linkedHome` flag. Written against the spec's API Contract; the DTO property names below are the ones this
// client expects.

export type FieldVerificationStatus = 'UNVERIFIED' | 'VERIFIED' | 'REJECTED'
export type FieldCategory = 'SCHOOL' | 'CLUB' | 'ACADEMY' | 'MUNICIPAL' | 'PROVINCIAL'
export type FieldOwnerType = 'CLUB' | 'SCHOOL' | 'PROVINCE' | 'OTHER'

// The only area type this spec creates or lists. Always sent on the list/similar calls.
export const FIELD_AREA_TYPE = 'CRICKET_FIELD'

export interface PlayingArea {
  id: string
  name: string
  category: FieldCategory
  ownerType: FieldOwnerType
  ownerName: string
  // `country` holds the ISO 3166-1 alpha-2 code for a field (the UI shows the name).
  address: Address
  mapUrl: string | null
  locationNotes: string | null
  verificationStatus: FieldVerificationStatus
  verifiedAt?: string | null
  rejectionReason?: string | null
  // The club whose manager captured it (null when a platform admin did); only that club may edit while unverified.
  createdByClubId?: string | null
  createdByClubName?: string | null
  createdAt?: string | null
  // Club-scoped responses: is this field one of the calling club's home fields.
  linkedHome?: boolean
  // Club-scoped: this club's matches on the field. Platform: every match using it.
  matchCount?: number
  linkedClubCount?: number
  // Platform responses list the clubs using it; linkedClubCount is derived from this on the client.
  linkedClubs?: { id: string; name: string }[]
  // Platform responses: existing fields that look like a duplicate of this one (name only, for the card).
  possibleDuplicates?: { id: string; name: string }[]
}

export interface PlayingAreaPayload {
  name: string
  category: FieldCategory
  ownerType: FieldOwnerType
  ownerName: string
  address: Address
  mapUrl: string | null
  locationNotes: string | null
}

export interface ListPlayingAreasParams {
  page?: number
  size?: number
  // Descending name order only; the server default is home fields first, then name.
  sort?: string
  q?: string
  category?: FieldCategory
  country?: string
  province?: string
  city?: string
  verification?: Exclude<FieldVerificationStatus, 'REJECTED'>
  // Only this club's home fields.
  mine?: boolean
}

export interface PlayingAreasSummary {
  ownFields: number
  inDirectory: number
  unverified: number
}

export type PlayingAreasSummaryFilters = Pick<ListPlayingAreasParams, 'q' | 'category' | 'country' | 'province' | 'city'>

export interface PlayingAreaFilterOptions {
  countries: string[]
  provinces: string[]
  cities: string[]
}

export type PlayingAreaFilterOptionsParams = Pick<ListPlayingAreasParams, 'category' | 'country' | 'province' | 'city' | 'q'>

export interface SimilarPlayingAreasParams {
  name: string
  city?: string
  country?: string
}

// Under the list's own prefix, so one invalidateQueries refreshes the list, the counters, the picker and a single field.
export const playingAreasKey = (clubId: string) => ['managed-club', clubId, 'playing-areas'] as const
export const playingAreasSummaryKey = (clubId: string, filters: PlayingAreasSummaryFilters = {}) =>
  [...playingAreasKey(clubId), 'summary', filters] as const

function basePath(clubId: string): string {
  return `/manage/clubs/${clubId}/playing-areas`
}

function definedParams(params: object): Record<string, string | number | boolean> {
  const result: Record<string, string | number | boolean> = {}
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '' && value !== false) {
      result[key] = value as string | number | boolean
    }
  })
  return result
}

// Paged by the backend (real LIMIT/OFFSET). `areaType` is always CRICKET_FIELD in this spec.
export async function listPlayingAreas(clubId: string, params: ListPlayingAreasParams = {}): Promise<Page<PlayingArea>> {
  const { page = 0, size = 20, ...filters } = params
  const { data } = await api.get<Page<PlayingArea>>(basePath(clubId), {
    params: { page, size, areaType: FIELD_AREA_TYPE, ...definedParams(filters) },
  })
  return data
}

export async function getPlayingAreasSummary(clubId: string, filters: PlayingAreasSummaryFilters = {}): Promise<PlayingAreasSummary> {
  const { data } = await api.get<PlayingAreasSummary>(`${basePath(clubId)}/summary`, {
    params: { areaType: FIELD_AREA_TYPE, ...definedParams(filters) },
  })
  return data
}

export async function listPlayingAreaFilterOptions(
  clubId: string,
  params: PlayingAreaFilterOptionsParams = {},
): Promise<PlayingAreaFilterOptions> {
  const { data } = await api.get<PlayingAreaFilterOptions>(`${basePath(clubId)}/filter-options`, {
    params: { areaType: FIELD_AREA_TYPE, ...definedParams(params) },
  })
  return data
}

// "Did you mean": up to 5 existing fields with a similar name in the same country. Read-only.
export async function findSimilarPlayingAreas(clubId: string, params: SimilarPlayingAreasParams): Promise<PlayingArea[]> {
  const { data } = await api.get<PlayingArea[]>(`${basePath(clubId)}/similar`, {
    params: { areaType: FIELD_AREA_TYPE, ...definedParams(params) },
  })
  return data
}

export async function getPlayingArea(clubId: string, id: string): Promise<PlayingArea> {
  const { data } = await api.get<PlayingArea>(`${basePath(clubId)}/${id}`)
  return data
}

// 409 with a `existingPlayingAreaId` property when the same name, city and country already exist.
export async function createPlayingArea(clubId: string, payload: PlayingAreaPayload): Promise<PlayingArea> {
  const { data } = await api.post<PlayingArea>(basePath(clubId), payload)
  return data
}

export async function updatePlayingArea(clubId: string, id: string, payload: PlayingAreaPayload): Promise<PlayingArea> {
  const { data } = await api.put<PlayingArea>(`${basePath(clubId)}/${id}`, payload)
  return data
}

export async function linkPlayingAreaHome(clubId: string, id: string): Promise<void> {
  await api.put(`${basePath(clubId)}/${id}/home`)
}

export async function unlinkPlayingAreaHome(clubId: string, id: string): Promise<void> {
  await api.delete(`${basePath(clubId)}/${id}/home`)
}
