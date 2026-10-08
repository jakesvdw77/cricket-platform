import { decomposeColor, recomposeColor } from '@mui/material'
import type { Theme } from '@mui/material'

// The Overview key-figure card style (docs/specs/079, 081). Shared by ManagerOverviewPage's key figures and
// PageCounters so the two cannot drift.
export const keyFigureCardSx = {
  bgcolor: 'background.paper',
  boxShadow: 2,
  p: 2,
  display: 'flex',
  flexDirection: 'column',
  gap: 1,
  minWidth: 0,
}

export function keyFigureValueSx(warn: boolean) {
  return {
    fontSize: '1.6rem',
    fontWeight: 700,
    lineHeight: 1.1,
    fontVariantNumeric: 'tabular-nums',
    color: warn ? 'warning.main' : 'text.primary',
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
