import { Outlet } from 'react-router-dom'
import { BottomTabShell } from '../../components/BottomTabShell'
import { signOut } from '../../auth/signOut'
import { MOCK_PLAYER } from './mockPlayer'
import { forgetProfileChoices } from '../../utils/activeProfile'

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
      onLogout={() => {
        forgetProfileChoices()
        signOut()
      }}
      profileTo="/player/profile"
    >
      <Outlet />
    </BottomTabShell>
  )
}
