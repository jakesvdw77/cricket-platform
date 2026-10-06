import { Box } from '@mui/material'
import { brandIconUrls } from './brandIcons'
import type { BrandIconName } from './brandIcons'

export type { BrandIconName }

export interface BrandIconProps {
  name: BrandIconName
  // Rendered width and height in px. The set is designed for 32 px and up; smaller stays MUI.
  size?: number
  // Decorative by default (empty alt, aria-hidden). Pass only when the icon is the sole label.
  alt?: string
}

// docs/specs/078-brand-icon-set.md: the product's own colour icon, rendered as an <img> so the SVG
// stays an emitted asset rather than inline markup. Sole entry point to `src/icons`.
export function BrandIcon({ name, size = 40, alt }: BrandIconProps) {
  return (
    <Box
      component="img"
      src={brandIconUrls[name]}
      alt={alt ?? ''}
      aria-hidden={alt ? undefined : true}
      draggable={false}
      sx={{ width: size, height: size, flex: 'none', display: 'block', objectFit: 'contain' }}
    />
  )
}
