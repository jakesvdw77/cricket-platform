import { useId } from 'react'
import { Box, Typography } from '@mui/material'
import { ChartContainer, PiePlot, useDrawingArea } from '@mui/x-charts'
import { useReducedMotion } from '../chartUtils'
import { ChartPatternDef, PatternSwatch } from '../chartPatterns'
import { fillFor, patternId, useChartPalette } from '../chartStyles'
import type { CategoryStyle } from '../chartStyles'

export interface DonutSlice {
  key: string
  label: string
  value: number
  // the share as the server sent it ("36%"); shown beside the count, never computed here
  percentText?: string | null
  style: CategoryStyle
}

export interface DonutChartProps {
  slices: DonutSlice[]
  // the big number in the middle and its caption ("14", "innings")
  centerValue: string
  centerLabel: string
}

const DIAMETER = 132

function Center({ value, label }: { value: string; label: string }) {
  const { left, top, width, height } = useDrawingArea()
  const palette = useChartPalette()
  const cx = left + width / 2
  const cy = top + height / 2
  return (
    <g aria-hidden>
      <text fontFamily={palette.fontFamily} x={cx} y={cy - 2} textAnchor="middle" fontSize={20} fontWeight={700} fill={palette.text}>
        {value}
      </text>
      <text fontFamily={palette.fontFamily} x={cx} y={cy + 14} textAnchor="middle" fontSize={11} fill={palette.axisText}>
        {label}
      </text>
    </g>
  )
}

// docs/specs/117-stats-dashboard.md (donuts): the slices as a ring with the total in the centre and a text legend carrying the
// count and the server's percentage, so no slice is told apart by colour alone (each also has a pattern). A fixed 132 px square.
export function DonutChart({ slices, centerValue, centerLabel }: DonutChartProps) {
  const palette = useChartPalette()
  const scope = useId()
  const reduced = useReducedMotion()
  // A slice of 0 draws nothing but stays in the legend.
  const drawn = slices.filter((slice) => slice.value > 0)
  return (
    <Box data-testid="donut-chart" sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: { xs: 'nowrap', sm: 'nowrap' } }}>
      <Box sx={{ flex: 'none', width: DIAMETER, height: DIAMETER }}>
        <ChartContainer
          width={DIAMETER}
          height={DIAMETER}
          margin={{ top: 2, right: 2, bottom: 2, left: 2 }}
          series={[
            {
              type: 'pie',
              id: 'donut',
              innerRadius: 40,
              outerRadius: DIAMETER / 2 - 2,
              paddingAngle: drawn.length > 1 ? 1.5 : 0,
              data: drawn.map((slice) => ({ id: slice.key, value: slice.value, label: slice.label, color: fillFor(scope, slice.key, slice.style, palette) })),
            },
          ]}
        >
          <defs>
            {slices.map((slice) => (
              <ChartPatternDef key={slice.key} id={patternId(scope, slice.key)} color={palette.tones[slice.style.tone]} kind={slice.style.pattern} />
            ))}
          </defs>
          <PiePlot skipAnimation={reduced} />
          <Center value={centerValue} label={centerLabel} />
        </ChartContainer>
      </Box>
      <Box component="ul" aria-label="Legend" data-testid="donut-legend" sx={{ m: 0, p: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 0.625, flex: 1, minWidth: 0 }}>
        {slices.map((slice) => (
          <Box component="li" key={slice.key} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, fontSize: '0.8125rem' }}>
            <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
              <PatternSwatch style={slice.style} />
              <Typography component="span" sx={{ fontSize: 'inherit' }}>
                {slice.label}
              </Typography>
            </Box>
            <Typography component="b" sx={{ fontSize: 'inherit', fontWeight: 700, whiteSpace: 'nowrap' }}>
              {slice.value}
              {slice.percentText ? ` · ${slice.percentText}` : ''}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  )
}
