import type { SvgIconComponent } from '@mui/icons-material'
import MenuIcon from '@mui/icons-material/Menu'
import GridOnOutlinedIcon from '@mui/icons-material/GridOnOutlined'
import JoinInnerOutlinedIcon from '@mui/icons-material/JoinInnerOutlined'

// MUI glyphs drawn on a brand-coloured disc. The two availability entries use the glyphs of the
// hub's own Players and Coverage tabs until brand icons exist; then point their nav config entries
// at the brand icon names and delete them here.
export const GLYPH_ICONS = {
  menu: MenuIcon,
  'player-availability': GridOnOutlinedIcon,
  'team-availability': JoinInnerOutlinedIcon,
} satisfies Record<string, SvgIconComponent>

export type NavGlyphName = keyof typeof GLYPH_ICONS
export const NAV_GLYPH_NAMES = Object.keys(GLYPH_ICONS) as NavGlyphName[]

