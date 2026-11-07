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
  // A card with some or all data missing (Amendment 2 item 8): a quiet amber tint over the ground and a thin amber line. Never the only cue.
  lackingTint: alpha(STATS_TONES.partly, 0.08),
  lackingLine: alpha(STATS_TONES.partly, 0.55),
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

// The least height of a card cell, so a row of cards is never squashed and the faces of every card in a row stand even.
export const CARD_MIN_HEIGHT = 280
