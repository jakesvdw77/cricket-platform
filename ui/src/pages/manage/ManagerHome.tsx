import { useQuery } from '@tanstack/react-query'
import { Box } from '@mui/material'
import { Outlet } from 'react-router-dom'
import { activateSession } from '../../api/meApi'
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
      brand="Cricket Legend Platform"
      user={{ name: keycloak.tokenParsed?.name ?? '', email: keycloak.tokenParsed?.email }}
      onLogout={() => keycloak.logout()}
      profileTo="/manage/profile"
      homeTo="/manage"
    >
      <Outlet context={{ clubId: data.clubAdminClubIds[0] }} />
    </GridNavShell>
  )
}
