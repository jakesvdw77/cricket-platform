import type { Theme } from '@mui/material'

// docs/specs/080-brand-icon-surfaces.md: the colour the icon tile is tinted from. The club's primary
// colour, except when it is light enough that text on it turns dark (the same getContrastText rule the
// header uses), in which case the darker shade, so the artwork stays visible on the tile.
export function iconTileBase(theme: Theme): string {
  const { main, dark } = theme.palette.primary
  const contrast = theme.palette.getContrastText(main).toLowerCase()
  const isWhite = contrast === '#fff' || contrast === '#ffffff'
  return isWhite ? main : dark
}
