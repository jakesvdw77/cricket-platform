import type { ReactNode } from 'react'
import { Box } from '@mui/material'
import { Footer } from '../Footer'
import { ShellHeader } from '../ShellHeader'

export interface GridNavShellProps {
  brand: string
  user: { name: string; email?: string }
  onLogout: () => void
  profileTo: string
  // No sidebar/tab bar in this shell (see below), so the brand is the only persistent way back
  // to the dashboard from a page that navigated away from it — see ShellHeader's own homeTo doc.
  homeTo?: string
  // Passed straight through to ShellHeader — see its own doc comment for the undefined/null/
  // string tri-state. ManagerHome is this prop's real consumer (the managed club's own logo).
  logoUrl?: string | null
  children: ReactNode
}

// Top bar only, no sidebar — the card grid itself is composed by the page that renders
// inside this shell. See docs/specs/006-post-login-home-shells.md's Manager nav decision.
export function GridNavShell({ brand, user, onLogout, profileTo, homeTo, logoUrl, children }: GridNavShellProps) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <ShellHeader brand={brand} user={user} onLogout={onLogout} profileTo={profileTo} homeTo={homeTo} logoUrl={logoUrl} />

      <Box component="main" sx={{ flex: 1, p: { xs: 2, md: 3 } }}>
        {children}
      </Box>

      <Footer />
    </Box>
  )
}
