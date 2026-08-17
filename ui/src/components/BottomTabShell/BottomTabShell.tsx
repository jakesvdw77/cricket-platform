import type { ReactNode } from 'react'
import { Box, Typography } from '@mui/material'
import { AvatarMenu } from '../AvatarMenu'
import { Footer } from '../Footer'
import { Nav } from '../Nav'
import type { NavItem } from '../Nav'

export interface BottomTabShellProps {
  brand: string
  navItems: NavItem[]
  user: { name: string; email?: string }
  onLogout: () => void
  children: ReactNode
}

// Mobile-first: minimal top bar + Nav's existing thumb-reachable bottom tab bar (top Tabs
// from md up, for free). See docs/specs/006-post-login-home-shells.md's Player nav decision.
export function BottomTabShell({ brand, navItems, user, onLogout, children }: BottomTabShellProps) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', pb: { xs: 7, md: 0 } }}>
      <Box
        component="header"
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 1.5,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Typography variant="subtitle2" fontWeight={700}>
          {brand}
        </Typography>
        <AvatarMenu name={user.name} email={user.email} onLogout={onLogout} />
      </Box>

      <Nav items={navItems} />

      <Box component="main" sx={{ flex: 1, p: 2 }}>
        {children}
      </Box>

      <Footer />
    </Box>
  )
}
