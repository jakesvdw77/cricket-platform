import type { ReactNode } from 'react'
import { Box, Typography } from '@mui/material'
import { AvatarMenu } from '../AvatarMenu'
import { Footer } from '../Footer'

export interface GridNavShellProps {
  brand: string
  user: { name: string; email?: string }
  onLogout: () => void
  children: ReactNode
}

// Top bar only, no sidebar — the card grid itself is composed by the page that renders
// inside this shell. See docs/specs/006-post-login-home-shells.md's Manager nav decision.
export function GridNavShell({ brand, user, onLogout, children }: GridNavShellProps) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Box
        component="header"
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: { xs: 2, md: 3 },
          py: 2,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Typography variant="subtitle1" fontWeight={700}>
          {brand}
        </Typography>
        <AvatarMenu name={user.name} email={user.email} onLogout={onLogout} />
      </Box>

      <Box component="main" sx={{ flex: 1, p: { xs: 2, md: 3 } }}>
        {children}
      </Box>

      <Footer />
    </Box>
  )
}
