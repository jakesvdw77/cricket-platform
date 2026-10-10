import { useState } from 'react'
import type { ReactNode } from 'react'
import { Box, useMediaQuery, useTheme } from '@mui/material'
import { BottomTabBar } from '../BottomTabBar'
import { Footer } from '../Footer'
import { MenuSheet } from '../MenuSheet'
import { ShellHeader } from '../ShellHeader'
import { SideMenu } from '../SideMenu'
import { MANAGER_NAV, managerTabs } from './managerNav'
import { pageBackgroundGradient } from '../../theme'

export interface ManagerShellProps {
  brand: string
  user: { name: string; email?: string }
  onLogout: () => void
  profileTo: string
  homeTo?: string
  // Passed straight through to ShellHeader (undefined / null / url tri-state).
  logoUrl?: string | null
  // Count badge per nav item id (e.g. open polls); wired to data in a later slice.
  badges?: Record<string, number>
  children: ReactNode
}

// docs/specs/079-manager-shell-and-overview.md: the club manager's shell. A club-colour header, a
// persistent side menu from md (icons-only rail from md to lg, full from lg), and on a phone a
// bottom tab bar whose Menu button opens a sheet. Replaces GridNavShell (top bar only), which only
// ManagerHome used. Only the layout that fits the viewport is rendered, so there is one nav landmark.
export function ManagerShell({ brand, user, onLogout, profileTo, homeTo, logoUrl, badges, children }: ManagerShellProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const theme = useTheme()
  const showSide = useMediaQuery(theme.breakpoints.up('md'), { noSsr: true })
  const fullSide = useMediaQuery(theme.breakpoints.up('lg'), { noSsr: true })

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <ShellHeader
        tone="brand"
        brand={brand}
        user={user}
        onLogout={onLogout}
        profileTo={profileTo}
        homeTo={homeTo}
        notificationsTo="/manage/notifications"
        logoUrl={logoUrl}
      />

      <Box sx={{ flex: 1, display: 'flex', minWidth: 0 }}>
        {showSide && <SideMenu groups={MANAGER_NAV} collapsed={!fullSide} badges={badges} />}
        <Box component="main" sx={{ flex: 1, minWidth: 0, p: { xs: 2, md: 3 }, backgroundImage: pageBackgroundGradient }}>
          {children}
        </Box>
      </Box>

      <Footer />

      {!showSide && (
        <>
          <BottomTabBar
            tabs={managerTabs()}
            groups={MANAGER_NAV}
            menuOpen={menuOpen}
            onMenuClick={() => setMenuOpen(true)}
            badges={badges}
          />
          <MenuSheet
            open={menuOpen}
            onOpen={() => setMenuOpen(true)}
            onClose={() => setMenuOpen(false)}
            groups={MANAGER_NAV}
            badges={badges}
          />
        </>
      )}
    </Box>
  )
}
