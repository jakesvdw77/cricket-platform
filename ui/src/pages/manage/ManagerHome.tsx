import { useQuery } from '@tanstack/react-query'
import { Box } from '@mui/material'
import { Outlet } from 'react-router-dom'
import { activateSession } from '../../api/meApi'
import { getManagedClubProfile } from '../../api/clubApi'
import { GridNavShell } from '../../components/GridNavShell'
import { EmptyState } from '../../components/EmptyState'
import { keycloak } from '../../auth/keycloak'

export default function ManagerHome() {
  // Same query key PostLoginRedirect.tsx already uses for this exact call — a fresh login's
  // cached result is reused here rather than double-fetched; a direct nav/refresh to /manage
  // fetches fresh (docs/specs/020-club-manager-access.md).
  const { data, isError } = useQuery({
    queryKey: ['me', 'activate'],
    queryFn: activateSession,
  })

  const clubId = data?.clubAdminClubIds[0]

  // Same query key ManageClubProfilePage.tsx/TeamFormPage.tsx already use for this club's
  // profile — a manager who later opens Club Profile reuses this cached result rather than
  // double-fetching. Real club branding (logo + name) in the header, replacing the generic
  // "Cricket Legend Platform" text every non-admin shell showed before — a platform_admin with
  // no CLUB_ADMIN grant landing here (clubId undefined) keeps the generic brand, disabling this
  // query entirely rather than fetching a profile for a club that doesn't exist.
  const { data: clubProfile } = useQuery({
    queryKey: ['managed-club', clubId, 'profile'],
    queryFn: () => getManagedClubProfile(clubId as string),
    enabled: Boolean(clubId),
  })

  if (isError || (data && !data.platformAdmin && data.clubAdminClubIds.length === 0)) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', px: 2, py: 5 }}>
        <EmptyState title="Not authorized" description="You are not recognized as a club manager." />
      </Box>
    )
  }

  if (!data) {
    return null
  }

  return (
    <GridNavShell
      brand={clubProfile?.name ?? 'Cricket Legend Platform'}
      logoUrl={clubProfile ? clubProfile.logoUrl : undefined}
      user={{ name: keycloak.tokenParsed?.name ?? '', email: keycloak.tokenParsed?.email }}
      onLogout={() => keycloak.logout()}
      profileTo="/manage/profile"
      homeTo="/manage"
    >
      <Outlet context={{ clubId }} />
    </GridNavShell>
  )
}
