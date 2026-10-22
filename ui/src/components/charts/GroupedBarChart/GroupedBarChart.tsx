import { useId } from 'react'
import { BarPlot, ChartsAxisHighlight, ChartsGrid, ChartsTooltip, ChartsXAxis, ChartsYAxis } from '@mui/x-charts'
import { BarValueLabels, ChartFrame, GapMarkers } from '../internal/chartCommon'
import { AXIS_FONT, bandAxis, useReducedMotion, useTooltipContent } from '../chartUtils'
import type { ChartSize, PointTooltip } from '../chartUtils'
import { ChartPatternDef } from '../chartPatterns'
import { fillFor, patternId, useChartPalette } from '../chartStyles'
import type { CategoryStyle } from '../chartStyles'

export interface GroupedSeries {
  key: string
  label: string
  style: CategoryStyle
  // one value per point; null = a gap (no usable innings), never a zero bar
  values: (number | null)[]
}

export interface GroupedBarChartProps {
  // x tick labels, one per pair: the date and the result letter ("4 Oct W")
  labels: string[]
  series: GroupedSeries[]
  // the word under a pair with no value at all ("forfeit", "n/r"), per point
  gapTexts?: (string | null)[]
  tooltip?: (index: number) => PointTooltip | null
  size?: ChartSize
}

// docs/specs/117-stats-dashboard.md ("Runs scored versus conceded"): grouped bars per match (scored solid, conceded hatched), the
// result letter in the axis label. Single axis. The first series gets direct value labels.
export function GroupedBarChart({ labels, series, gapTexts, tooltip, size }: GroupedBarChartProps) {
  const palette = useChartPalette()
  const scope = useId()
  const reduced = useReducedMotion()
  const Tooltip = useTooltipContent(tooltip)
  const count = labels.length
  const gaps = (gapTexts ?? []).flatMap((text, index) => (text ? [{ index, text }] : []))
  const first = series[0]

  return (
    <ChartFrame
      size={size}
      margin={{ top: 18, right: 10, bottom: 28, left: 38 }}
      series={series.map((entry) => ({
        type: 'bar' as const,
        id: entry.key,
        label: entry.label,
        data: entry.values,
        color: fillFor(scope, entry.key, entry.style, palette),
      }))}
      xAxis={[bandAxis(labels, { axisText: palette.axisText, categoryGapRatio: 0.2, barGapRatio: 0.05 })]}
      yAxis={[{ id: 'y', min: 0, tickLabelStyle: { fontSize: AXIS_FONT, fill: palette.axisText } }]}
    >
      <defs>
        {series.map((entry) => (
          <ChartPatternDef key={entry.key} id={patternId(scope, entry.key)} color={palette.tones[entry.style.tone]} kind={entry.style.pattern} />
        ))}
      </defs>
      <ChartsGrid horizontal />
      <BarPlot skipAnimation={reduced} borderRadius={2} />
      {first && count <= 12 && <BarValueLabels group={{ index: 0, count: series.length }} tops={first.values} texts={first.values.map((value) => (value === null ? null : String(value)))} />}
      <GapMarkers gaps={gaps} />
      <ChartsXAxis axisId="x" disableTicks />
      <ChartsYAxis axisId="y" disableTicks />
      <ChartsAxisHighlight x="band" />
      <ChartsTooltip trigger="axis" slots={{ axisContent: Tooltip }} />
    </ChartFrame>
  )
}
