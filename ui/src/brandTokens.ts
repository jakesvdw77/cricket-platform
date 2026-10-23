import { alpha } from '@mui/material/styles'

// docs/specs/120-manager-theme-alignment.md Decision 3: the one copy of the platform brand constants (greens, gold,
// sand, cream, the cream ground and the font stacks) for `ui/`. `theme.ts`, `PageBackdrop`'s BACKDROP_COLOURS and the
// player console's HUB read from here. The Keycloak login theme keeps a deliberate hand-kept copy of these values
// (`keycloak/themes/cricketlegend/login/resources/css/cricketlegend.css`, design-system.md).
export const BRAND = {
  green900: '#0B3D26',
  // The side menu, bottom bar and Menu sheet ground (darker than the header so the two read as layers).
  menu: '#0a2e1d',
  green800: '#0F5132',
  green700: '#14633F',
  ink: '#06241A',
  gold: '#E8B83D',
  // The top of the gold avatar gradient.
  goldLight: '#f4d676',
  sand: '#E2D5B0',
  cream: '#F7F3E8',
  // The page ground: a 170 degree gradient behind white cards, plus the card hairline on it.
  groundTop: '#e9efe6',
  groundMid: '#f4f1e6',
  groundEnd: '#f7f4ea',
  cardLine: '#d8dfd2',
  // Body text on the cream ground.
  ink900: '#10231a',
  inkMuted: '#55665c',
  // Error text on the dark chrome (the platform error colour is too dark there).
  errorOnDark: '#ffb4a9',
} as const

// Barlow Condensed (display: titles, menu labels, numerals, avatar initials) and Barlow (body), self-hosted from
// `ui/public/fonts`. The fallbacks are width-similar so the page does not jump while the files load.
export const FONT_DISPLAY = '"Barlow Condensed", "Arial Narrow", "Roboto Condensed", sans-serif'
export const FONT_BODY = 'Barlow, system-ui, sans-serif'

// The page ground gradient (the same stops the mockup uses).
export const GROUND_GRADIENT = `linear-gradient(170deg, ${BRAND.groundTop} 0%, ${BRAND.groundMid} 55%, ${BRAND.groundEnd} 100%)`

// The chrome palette (header, menu, footer, bottom bar, Menu sheet): fixed for every club.
export const CHROME = {
  header: BRAND.green900,
  menu: BRAND.menu,
  menuLine: alpha(BRAND.cream, 0.14),
  text: BRAND.cream,
  selected: BRAND.gold,
  selectedBg: alpha(BRAND.gold, 0.16),
  hover: alpha(BRAND.cream, 0.08),
  // The brand icon tile on the dark chrome: a soft green (the 36% primary tint the icons were drawn for, over white).
  // A cream tile made the icons whose artwork is cream or white (Players, Leagues) disappear.
  iconTile: '#B9D1C3',
}

// The dark dropdown ground (a touch lighter than the menu).
export const DARK_MENU_BG = '#0a3322'

// The dark dropdown look (the console's account menus and the manager shells' avatar menu).
export const darkMenuProps = {
  PaperProps: {
    sx: {
      bgcolor: DARK_MENU_BG,
      color: BRAND.cream,
      border: `1px solid ${alpha(BRAND.cream, 0.28)}`,
      '& .MuiMenuItem-root.Mui-selected': { bgcolor: alpha(BRAND.gold, 0.18) },
      '& .MuiMenuItem-root:hover': { bgcolor: alpha(BRAND.gold, 0.12) },
    },
  },
}

// A hex colour as an [r, g, b] triple (for jsPDF, which takes numbers).
export function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace('#', '')
  return [0, 2, 4].map((index) => parseInt(value.slice(index, index + 2), 16)) as [number, number, number]
}

// The platform default primary as RGB, for the generated PDFs (which do not read the theme).
export const PLATFORM_PRIMARY_RGB = hexToRgb(BRAND.green700)

// Translucent cream and black, for the dark console surfaces (skeletons, panels, hovers).
export const creamAlpha = (opacity: number) => alpha(BRAND.cream, opacity)
export const blackAlpha = (opacity: number) => alpha('#000000', opacity)

// The gold avatar disc: a radial from the light to the solid gold (avatarSx and the console avatars share it).
export const GOLD_DISC_GRADIENT = `radial-gradient(circle at 30% 25%, ${BRAND.goldLight}, ${BRAND.gold})`
