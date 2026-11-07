import { Box } from '@mui/material'
import { alpha } from '@mui/material/styles'
import { BRAND, STATS_TONES } from '../../brandTokens'
import { barLengths, progressFraction } from './statsMath'

export interface ProgressRow {
  key: string
  // "Runs to 500"
  label: string
  value: number
  target: number
  // The sentence the server's figures make: "412 of 500, 88 to go".
  text: string
}

export interface ProgressBarsProps {
  rows: ProgressRow[]
  alt: string
}

const W = 320
const TRACK = 14
const ROW = 46

// docs/specs/147: progress towards the next round number. The bar shows value over target; the written sentence ("88 to go") is part of
// the row, so the figure is never only a length. Our own SVG.
export function ProgressBars({ rows, alt }: ProgressBarsProps) {
  const fills = barLengths(rows.map((row) => progressFraction(row.value, row.target)), 1, W)
  return (
    <Box component="svg" viewBox={`0 0 ${W} ${Math.max(rows.length, 1) * ROW}`} role="img" aria-label={alt} data-testid="progress-bars" sx={{ width: '100%', height: 'auto', display: 'block' }}>
      {rows.map((row, index) => {
        const y = index * ROW
        return (
          <g key={row.key} data-testid="progress-row">
            <text x={0} y={y + 14} fontSize="13" fill={alpha(BRAND.cream, 0.8)} aria-hidden>
              {row.label}
            </text>
            <text x={W} y={y + 14} fontSize="13" fontWeight="700" textAnchor="end" fill={BRAND.cream} aria-hidden>
              {row.text}
            </text>
            <rect x={0} y={y + 22} width={W} height={TRACK} rx={7} fill={alpha(BRAND.cream, 0.12)} />
            {fills[index] > 0 && <rect x={0} y={y + 22} width={Math.max(fills[index], TRACK / 2)} height={TRACK} rx={7} fill={STATS_TONES.gold} />}
          </g>
        )
      })}
    </Box>
  )
}
