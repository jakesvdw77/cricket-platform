import api from './axiosConfig'
import type { Page } from './productApi'
import type { SocialLink } from '../components/marketing/SocialLinksRow'

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

// --- Club Profile (docs/specs/012-club-profile.md) ---

export type ClubProfileType = 'CLUB' | 'ACADEMY' | 'SCHOOL' | 'OTHER'

// Deliberately generic, not ClubAddress — mirrors com.cricketlegend.dto.AddressDto on the
// backend. clubApi.ts is the canonical home for this type since ClubProfile is its first
// consumer; a future clubContactApi.ts/sponsorApi.ts should `import type { Address } from
// './clubApi'` rather than redefining the same six fields (see docs/plans/012-club-profile.md
// item 1).
export interface Address {
  number: string | null
  street: string | null
  city: string | null
  provinceState: string | null
  country: string | null
  postalCode: string | null
}

// Read shape of GET /platform/clubs/{id}/profile — mirrors ClubProfileDto exactly. A brand-new
// Club has no ClubProfile row yet, so the backend returns this default-shaped (every field null
// except clubId) rather than 404 — see docs/specs/012-club-profile.md's API Contract.
export interface ClubProfile {
  clubId: string
  type: ClubProfileType | null
  logoUrl: string | null
  bannerUrl: string | null
  address: Address | null
  email: string | null
  phone: string | null
  website: string | null
  // Optional (unlike every other field on this type) purely so pre-existing test fixtures built
  // before this field existed keep compiling unmodified — the real backend response always
  // includes it (defaults to []), never omits it, so a consumer can safely treat a missing value
  // the same as an empty array.
  socialLinks?: SocialLink[]
  createdAt: string | null
  updatedAt: string | null
  updatedBy: string | null
}

// PUT /platform/clubs/{id}/profile payload — mirrors UpdateClubProfileRequest. A full-resource
// replace, not a partial patch: every field is optional/nullable, and an omitted field nulls out
// a previously-saved value (see docs/plans/012-club-profile.md Flag #4).
export interface ClubProfilePayload {
  type?: ClubProfileType | null
  logoUrl?: string | null
  bannerUrl?: string | null
  address?: Address | null
  email?: string | null
  phone?: string | null
  website?: string | null
  // Optional, unlike ClubProfile's read-side field — omitting it clears any existing links,
  // same "full-resource replace, omitted clears" semantics every other field on this payload
  // already has (see the type's own doc comment above).
  socialLinks?: SocialLink[]
}

export async function getClubProfile(id: string): Promise<ClubProfile> {
  const { data } = await api.get<ClubProfile>(`/platform/clubs/${id}/profile`)
  return data
}

export async function updateClubProfile(id: string, payload: ClubProfilePayload): Promise<ClubProfile> {
  const { data } = await api.put<ClubProfile>(`/platform/clubs/${id}/profile`, payload)
  return data
}

// --- Club Profile, /manage namespace (docs/specs/020-club-manager-access.md) ---
// Same request/response shape as the /platform pair above — a club admin (CLUB_ADMIN
// RoleAssignment for this club) self-servicing their own club's profile, rather than a
// platform admin editing any club's.

export async function getManagedClubProfile(id: string): Promise<ClubProfile> {
  const { data } = await api.get<ClubProfile>(`/manage/clubs/${id}/profile`)
  return data
}

export async function updateManagedClubProfile(id: string, payload: ClubProfilePayload): Promise<ClubProfile> {
  const { data } = await api.put<ClubProfile>(`/manage/clubs/${id}/profile`, payload)
  return data
}
