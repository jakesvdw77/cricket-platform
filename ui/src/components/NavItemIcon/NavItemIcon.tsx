import { Box } from '@mui/material'
import HomeIcon from '@mui/icons-material/Home'
import MenuIcon from '@mui/icons-material/Menu'
import { BrandIcon } from '../BrandIcon'
import type { BrandIconName } from '../BrandIcon'

export interface NavItemIconProps {
  // A brand icon, or one of two MUI glyphs on a brand-coloured disc ('home' stands in for the
  // Overview icon that does not exist yet; 'menu' is the phone bar's Menu button).
  name: BrandIconName | 'home' | 'menu'
  size?: number
}

// docs/specs/079-manager-shell-and-overview.md: one icon slot for every manager navigation surface.
export function NavItemIcon({ name, size = 32 }: NavItemIconProps) {
  if (name !== 'home' && name !== 'menu') {
    return <BrandIcon name={name} size={size} />
  }
  const Glyph = name === 'home' ? HomeIcon : MenuIcon
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
      <Glyph sx={{ fontSize: size * 0.56 }} />
    </Box>
  )
}
