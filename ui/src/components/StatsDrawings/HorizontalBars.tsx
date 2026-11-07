import { Box } from '@mui/material'
import { alpha } from '@mui/material/styles'
import { Link } from 'react-router-dom'
import { BRAND, STATS_TONES } from '../../brandTokens'
import { useFaceTabIndex } from '../FlipCard'
import { barLengths } from './statsMath'

export interface BarRow {
  key: string
  label: string
  value: number
  // The figure as the server formatted it or as formatted from it ("48", "61.4").
  valueLabel: string
  // The drill this bar opens (a band, a player).
  href?: string
  colour?: string
  // A small second line under the label ("Home", "Home · Econ 4.50"); text, so it is never the only carrier of the figure.
  tag?: string
}

export interface HorizontalBarsProps {
  rows: BarRow[]
  alt: string
  // The scale's top; omitted, the largest value.
  max?: number
  // The compact front of a Summary tile: each row is its label (with the value at the right) over a thin bar, so a long name keeps the width.
  dense?: boolean
}

// docs/specs/147: labelled horizontal bars (scores in bands, runs by player), plain HTML rows (label, track, value) so type and bars keep
// fixed pixel sizes however wide the card is: a row is 22 px high (bar 10 px), the label 12 px, the value 12 px bold. The expanded card
// sets --stats-row-scale (1.25) for a little more air; the type never scales. The chart is capped in width and a bar with a drill is a
// link. The values are also written as text in the row so the drawing is not the only carrier.
const rowSx = {
  display: 'grid',
  gridTemplateColumns: 'minmax(7rem, 42%) minmax(0, 1fr) auto',
  alignItems: 'center',
  columnGap: '8px',
  minHeight: 'calc(22px * var(--stats-row-scale, 1))',
  minWidth: 0,
  color: BRAND.cream,
  textDecoration: 'none',
  fontSize: 12,
  lineHeight: 1.2,
} as const

// Dense: label and value on one line, the bar thin under it (two grid rows).
const denseRowSx = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  gridTemplateRows: 'auto auto',
  alignItems: 'center',
  columnGap: '8px',
  rowGap: '2px',
  py: '1px',
  minWidth: 0,
  color: BRAND.cream,
  textDecoration: 'none',
  fontSize: 11,
  lineHeight: 1.2,
} as const

// A label wraps to two lines before it is cut, and the full text is always the title.
const clampSx = { display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden', overflowWrap: 'anywhere' } as const
export function HorizontalBars({ rows, alt, max, dense = false }: HorizontalBarsProps) {
  const tabIndex = useFaceTabIndex()
  const ceiling = max ?? Math.max(0, ...rows.map((row) => row.value))
  const lengths = barLengths(rows.map((row) => row.value), ceiling, 100)
  return (
    <Box role="group" aria-label={alt} data-testid="horizontal-bars" sx={{ display: 'grid', minWidth: 0, width: '100%', maxWidth: 'calc(520px * var(--stats-row-scale, 1))' }}>
      {rows.map((row, index) => {
        const name = `${row.label}${row.tag ? ` (${row.tag})` : ''}: ${row.valueLabel}`
        const bar = (
          <Box component="span" className="track" sx={{ display: 'block', height: dense ? 5 : 10, borderRadius: '5px', bgcolor: alpha(BRAND.cream, 0.1), overflow: 'hidden', ...(dense ? { gridColumn: '1 / -1' } : {}) }}>
            {lengths[index] > 0 && <Box component="span" sx={{ display: 'block', height: '100%', borderRadius: '5px', width: `${Math.max(lengths[index], 3)}%`, bgcolor: row.colour ?? STATS_TONES.gold }} />}
          </Box>
        )
        const label = (
          <Box component="span" title={row.label} sx={{ display: 'grid', minWidth: 0, textAlign: dense ? 'left' : 'right' }}>
            <Box component="span" sx={dense ? { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } : clampSx}>{row.label}</Box>
            {row.tag && <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 10, color: alpha(BRAND.cream, 0.66) }}>{row.tag}</Box>}
          </Box>
        )
        const value = <Box component="span" sx={{ fontSize: dense ? 11 : 12, fontWeight: 700, minWidth: dense ? undefined : '2.2em', textAlign: 'right' }}>{row.valueLabel}</Box>
        const content = dense ? (
          <>
            {label}
            {value}
            {bar}
          </>
        ) : (
          <>
            {label}
            {bar}
            {value}
          </>
        )
        const base = dense ? denseRowSx : rowSx
        return row.href ? (
          <Box
            key={row.key}
            component={Link}
            to={row.href}
            aria-label={name} title={name}
            tabIndex={tabIndex}
            data-testid="bar-row"
            sx={{ ...base, '&:hover .track': { bgcolor: alpha(BRAND.cream, 0.18) }, '&:focus-visible': { outline: `2px solid ${BRAND.cream}`, outlineOffset: 1 } }}
          >
            {content}
          </Box>
        ) : (
          <Box key={row.key} data-testid="bar-row" title={name} sx={base}>
            {content}
          </Box>
        )
      })}
    </Box>
  )
}
