import { Box } from '@mui/material'
import { alpha } from '@mui/material/styles'
import { BRAND, STATS_COLOUR } from '../../brandTokens'
import { barLengths, progressFraction } from './statsMath'

export interface ProgressRow {
  key: string
  // "Runs to 500"
  label: string
  value: number
  target: number
  // The sentence the server's figures make: "412 of 500, 88 to go".
  text: string
  // 'compare' paints the bar in the tone of `seriesIndex` (0 sand, 1 cool) for a two-category comparison; default neutral sand.
  tone?: 'neutral' | 'compare'
  seriesIndex?: 0 | 1
}

export interface ProgressBarsProps {
  rows: ProgressRow[]
  alt: string
}

// docs/specs/147: progress towards the next round number. The bar (8 px) shows value over target; the written sentence ("88 to go") is part
// of the row, so the figure is never only a length. Plain HTML rows with fixed 12 px type, capped in width.
export function ProgressBars({ rows, alt }: ProgressBarsProps) {
  const fills = barLengths(rows.map((row) => progressFraction(row.value, row.target)), 1, 100)
  return (
    <Box role="img" aria-label={alt} data-testid="progress-bars" sx={{ display: 'grid', gap: '8px', minWidth: 0, width: '100%', maxWidth: 'calc(520px * var(--stats-row-scale, 1))' }}>
      {rows.map((row, index) => (
        <Box key={row.key} data-testid="progress-row" sx={{ display: 'grid', gap: '3px', minWidth: 0 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, fontSize: 12, lineHeight: 1.2 }}>
            <Box component="span" aria-hidden sx={{ color: alpha(BRAND.cream, 0.8), minWidth: 0 }}>{row.label}</Box>
            <Box component="span" aria-hidden sx={{ color: BRAND.cream, fontWeight: 700, textAlign: 'right' }}>{row.text}</Box>
          </Box>
          <Box aria-hidden sx={{ height: 8, borderRadius: '4px', bgcolor: STATS_COLOUR.track, overflow: 'hidden' }}>
            {fills[index] > 0 && <Box sx={{ height: '100%', borderRadius: '4px', width: `${Math.max(fills[index], 3)}%`, bgcolor: row.tone === 'compare' && row.seriesIndex === 1 ? STATS_COLOUR.compareSecond : row.tone === 'compare' ? STATS_COLOUR.compareFirst : STATS_COLOUR.bar }} />}
          </Box>
        </Box>
      ))}
    </Box>
  )
}
