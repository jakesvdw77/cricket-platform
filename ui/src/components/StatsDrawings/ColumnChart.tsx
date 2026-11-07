import { Box } from '@mui/material'
import { alpha } from '@mui/material/styles'
import { Link } from 'react-router-dom'
import { BRAND, STATS_COLOUR } from '../../brandTokens'
import { useFaceTabIndex } from '../FlipCard'
import { fluid, STATS_TYPE } from '../StatsCards/statsCardStyle'

export interface ColumnChartColumn {
  key: string
  value: number
  // The number printed on top of the column.
  valueLabel: string
  // Beneath the column (a date) and a second small line beneath that ("Econ 4.50").
  label?: string
  sub?: string
  // The Result page the column opens; omitted, it is plain.
  href?: string
  // The accessible name of the column when it is a link.
  name: string
}

export interface ColumnChartProps {
  columns: ColumnChartColumn[]
  alt: string
}

const SLOT = 44
const BAR = 28
const GAP = 4
const LABEL_ROOM = 14

// docs/specs/147: labelled columns (a few matches): the height is the value, the number is printed on top, a date and a small line sit
// beneath. A value of zero is a hollow marker on the baseline, so a zero is still visible. Fixed pixel widths; it grows in height to the
// region it is in (flex) and each column is a real link when it has a match. The values are also written as text, so the drawing is not
// the only carrier.
export function ColumnChart({ columns, alt }: ColumnChartProps) {
  const tabIndex = useFaceTabIndex()
  const ceiling = Math.max(1, ...columns.map((column) => column.value))
  return (
    <Box
      data-chart-grow=""
      sx={{ flex: '1 1 auto', minHeight: 72, minWidth: 0, width: '100%', height: 'var(--stats-chart-h, 112px)', maxHeight: 'var(--stats-chart-h, 150px)' }}
    >
      <Box role="group" aria-label={alt} data-testid="column-chart" sx={{ display: 'flex', gap: `${GAP}px`, height: '100%', minWidth: 0, overflow: 'hidden' }}>
        {columns.map((column) => {
          const pct = (column.value / ceiling) * 100
          const zero = column.value <= 0
          const body = (
            <>
              <Box sx={{ position: 'relative', flex: '1 1 0', minHeight: 0 }}>
                <Box sx={{ position: 'absolute', top: `calc(${LABEL_ROOM}px * var(--stats-scale, 1))`, left: 0, right: 0, bottom: 0 }}>
                  {zero ? (
                    <Box aria-hidden data-testid="column-zero" sx={{ position: 'absolute', bottom: 0, left: '50%', ml: '-5px', width: 10, height: 10, boxSizing: 'border-box', borderRadius: '50%', border: `1.5px solid ${BRAND.cream}` }} />
                  ) : (
                    <Box aria-hidden data-testid="column-bar" sx={{ position: 'absolute', bottom: 0, left: '50%', ml: `calc(${-BAR / 2}px * var(--stats-scale, 1))`, width: `calc(${BAR}px * var(--stats-scale, 1))`, height: `${pct}%`, minHeight: 3, borderRadius: '3px 3px 0 0', bgcolor: STATS_COLOUR.bar }} />
                  )}
                  <Box aria-hidden component="span" sx={{ position: 'absolute', left: 0, right: 0, textAlign: 'center', fontSize: fluid(12, 14), fontWeight: 700, lineHeight: 1.1, bottom: zero ? 12 : `calc(${pct}% + 2px)` }}>
                    {column.valueLabel}
                  </Box>
                </Box>
              </Box>
              {column.label && <Box component="span" sx={{ fontSize: fluid(11, 14), lineHeight: 1.2, color: alpha(BRAND.cream, 0.66), whiteSpace: 'nowrap', textAlign: 'center', mt: '3px' }}>{column.label}</Box>}
              {column.sub && <Box component="span" sx={{ fontSize: fluid(11, 14), lineHeight: 1.2, color: alpha(BRAND.cream, 0.66), whiteSpace: 'nowrap', textAlign: 'center' }}>{column.sub}</Box>}
            </>
          )
          const sx = { display: 'flex', flexDirection: 'column', width: `calc(${SLOT}px * var(--stats-scale, 1))`, flexShrink: 0, height: '100%', color: BRAND.cream, textDecoration: 'none' } as const
          return column.href ? (
            <Box key={column.key} component={Link} to={column.href} aria-label={column.name} tabIndex={tabIndex} data-testid="column" sx={{ ...sx, '&:focus-visible': { outline: `2px solid ${BRAND.cream}`, outlineOffset: 1 } }}>
              {body}
            </Box>
          ) : (
            <Box key={column.key} role="img" aria-label={column.name} data-testid="column" sx={sx}>
              {body}
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}
