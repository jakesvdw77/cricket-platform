import { Box } from '@mui/material'
import MenuIcon from '@mui/icons-material/Menu'
import { BrandIcon } from '../BrandIcon'
import type { BrandIconName } from '../BrandIcon'

export interface NavItemIconProps {
  // A brand icon, or the MUI menu glyph on a brand-coloured disc (the phone bar's Menu button).
  name: BrandIconName | 'menu'
  // Icon size in px; the brand icon's tile adds `padding` on every side.
  size?: number
  padding?: number
  // White ring on the tile of the active row (brand icons only).
  active?: boolean
  // 'none' draws the bare artwork with no tile (the side menu). Brand icons only.
  surface?: 'tile' | 'none'
}

// docs/specs/079-manager-shell-and-overview.md: one icon slot for every manager navigation surface.
export function NavItemIcon({ name, size = 32, padding, active, surface }: NavItemIconProps) {
  if (name !== 'menu') {
    return <BrandIcon name={name} size={size} active={active} {...(surface ? { surface } : {})} {...(padding === undefined ? {} : { padding })} />
  }
  return (
    <Box
      aria-hidden
      data-testid={`nav-icon-${name}`}
      sx={{
        width: size,
        height: size,
        flex: 'none',
        // Keeps the disc on the same footprint as a tiled brand icon of the same size and padding.
        m: padding === undefined ? 0 : `${padding}px`,
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
