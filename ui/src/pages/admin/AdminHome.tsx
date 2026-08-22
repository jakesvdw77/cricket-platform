import { useQuery } from '@tanstack/react-query'
import { Box } from '@mui/material'
import { Outlet } from 'react-router-dom'
import { getAdminIdentity } from '../../api/adminApi'
import { AppShell } from '../../components/AppShell'
import { EmptyState } from '../../components/EmptyState'
import { keycloak } from '../../auth/keycloak'

const NAV_ITEMS = [
  { label: 'Dashboard', to: '/admin' },
  { label: 'Club Onboarding', to: '/admin/onboarding' },
  { label: 'Whitelisting', to: '/admin/whitelisting' },
  { label: 'Subscriptions', to: '/admin/billing' },
  { label: 'Leagues', to: '/admin/leagues' },
  { label: 'Configuration', to: '/admin/configuration' },
]

export default function AdminHome() {
  const { data, isError } = useQuery({
    queryKey: ['admin-me'],
    queryFn: getAdminIdentity,
  })

  if (isError) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', px: 2, py: 5 }}>
        <EmptyState title="Not authorized" description="You are not recognized as a platform admin." />
      </Box>
    )
  }

  if (!data) {
    return null
  }

  return (
    <AppShell
      brand="Cricket Legend Platform"
      navItems={NAV_ITEMS}
      user={{ name: data.username, email: data.email }}
      onLogout={() => keycloak.logout()}
      profileTo="/admin/profile"
    >
      <Outlet context={data} />
    </AppShell>
  )
}
