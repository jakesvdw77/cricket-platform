import { Outlet } from 'react-router-dom'
import { BottomTabShell } from '../../components/BottomTabShell'
import { keycloak } from '../../auth/keycloak'
import { MOCK_PLAYER } from './mockPlayer'

const NAV_ITEMS = [
  { label: 'Fixtures', to: '/player' },
  { label: 'Results', to: '/player/results' },
  { label: 'Availability', to: '/player/availability' },
  { label: 'Profile', to: '/player/profile' },
]

export default function PlayerHome() {
  return (
    <BottomTabShell
      brand="Cricket Legend Platform"
      navItems={NAV_ITEMS}
      user={MOCK_PLAYER}
      onLogout={() => keycloak.logout()}
      profileTo="/player/profile"
    >
      <Outlet />
    </BottomTabShell>
  )
}
