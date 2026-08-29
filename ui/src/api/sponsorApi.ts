import api from './axiosConfig'
import type { SocialLink } from '../components/marketing/SocialLinksRow'

// A club's sponsors — docs/specs/023-sponsors.md. Single /manage-only namespace (no /platform
// mirror, same reasoning 021 already established for ClubContact): AccessService.
// canAdministerClub already gives platform_admin a superset pass on these endpoints.
export interface Sponsor {
  id: string
  clubId: string
  name: string
  website: string | null
  email: string | null
  phone: string | null
  logoUrl: string | null
  bannerUrl: string | null
  socialLinks: SocialLink[]
  active: boolean
  createdAt: string
  updatedAt: string
  updatedBy: string | null
}

// Same field set for create and update — CreateSponsorRequest/UpdateSponsorRequest are identical
// shapes server-side (docs/plans/023-sponsors.md item 3), mirroring ClubContactPayload's shape
// rather than Product's narrower create/update split.
export interface SponsorPayload {
  name: string
  website: string | null
  email: string | null
  phone: string | null
  logoUrl: string | null
  bannerUrl: string | null
  socialLinks: SocialLink[]
}

function sponsorsPath(clubId: string): string {
  return `/manage/clubs/${clubId}/sponsors`
}

// Plain array response, not Page<T> — a club's sponsors are a small, bounded list, deliberately
// not paginated (same reasoning as ClubContact's list endpoint).
export async function listSponsors(clubId: string): Promise<Sponsor[]> {
  const { data } = await api.get<Sponsor[]>(sponsorsPath(clubId))
  return data
}

export async function createSponsor(clubId: string, payload: SponsorPayload): Promise<Sponsor> {
  const { data } = await api.post<Sponsor>(sponsorsPath(clubId), payload)
  return data
}

export async function updateSponsor(clubId: string, sponsorId: string, payload: SponsorPayload): Promise<Sponsor> {
  const { data } = await api.put<Sponsor>(`${sponsorsPath(clubId)}/${sponsorId}`, payload)
  return data
}

export async function deactivateSponsor(clubId: string, sponsorId: string): Promise<Sponsor> {
  const { data } = await api.post<Sponsor>(`${sponsorsPath(clubId)}/${sponsorId}/deactivate`)
  return data
}

export async function reactivateSponsor(clubId: string, sponsorId: string): Promise<Sponsor> {
  const { data } = await api.post<Sponsor>(`${sponsorsPath(clubId)}/${sponsorId}/reactivate`)
  return data
}
