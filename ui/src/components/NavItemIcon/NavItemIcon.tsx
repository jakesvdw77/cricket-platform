import { Box } from '@mui/material'
import MenuIcon from '@mui/icons-material/Menu'
import { BrandIcon } from '../BrandIcon'
import type { BrandIconName } from '../BrandIcon'

export interface NavItemIconProps {
  // A brand icon, or the MUI menu glyph on a brand-coloured disc (the phone bar's Menu button).
  name: BrandIconName | 'menu'
  size?: number
}

// docs/specs/079-manager-shell-and-overview.md: one icon slot for every manager navigation surface.
export function NavItemIcon({ name, size = 32 }: NavItemIconProps) {
  if (name !== 'menu') {
    return <BrandIcon name={name} size={size} />
  }
  return (
    <Box
      aria-hidden
      data-testid={`nav-icon-${name}`}
      sx={{
        width: size,
        height: size,
        flex: 'none',
        borderRadius: '50%',
        display: 'grid',
        placeItems: 'center',
        bgcolor: 'primary.main',
        color: 'primary.contrastText',
      }}
    >
      <MenuIcon sx={{ fontSize: size * 0.56 }} />
    </Box>
  )
}
