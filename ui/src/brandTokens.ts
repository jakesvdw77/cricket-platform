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
  // The cricket ball loader: leather red (light and shade) and the stitching.
  ballRed: '#C62828',
  ballRedShade: '#8E1B1B',
  ballSeam: '#F4E9D0',
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
  // The brand icon tile on the dark chrome: the mid green of the buttons, with a thin cream ring (BrandIcon). A cream tile
  // made the icons whose artwork is cream or white (Players, Leagues) disappear, and the soft mint tile looked flat.
  iconTile: BRAND.green700,
  // docs/specs/139 (quiet side menu): the active row is a slightly lighter green than the menu, with a gold bar on its left; inactive
  // labels are cream at 75%; an icon that needs a ground gets a faint cream ghost tile, no ring.
  activeRow: '#17432d',
  inactiveText: alpha(BRAND.cream, 0.75),
  ghostTile: alpha(BRAND.cream, 0.06),
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

// docs/specs/146 (Player Hub scoreboard ticker): the type chip tones and the edge fade of the ticker band, from the owner-chosen
// mockup (docs/mockups/player-hub-ticker-round2-mockup.html). Named here so no ticker file carries a hex literal. Each tone reads at
// 4.5:1 or better on the dark band (pinned by tickerTokens.test.ts).
export const TICKER_TONES = {
  win: '#3FBF7F',
  live: '#F0675D',
  next: '#7FB6E8',
  message: '#C9A7F0',
  sponsor: BRAND.gold,
  info: '#9ED3B5',
} as const
// The ticker's edge fade: the console ground under the footer band.
export const TICKER_FADE = '#08271b'

// docs/specs/147 (Player Hub stats, shared flip cards): the data-tag chip tones (HAVE, PARTLY, NOT CAPTURED) and the drawing tones of
// components/StatsDrawings, named here so no stats file carries a hex literal. They reuse the ticker tones, which read at 4.5:1 or
// better on the dark console ground; every use also carries a word or a pattern, colour is never the only cue.
export const STATS_TONES = {
  have: TICKER_TONES.win,
  // The quiet warm tone of a partly-captured card (spec 147 colour rule 7): a muted amber, deliberately not the selection gold.
  partly: '#D9A66B',
  notCaptured: TICKER_TONES.live,
  // Drawings: good, poor, the second series and the neutral grid.
  win: TICKER_TONES.win,
  loss: TICKER_TONES.live,
  blue: TICKER_TONES.next,
  gold: BRAND.gold,
  violet: TICKER_TONES.message,
  mint: TICKER_TONES.info,
  sand: BRAND.sand,
} as const
// The order slices and series are coloured in (donut, stacked bars): distinct from one another on the dark ground.
export const STATS_SERIES = [STATS_TONES.gold, STATS_TONES.blue, STATS_TONES.win, STATS_TONES.loss, STATS_TONES.violet, STATS_TONES.mint, STATS_TONES.sand] as const

// docs/specs/147 Amendment 2 item 16 (the restrained stats colour rule, owner decision 2026-11-07: "not everything gets a colour, only
// where it makes sense"). Gold is only the headline number, the selected thing and the focus ring. Everything else is neutral sand, one
// tonal ramp. The one exception is a comparison of exactly two categories (Fours v Sixes, Home v Away): green and blue at full strength.
// Loss red is not used on these cards (it stays for Results and the W/L/T chips). Every use also carries a label, so colour is never the only cue.
export const STATS_COLOUR = {
  // A single-series or ordinal bar or column, and the faint track under it.
  bar: alpha(BRAND.sand, 0.62),
  track: alpha(BRAND.cream, 0.1),
  trackHover: alpha(BRAND.cream, 0.18),
  // The selected row's bar.
  selected: BRAND.gold,
  // The two tones of a comparison of exactly two categories, at full strength so they read at a glance: win green, then the ticker blue.
  compareFirst: STATS_TONES.win,
  compareSecond: STATS_TONES.blue,
  // Three or more parts: sand shades then cool shades, largest first, then a pale cream.
  ramp: [alpha(BRAND.sand, 1), alpha(BRAND.sand, 0.6), alpha(STATS_TONES.blue, 0.7), alpha(STATS_TONES.blue, 0.4), alpha(BRAND.cream, 0.3)],
  // Line charts: the data line and markers, the dashed running average, the faint guides and their muted labels.
  line: alpha(BRAND.sand, 0.8),
  marker: BRAND.cream,
  average: alpha(STATS_TONES.blue, 0.8),
  guide: alpha(BRAND.cream, 0.3),
  guideLabel: alpha(BRAND.cream, 0.66),
  valueLabel: alpha(BRAND.cream, 0.8),
} as const
