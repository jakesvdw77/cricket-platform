import { Box, alpha } from '@mui/material'
import { iconTileBase } from './iconTileBase'
import { brandIconUrls } from './brandIcons'
import type { BrandIconName } from './brandIcons'

export type { BrandIconName }

export interface BrandIconProps {
  name: BrandIconName
  // Rendered width and height in px. The set is designed for 32 px and up; smaller stays MUI.
  size?: number
  // Decorative by default (empty alt, aria-hidden). Pass only when the icon is the sole label.
  alt?: string
  // 'tile' (default) draws the club-tinted rounded square behind the artwork; 'none' is the bare image.
  surface?: 'tile' | 'none'
  // Tile padding in px around the icon (tile outer size = size + 2 x padding). Ignored for 'none'.
  padding?: number
  // Adds the white ring that marks the active navigation row. Ignored for 'none'.
  active?: boolean
}

// docs/specs/078-brand-icon-set.md + 080: the product's own colour icon, rendered as an <img> so the SVG
// stays an emitted asset rather than inline markup. The artwork has no background; by default it sits on
// one tile tinted from the club's primary colour (36% over the surface). Sole entry point to `src/icons`.
export function BrandIcon({ name, size = 40, alt, surface = 'tile', padding = 4, active = false }: BrandIconProps) {
  const img = (
    <Box
      component="img"
      src={brandIconUrls[name]}
      alt={alt ?? ''}
      aria-hidden={alt ? undefined : true}
      draggable={false}
      sx={{ width: size, height: size, flex: 'none', display: 'block', objectFit: 'contain' }}
    />
  )
  if (surface === 'none') {
    return img
  }
  return (
    <Box
      data-testid="brand-icon-tile"
      sx={{
        width: size + padding * 2,
        height: size + padding * 2,
        flex: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 1.25,
        bgcolor: (theme) => alpha(iconTileBase(theme), 0.36),
        boxShadow: active ? (theme) => `0 0 0 2px ${theme.palette.common.white}` : 'none',
      }}
    >
      {img}
    </Box>
  )
}
