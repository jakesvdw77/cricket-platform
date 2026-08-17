import { Outlet } from 'react-router-dom'
import { GridNavShell } from '../../components/GridNavShell'
import { keycloak } from '../../auth/keycloak'

// No real identity source yet — 001's RoleAssignment model isn't built, so this is a static
// placeholder, not a fetched Person/JWT claim. Both club-manager and team-manager scoped
// cards render for every viewer until real permission filtering lands — see
// docs/specs/006-post-login-home-shells.md's Non-goals.
const MOCK_MANAGER = { name: 'Sam Manager' }

export default function ManagerHome() {
  return (
    <GridNavShell brand="Riverside CC" user={MOCK_MANAGER} onLogout={() => keycloak.logout()} profileTo="/manage/profile">
      <Outlet />
    </GridNavShell>
  )
}
