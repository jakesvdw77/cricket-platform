import type { ReactNode } from 'react'
import { Box } from '@mui/material'
import { Footer } from '../Footer'
import { Nav } from '../Nav'
import type { NavItem } from '../Nav'
import { ShellHeader } from '../ShellHeader'

export interface BottomTabShellProps {
  brand: string
  navItems: NavItem[]
  user: { name: string; email?: string }
  onLogout: () => void
  profileTo: string
  children: ReactNode
}

// Mobile-first: minimal top bar + Nav's existing thumb-reachable bottom tab bar (top Tabs
// from md up, for free). See docs/specs/006-post-login-home-shells.md's Player nav decision.
export function BottomTabShell({ brand, navItems, user, onLogout, profileTo, children }: BottomTabShellProps) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', pb: { xs: 7, md: 0 } }}>
      <ShellHeader brand={brand} user={user} onLogout={onLogout} profileTo={profileTo} dense />

      <Nav items={navItems} />

      <Box component="main" sx={{ flex: 1, p: 2 }}>
        {children}
      </Box>

      <Footer />
    </Box>
  )
}
