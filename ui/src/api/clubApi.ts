import api from './axiosConfig'
import type { Page } from './productApi'

// Re-exported for consumers of this file — same Spring Data Page<T> JSON envelope productApi.ts
// already defines, no reason for a third copy (subscriptionApi.ts already follows this
// precedent, see docs/plans/010-minimal-club-creation.md item 1).
export type { Page }

export type ClubStatus = 'ONBOARDING' | 'ACTIVE' | 'SUSPENDED'

export interface Club {
  id: string
  name: string
  slug: string
  status: ClubStatus
  createdAt: string
  updatedAt: string
  updatedBy: string | null
}

// Create/update shape — mirrors CreateClubRequest/UpdateClubRequest. No status field: status
// only ever moves via the dedicated suspend/reactivate endpoints below.
export interface ClubPayload {
  name: string
  slug: string
}

export interface ListClubsParams {
  page: number
  size?: number
  // Case-insensitive substring match against name OR slug — omitted/blank returns everything.
  search?: string
  // Spring Data's native Pageable sort format, e.g. 'name,asc'.
  sort?: string
}

export async function listClubs({ page, size = 20, search, sort }: ListClubsParams): Promise<Page<Club>> {
  const { data } = await api.get<Page<Club>>('/platform/clubs', {
    params: {
      page,
      size,
      ...(search ? { search } : {}),
      ...(sort ? { sort } : {}),
    },
  })
  return data
}

export async function getClub(id: string): Promise<Club> {
  const { data } = await api.get<Club>(`/platform/clubs/${id}`)
  return data
}

export async function createClub(payload: ClubPayload): Promise<Club> {
  const { data } = await api.post<Club>('/platform/clubs', payload)
  return data
}

export async function updateClub(id: string, payload: ClubPayload): Promise<Club> {
  const { data } = await api.put<Club>(`/platform/clubs/${id}`, payload)
  return data
}

export async function suspendClub(id: string): Promise<Club> {
  const { data } = await api.post<Club>(`/platform/clubs/${id}/suspend`)
  return data
}

export async function reactivateClub(id: string): Promise<Club> {
  const { data } = await api.post<Club>(`/platform/clubs/${id}/reactivate`)
  return data
}
