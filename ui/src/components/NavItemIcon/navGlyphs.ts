import type { SvgIconComponent } from '@mui/icons-material'
import MenuIcon from '@mui/icons-material/Menu'

// MUI glyphs drawn on a brand-coloured disc: only the phone bar's Menu button, which has no brand
// icon. (The two availability menu entries used glyphs here until their brand icons arrived.)
export const GLYPH_ICONS = {
  menu: MenuIcon,
} satisfies Record<string, SvgIconComponent>

export type NavGlyphName = keyof typeof GLYPH_ICONS
export const NAV_GLYPH_NAMES = Object.keys(GLYPH_ICONS) as NavGlyphName[]
