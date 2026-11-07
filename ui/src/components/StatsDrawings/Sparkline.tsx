import { Box } from '@mui/material'
import { STATS_TONES } from '../../brandTokens'
import { sparkline } from './statsMath'

export interface SparklineProps {
  values: (number | null)[]
  alt: string
  width?: number
  height?: number
  colour?: string
}

// docs/specs/147: a tiny trend line with its last point marked. A null value is a gap. Our own SVG; the alternative text says what it shows.
export function Sparkline({ values, alt, width = 120, height = 36, colour = STATS_TONES.blue }: SparklineProps) {
  const { path, last } = sparkline(values, width, height)
  return (
    <Box component="svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={alt} data-testid="sparkline" sx={{ width, maxWidth: '100%', height: 'auto', display: 'block' }}>
      {path && <path d={path} fill="none" stroke={colour} strokeWidth={1.5} vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />}
      {last && <circle cx={last[0]} cy={last[1]} r={2.5} fill={colour} />}
    </Box>
  )
}
