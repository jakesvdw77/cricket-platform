import type { ReactNode } from 'react'
import { Box } from '@mui/material'
import { Footer } from '../Footer'
import { ShellHeader } from '../ShellHeader'

export interface GridNavShellProps {
  brand: string
  user: { name: string; email?: string }
  onLogout: () => void
  profileTo: string
  children: ReactNode
}

// Top bar only, no sidebar — the card grid itself is composed by the page that renders
// inside this shell. See docs/specs/006-post-login-home-shells.md's Manager nav decision.
export function GridNavShell({ brand, user, onLogout, profileTo, children }: GridNavShellProps) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <ShellHeader brand={brand} user={user} onLogout={onLogout} profileTo={profileTo} />

      <Box component="main" sx={{ flex: 1, p: { xs: 2, md: 3 } }}>
        {children}
      </Box>

      <Footer />
    </Box>
  )
}
