import { useQuery } from '@tanstack/react-query'
import { Navigate, Outlet } from 'react-router-dom'
import { getAdminIdentity } from '../../api/adminApi'
import { AppShell } from '../../components/AppShell'
import { keycloak } from '../../auth/keycloak'
import { StatusScreen } from '../../components/StatusScreen'
import { FullPageLoader } from '../../components/CricketBallLoader'
import { signOut } from '../../auth/signOut'
import { useKeycloakSettled } from '../../auth/sessionExpiry'
import { forgetProfileChoices } from '../../utils/activeProfile'

const NAV_ITEMS = [
  { label: 'Dashboard', to: '/admin' },
  { label: 'Club Onboarding', to: '/admin/onboarding' },
  { label: 'Whitelisting', to: '/admin/whitelisting' },
  { label: 'Subscriptions', to: '/admin/billing' },
  { label: 'Fields', to: '/admin/fields' },
  { label: 'Leagues', to: '/admin/leagues' },
  { label: 'Configuration', to: '/admin/configuration' },
]

export default function AdminHome() {
  const keycloakSettled = useKeycloakSettled()
  const { data, isError } = useQuery({
    queryKey: ['admin-me'],
    queryFn: getAdminIdentity,
  })

  // Same session guard as ManagerHome: unauthenticated after init means expired or logged out.
  if (!keycloakSettled) {
    return <FullPageLoader label="Loading" />
  }

  if (!keycloak.authenticated) {
    return <Navigate to="/" replace />
  }

  if (isError) {
    return (
      <StatusScreen kind="not-authorised" message="You do not have access to the platform admin area." secondaryAction={{ label: 'Sign out', onClick: signOut }} />
    )
  }

  if (!data) {
    return <FullPageLoader label="Loading" />
  }

  return (
    <AppShell
      brand="Cricket Legend Platform"
      navItems={NAV_ITEMS}
      user={{ name: data.username, email: data.email }}
      onLogout={() => {
        forgetProfileChoices()
        signOut()
      }}
      profileTo="/admin/profile"
    >
      <Outlet context={data} />
    </AppShell>
  )
}
