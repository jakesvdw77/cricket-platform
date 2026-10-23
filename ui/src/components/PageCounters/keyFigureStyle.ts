import { decomposeColor, recomposeColor } from '@mui/material'
import type { Theme } from '@mui/material'
import { BRAND } from '../../brandTokens'

// The Overview key-figure card style (docs/specs/079, 081). Shared by ManagerOverviewPage's key figures and
// PageCounters so the two cannot drift.
// docs/specs/120: the white card now also carries the card hairline (the shadow is kept, like every other panel).
export const keyFigureCardSx = {
  bgcolor: 'background.paper',
  boxShadow: 2,
  border: 1,
  borderColor: 'divider',
  p: 2,
  display: 'flex',
  flexDirection: 'column',
  gap: 1,
  minWidth: 0,
}

// docs/specs/085: the compact variant of the card (PageCounters density="compact"): one line, value then label,
// baseline aligned, about 44 px tall. Right padding leaves room for the corner marker, which is centred vertically.
export const compactCardSx = {
  ...keyFigureCardSx,
  flexDirection: 'row',
  alignItems: 'baseline',
  gap: 1,
  minHeight: 44,
  py: 1.25,
  pl: 2,
  pr: 2,
  boxSizing: 'border-box',
}

export const compactValueSx = (warn: boolean) => ({
  ...keyFigureValueSx(warn),
  fontSize: '1.5rem',
  lineHeight: 1,
  flex: '0 0 auto',
})

// docs/specs/120 Decision 8: the numeral is 40 px in the display face (Barlow Condensed 700) in the header green; a warning
// counter keeps the warning colour.
export function keyFigureValueSx(warn: boolean) {
  return {
    fontFamily: (theme: Theme) => theme.typography.fontFamilyDisplay,
    fontSize: '2.5rem',
    fontWeight: 700,
    lineHeight: 1.1,
    fontVariantNumeric: 'tabular-nums',
    color: warn ? 'warning.main' : BRAND.green900,
  }
}

// docs/specs/084: the hover tint of a selectable counter - primary blended HOVER_TINT onto the card colour, as an
// opaque colour so the card's background-color transition works (and the contrast test can compute it).
export const HOVER_TINT = 0.05

export function hoverTintColor(theme: Theme): string {
  const top = decomposeColor(theme.palette.primary.main).values
  const base = decomposeColor(theme.palette.background.paper).values
  const mixed = [0, 1, 2].map((i) => Math.round(top[i] * HOVER_TINT + base[i] * (1 - HOVER_TINT)))
  return recomposeColor({ type: 'rgb', values: mixed as [number, number, number] })
}

// Lift (shadow) and tint on hover, only where there is a real hover; pressed settles back down.
export function selectableCardSx(theme: Theme) {
  return {
    transition: theme.transitions.create(['box-shadow', 'background-color'], { duration: theme.transitions.duration.shorter }),
    '@media (hover: hover)': { '&:hover': { boxShadow: 6, backgroundColor: hoverTintColor(theme) } },
    '&:active': { boxShadow: 1 },
  }
}
