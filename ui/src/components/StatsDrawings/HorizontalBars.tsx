import type { MouseEvent } from 'react'
import { Box } from '@mui/material'
import { alpha } from '@mui/material/styles'
import { Link } from 'react-router-dom'
import { BRAND, STATS_COLOUR } from '../../brandTokens'
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
  // Spec 147 colour rule: 'neutral' (default) is sand; 'compare' paints the bar in the tone of `seriesIndex` (0 sand, 1 cool) for a
  // comparison of two categories. A selected row is gold either way.
  tone?: 'neutral' | 'compare'
  seriesIndex?: 0 | 1
  // A small second line under the label ("Home", "Home · Econ 4.50"); text, so it is never the only carrier of the figure.
  tag?: string
  // Dense rows only (spec 147 Amendment 2 item 15): the row is a real toggle button that filters the page; `selected` is its pressed state.
  onSelect?: () => void
  selected?: boolean
}

export interface HorizontalBarsProps {
  rows: BarRow[]
  alt: string
  // The scale's top; omitted, the largest value.
  max?: number
  // The compact front of a Summary tile: each row is its label (with the value at the right) over a thin bar, so a long name keeps the width.
  dense?: boolean
  // Two-category cards only: the two series names, with a small swatch each ("Home", "Away"); the rows are labelled too.
  legend?: [string, string]
}

function barFill(row: Pick<BarRow, 'colour' | 'tone' | 'selected' | 'seriesIndex'>): string {
  if (row.selected) return STATS_COLOUR.selected
  if (row.colour) return row.colour
  return row.tone === 'compare' && row.seriesIndex === 1 ? STATS_COLOUR.compareSecond : row.tone === 'compare' ? STATS_COLOUR.compareFirst : STATS_COLOUR.bar
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
  rowGap: '4px',
  minWidth: 0,
  color: BRAND.cream,
  textDecoration: 'none',
  fontSize: 11,
  lineHeight: 1.2,
} as const

// A label wraps to two lines before it is cut, and the full text is always the title.
// A selectable dense row: a button reset to look like the row, at least 32 px high, with a hover tint, a gold focus ring and a gold selected state.
const selectRowSx = {
  appearance: 'none',
  border: 0,
  m: 0,
  px: '4px',
  py: '3px',
  mx: '-4px',
  font: 'inherit',
  fontSize: 11,
  textAlign: 'left',
  bgcolor: 'transparent',
  cursor: 'pointer',
  minHeight: 32,
  alignContent: 'center',
  borderRadius: '6px',
  '&:hover': { bgcolor: alpha(BRAND.gold, 0.12) },
  '&:hover .track': { bgcolor: STATS_COLOUR.trackHover },
  '&:focus-visible': { outline: `2px solid ${BRAND.gold}`, outlineOffset: 1 },
  '&[aria-pressed="true"]': { bgcolor: alpha(BRAND.gold, 0.18), color: BRAND.gold, fontWeight: 700 },
} as const

const clampSx = { display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden', overflowWrap: 'anywhere' } as const
export function HorizontalBars({ rows, alt, max, dense = false, legend }: HorizontalBarsProps) {
  const tabIndex = useFaceTabIndex()
  const ceiling = max ?? Math.max(0, ...rows.map((row) => row.value))
  const lengths = barLengths(rows.map((row) => row.value), ceiling, 100)
  return (
    <Box role="group" aria-label={alt} data-testid="horizontal-bars" sx={{ display: 'grid', minWidth: 0, width: '100%', maxWidth: dense ? 320 : 'calc(520px * var(--stats-row-scale, 1))', ...(dense ? { rowGap: rows.some((row) => row.onSelect) ? '2px' : '10px' } : {}) }}>
      {legend && (
        <Box component="span" data-testid="bars-legend" sx={{ display: 'flex', gap: '12px', fontSize: 10, lineHeight: 1.2, color: alpha(BRAND.cream, 0.8), mb: '2px' }}>
          {legend.map((name, index) => (
            <Box key={name} component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <Box aria-hidden component="span" sx={{ width: 8, height: 8, borderRadius: '2px', bgcolor: index === 0 ? STATS_COLOUR.compareFirst : STATS_COLOUR.compareSecond }} />
              {name}
            </Box>
          ))}
        </Box>
      )}
      {rows.map((row, index) => {
        const name = `${row.label}${row.tag ? ` (${row.tag})` : ''}: ${row.valueLabel}`
        const bar = (
          <Box component="span" className="track" sx={{ display: 'block', height: dense ? 8 : 10, borderRadius: '5px', bgcolor: STATS_COLOUR.track, overflow: 'hidden', ...(dense ? { gridColumn: '1 / -1' } : {}) }}>
            {lengths[index] > 0 && <Box component="span" sx={{ display: 'block', height: '100%', borderRadius: '5px', width: `${Math.max(lengths[index], 3)}%`, bgcolor: barFill(row) }} />}
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
        if (dense && row.onSelect) {
          const select = row.onSelect
          const pressed = Boolean(row.selected)
          const selectName = pressed ? `Clear ${row.label} filter` : `Filter to ${row.label}`
          return (
            <Box
              key={row.key}
              component="button"
              type="button"
              aria-pressed={pressed}
              aria-label={selectName}
              title={`${name}. ${selectName}`}
              tabIndex={tabIndex}
              data-testid="bar-row"
              data-flip-interactive
              onClick={(event: MouseEvent) => {
                event.stopPropagation()
                select()
              }}
              sx={{ ...base, ...selectRowSx }}
            >
              {content}
            </Box>
          )
        }
        return row.href ? (
          <Box
            key={row.key}
            component={Link}
            to={row.href}
            aria-label={name} title={name}
            tabIndex={tabIndex}
            data-testid="bar-row"
            sx={{ ...base, '&:hover .track': { bgcolor: STATS_COLOUR.trackHover }, '&:focus-visible': { outline: `2px solid ${BRAND.cream}`, outlineOffset: 1 } }}
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
