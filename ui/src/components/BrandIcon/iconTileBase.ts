import type { Theme } from '@mui/material'
import { CHROME } from '../../brandTokens'

// docs/specs/080-brand-icon-surfaces.md: the colour the icon tile is tinted from. The club's primary
// colour, except when it is light enough that text on it turns dark (the same getContrastText rule the
// header uses), in which case the darker shade, so the artwork stays visible on the tile.
//
// docs/specs/120 Decision 13: on the dark chrome (`onDark`) the tile is a solid soft green instead (the tint the icons
// were drawn for, so dark and cream artwork both stay visible); the club colour plays no part there.
export function iconTileBase(theme: Theme, onDark = false): string {
  if (onDark) return CHROME.iconTile
  const { main, dark } = theme.palette.primary
  const contrast = theme.palette.getContrastText(main).toLowerCase()
  const isWhite = contrast === '#fff' || contrast === '#ffffff'
  return isWhite ? main : dark
}
