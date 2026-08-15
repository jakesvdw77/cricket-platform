import api from '../api/axiosConfig'

export interface ClubBranding {
  displayName: string
  logoUrl: string
  faviconUrl: string
  primaryColor: string
}

// Fetches the current club's branding — see docs/specs/001-tenancy-identity-model.md's
// White-Labelling section. Not yet called from main.tsx: there's no
// /public/branding endpoint until docs/specs/003-club-onboarding.md is
// implemented. Once wired, the caller builds its theme with
// theme.ts's withClubBranding(data.primaryColor) and passes it to <ThemeProvider>.
export async function fetchClubBranding(slug: string): Promise<ClubBranding> {
  const { data } = await api.get<ClubBranding>('/public/branding', { params: { slug } })
  return data
}
