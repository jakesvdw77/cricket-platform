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
}

export interface HorizontalBarsProps {
  rows: BarRow[]
  alt: string
  // The scale's top; omitted, the largest value.
  max?: number
}

const W = 320
const LABEL = 96
const VALUE = 44
const ROW = 30

// docs/specs/147: labelled horizontal bars (scores in bands, runs by player). Our own SVG; a bar with a drill is a link. The values are
// also written as text in the row label so the drawing is not the only carrier.
export function HorizontalBars({ rows, alt, max }: HorizontalBarsProps) {
  const tabIndex = useFaceTabIndex()
  const ceiling = max ?? Math.max(0, ...rows.map((row) => row.value))
  const lengths = barLengths(rows.map((row) => row.value), ceiling, W - LABEL - VALUE)
  return (
    <Box component="svg" viewBox={`0 0 ${W} ${Math.max(rows.length, 1) * ROW}`} role="group" aria-label={alt} data-testid="horizontal-bars" sx={{ width: '100%', height: 'auto', display: 'block', '& a': { outline: 'none' }, '& a:focus-visible rect.track': { stroke: BRAND.cream, strokeWidth: 2 } }}>
      <title>{alt}</title>
      {rows.map((row, index) => {
        const y = index * ROW
        const content = (
          <>
            <rect className="track" x={LABEL} y={y + 6} width={W - LABEL - VALUE} height={18} rx={6} fill={alpha(BRAND.cream, 0.1)} />
            {lengths[index] > 0 && <rect x={LABEL} y={y + 6} width={Math.max(lengths[index], 3)} height={18} rx={6} fill={row.colour ?? STATS_TONES.gold} />}
            <text x={LABEL - 8} y={y + 20} textAnchor="end" fontSize="13" fill={BRAND.cream}>
              {row.label}
            </text>
            <text x={W} y={y + 20} textAnchor="end" fontSize="13" fontWeight="700" fill={BRAND.cream}>
              {row.valueLabel}
            </text>
            {row.href && <rect x={0} y={y} width={W} height={ROW} fill="transparent" />}
          </>
        )
        return row.href ? (
          <Link key={row.key} to={row.href} aria-label={`${row.label}: ${row.valueLabel}`} tabIndex={tabIndex} data-testid="bar-row">
            {content}
          </Link>
        ) : (
          <g key={row.key} data-testid="bar-row">
            {content}
          </g>
        )
      })}
    </Box>
  )
}
