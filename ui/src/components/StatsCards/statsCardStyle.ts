import { alpha } from '@mui/material/styles'
import { BRAND, FONT_DISPLAY, STATS_TONES, blackAlpha } from '../../brandTokens'

// The dark console look of a stats card, from the brand tokens (components/ may not import the Hub's hubStyle; HUB is built from the
// same tokens, so the values are identical).
export const STATS_UI = {
  cream: BRAND.cream,
  gold: BRAND.gold,
  ink: BRAND.ink,
  sand: BRAND.sand,
  line: alpha(BRAND.cream, 0.28),
  lineSoft: alpha(BRAND.cream, 0.14),
  muted: alpha(BRAND.cream, 0.66),
  display: FONT_DISPLAY,
  faceGround: blackAlpha(0.22),
  // A card with some or all data missing (Amendment 2 item 8): a very light amber tint over the ground and a 1 px warmer line. Never the only cue.
  lackingTint: alpha(STATS_TONES.partly, 0.05),
  lackingLine: alpha(STATS_TONES.partly, 0.4),
  partly: STATS_TONES.partly,
} as const

export const visuallyHiddenSx = {
  position: 'absolute',
  width: 1,
  height: 1,
  p: 0,
  m: '-1px',
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0,
} as const

// Card heights (docs/specs/147 Amendment 2, density pass): a card is a FIXED height in rem, so it scales with text zoom and neither face
// can grow it. A normal card is 15 rem; a tall card spans two normal rows and the gap between them; a compact (tile) card is 10 rem.
// The back scrolls inside the card. The grid sets these as the CSS variable --stats-card-h on each row.
export const CARD_HEIGHT_REM = 15
export const CARD_COMPACT_HEIGHT_REM = 10
export const CARD_HEIGHT_VAR = '--stats-card-h'

// The type scale of a card, in px (the shell and the shared parts read it; a card file should not hard-code its own).
export const STATS_TYPE = {
  title: 14,
  titleExpanded: 22,
  scope: 11,
  scopeExpanded: 13,
  footer: 11,
  hint: 11,
  big: 30,
  bigCompact: 34,
  tileValue: 19,
  tileLabel: 10,
  caption: 10,
  body: 12,
  table: 12,
  chip: 12,
} as const

// A thin dark scrollbar for the scrolling back of a card (the console hides its own; a card's back needs a cue that it scrolls).
export const cardScrollSx = {
  scrollbarWidth: 'thin',
  scrollbarColor: `${alpha(BRAND.cream, 0.3)} transparent`,
  '&::-webkit-scrollbar': { width: 6, height: 6 },
  '&::-webkit-scrollbar-track': { background: 'transparent' },
  '&::-webkit-scrollbar-thumb': { background: alpha(BRAND.cream, 0.3), borderRadius: 3 },
} as const
