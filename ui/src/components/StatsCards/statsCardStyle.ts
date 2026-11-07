import { alpha } from '@mui/material/styles'
import { BRAND, FONT_DISPLAY, blackAlpha } from '../../brandTokens'

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
