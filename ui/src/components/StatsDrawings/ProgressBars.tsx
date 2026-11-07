import { Box } from '@mui/material'
import { alpha } from '@mui/material/styles'
import { BRAND, STATS_COLOUR } from '../../brandTokens'
import { fluid, STATS_TYPE } from '../StatsCards/statsCardStyle'
import { barLengths, progressFraction } from './statsMath'

export interface ProgressRow {
  key: string
  // "Runs to 500"
  label: string
  value: number
  target: number
  // The sentence the server's figures make: "412 of 500, 88 to go".
  text: string
  // 'compare' paints the bar in the tone of `seriesIndex` (0 green, 1 blue) for a two-category comparison; default neutral sand.
  tone?: 'neutral' | 'compare'
  seriesIndex?: 0 | 1
  // An explicit bar colour (a STATS_COLOUR token) that carries meaning, e.g. milestone closeness; it also colours the row's text.
  colour?: string
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
    <Box role="img" aria-label={alt} data-testid="progress-bars" sx={{ display: 'grid', gap: fluid(10, 22), minWidth: 0, width: '100%' }}>
      {rows.map((row, index) => (
        <Box key={row.key} data-testid="progress-row" sx={{ display: 'grid', gap: fluid(4, 8), minWidth: 0 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, fontSize: fluid(STATS_TYPE.label, STATS_TYPE.labelExpanded), lineHeight: 1.2 }}>
            <Box component="span" aria-hidden sx={{ color: alpha(BRAND.cream, 0.8), minWidth: 0 }}>{row.label}</Box>
            <Box component="span" aria-hidden sx={{ color: row.colour ?? (row.tone === 'compare' ? (row.seriesIndex === 1 ? STATS_COLOUR.compareSecond : STATS_COLOUR.compareFirst) : BRAND.cream), fontWeight: 700, textAlign: 'right' }}>{row.text}</Box>
          </Box>
          <Box aria-hidden sx={{ height: fluid(10, 16), borderRadius: '8px', bgcolor: STATS_COLOUR.track, overflow: 'hidden' }}>
            {(fills[index] > 0 || row.tone === 'compare') && <Box sx={{ height: '100%', borderRadius: '8px', width: fills[index] > 0 ? `${Math.max(fills[index], 3)}%` : 3, bgcolor: row.colour ? row.colour : row.tone === 'compare' && row.seriesIndex === 1 ? STATS_COLOUR.compareSecond : row.tone === 'compare' ? STATS_COLOUR.compareFirst : STATS_COLOUR.bar }} />}
          </Box>
        </Box>
      ))}
    </Box>
  )
}
