import type { ReactNode } from 'react'
import { Box, Typography } from '@mui/material'
import { AvatarMenu } from '../AvatarMenu'

export interface ShellHeaderProps {
  brand: string
  user: { name: string; email?: string }
  onLogout: () => void
  profileTo: string
  /** Extra content before the brand — e.g. AppShell's mobile menu button. */
  leading?: ReactNode
  /** Tighter padding/type scale, for shells with less vertical room (e.g. BottomTabShell). */
  dense?: boolean
}

// The header row (brand + AvatarMenu) shared by every post-login shell — see
// docs/specs/006-post-login-home-shells.md. Pulled out once AppShell, GridNavShell, and
// BottomTabShell all turned out to render the same row, differing only in what nav they wrap
// it with (sidebar drawer, nothing, or a bottom tab bar).
export function ShellHeader({ brand, user, onLogout, profileTo, leading, dense }: ShellHeaderProps) {
  return (
    <Box
      component="header"
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        px: dense ? 2 : { xs: 2, md: 3 },
        py: dense ? 1.5 : 2,
        borderBottom: 1,
        borderColor: 'divider',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {leading}
        <Typography variant={dense ? 'subtitle2' : 'subtitle1'} fontWeight={700}>
          {brand}
        </Typography>
      </Box>
      <AvatarMenu name={user.name} email={user.email} onLogout={onLogout} profileTo={profileTo} />
    </Box>
  )
}
