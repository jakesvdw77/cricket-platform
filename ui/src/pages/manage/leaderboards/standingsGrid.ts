import { alpha } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'

// Grid templates and pinned-cell styles of the standings tables (see standingsLayout.tsx for the components).

export interface LayoutColumn {
  code: string
  label: string
  longLabel?: string
  sortable: boolean
  // the heading's help text (read by assistive technology and shown as a tooltip)
  help?: string | null
}

export type WidthOf = (code: string) => { xs: number; sm: number }

// Column widths: rank, the pinned first column, then one fixed width per figure. Desktop is compact so the 13-column Bowling
// table (1046 px) and the 12-column Batting table (974 px) fit about 1100 px of content; phones keep roomier columns and scroll.
const RANK_W = { xs: 40, sm: 40 }
const FIRST_W = { xs: 156, sm: 190 }
const CELL_W = { xs: 80, sm: 62 }
// Columns whose figure or heading needs more room than CELL_W.
const WIDE_CELL_W: Record<string, { xs: number; sm: number }> = {
  overs: { xs: 80, sm: 68 },
  best: { xs: 80, sm: 66 },
  catches: { xs: 80, sm: 72 },
  runOuts: { xs: 88, sm: 76 },
  stumpings: { xs: 96, sm: 84 },
}
export const playerCellWidth: WidthOf = (code) => WIDE_CELL_W[code] ?? CELL_W

const trackMins = (columns: LayoutColumn[], widthOf: WidthOf, bp: 'xs' | 'sm') => [RANK_W[bp], FIRST_W[bp], ...columns.map((c) => widthOf(c.code)[bp])]
const template = (columns: LayoutColumn[], widthOf: WidthOf, bp: 'xs' | 'sm') => {
  const [rank, first, ...cells] = trackMins(columns, widthOf, bp)
  return `${rank}px minmax(${first}px, 1.6fr) ${cells.map((w) => `minmax(${w}px, 1fr)`).join(' ')}`
}
// The table is as wide as the card, and never narrower than the sum of its minimum column widths (below that it scrolls sideways).
export const tableMinWidth = (columns: LayoutColumn[], widthOf: WidthOf) => ({
  xs: `${trackMins(columns, widthOf, 'xs').reduce((a, b) => a + b, 0)}px`,
  sm: `${trackMins(columns, widthOf, 'sm').reduce((a, b) => a + b, 0)}px`,
})

export const gridSx = (columns: LayoutColumn[], widthOf: WidthOf) => ({
  display: 'grid',
  gridTemplateColumns: { xs: template(columns, widthOf, 'xs'), sm: template(columns, widthOf, 'sm') },
  alignItems: 'center',
  width: '100%',
  minWidth: tableMinWidth(columns, widthOf),
})

// Rank and the first column stay put while the figures scroll sideways; they take the row's own (opaque) background.
export const pinnedRank = { position: 'sticky', left: 0, zIndex: 2, bgcolor: 'inherit', alignSelf: 'stretch', display: 'flex', alignItems: 'center', justifyContent: 'center' } as const
export const pinnedFirst = {
  position: 'sticky',
  left: RANK_W,
  zIndex: 2,
  bgcolor: 'inherit',
  alignSelf: 'stretch',
  display: 'flex',
  alignItems: 'center',
  minWidth: 0,
  px: 0.5,
  boxShadow: (theme: Theme) => `1px 0 0 ${theme.palette.divider}`,
} as const

export const sortedTint = (theme: Theme) => alpha(theme.palette.primary.main, 0.1)
