import type { SvgIconComponent } from '@mui/icons-material'
import MenuIcon from '@mui/icons-material/Menu'
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined'

// MUI glyphs drawn on a brand-coloured disc: the phone bar's Menu button, which has no brand icon, and the Fields
// entry (docs/specs/099-fields-directory.md: there is no ground or venue brand icon and none is made).
export const GLYPH_ICONS = {
  menu: MenuIcon,
  place: PlaceOutlinedIcon,
} satisfies Record<string, SvgIconComponent>

export type NavGlyphName = keyof typeof GLYPH_ICONS
export const NAV_GLYPH_NAMES = Object.keys(GLYPH_ICONS) as NavGlyphName[]
