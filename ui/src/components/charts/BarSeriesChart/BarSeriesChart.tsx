import { useId, useMemo } from 'react'
import { BarPlot, ChartsAxisHighlight, ChartsGrid, ChartsReferenceLine, ChartsTooltip, ChartsXAxis, ChartsYAxis } from '@mui/x-charts'
import { BarValueLabels, ChartFrame, GapMarkers } from '../internal/chartCommon'
import { AXIS_FONT, bandAxis, useReducedMotion, useTooltipContent } from '../chartUtils'
import type { ChartSize, PointTooltip } from '../chartUtils'
import { ChartPatternDef } from '../chartPatterns'
import { fillFor, patternId, useChartPalette } from '../chartStyles'
import type { CategoryStyle } from '../chartStyles'

export interface BarSeriesChartProps {
  // x tick labels (dates), one per bar, oldest left; duplicates are fine
  labels: string[]
  // one bar per entry; null is a labelled gap, never a zero bar
  values: (number | null)[]
  // per bar: true draws the hatched (not-out) fill
  hatched?: boolean[]
  // the direct label above each bar ("56*"); defaults to the value, null shows none
  valueTexts?: (string | null)[]
  // the word shown for a gap ("n/r")
  gapText?: string
  // a dashed reference line (the average) and its label ("Avg 37.5")
  referenceValue?: number | null
  referenceLabel?: string
  // fixed upper bound of the y axis (100 for a percentage); omitted lets the library choose
  max?: number
  // the tooltip body for the bar at an index
  tooltip?: (index: number) => PointTooltip | null
  size?: ChartSize
}

const SOLID: CategoryStyle = { tone: 'primary', pattern: 'solid' }
const HATCHED: CategoryStyle = { tone: 'primary', pattern: 'diagonal' }

// The library cannot stack a null (it measures NaN), so the bar that does not apply is 0 high; a missing value is drawn as a labelled gap, never a bar.
// docs/specs/117-stats-dashboard.md ("Runs per innings", "Wickets per match", "Dot balls"): single-axis bars, oldest left, a hatched
// fill for the marked bars (not out), direct value labels, gaps for missing values and an optional dashed reference line.
// Draws what it is given; every figure comes from the server.
export function BarSeriesChart({ labels, values, hatched, valueTexts, gapText = 'n/r', referenceValue, referenceLabel, max, tooltip, size }: BarSeriesChartProps) {
  const palette = useChartPalette()
  const scope = useId()
  const reduced = useReducedMotion()
  const Tooltip = useTooltipContent(tooltip)
  const hatchId = patternId(scope, 'hatched')
  const solidData = useMemo(() => values.map((value, index) => (hatched?.[index] ? 0 : (value ?? 0))), [values, hatched])
  const hatchedData = useMemo(() => values.map((value, index) => (hatched?.[index] ? (value ?? 0) : 0)), [values, hatched])
  const gaps = values.flatMap((value, index) => (value === null ? [{ index, text: gapText }] : []))
  const texts = valueTexts ?? values.map((value) => (value === null ? null : String(value)))

  return (
    <ChartFrame
      size={size}
      margin={{ top: 18, right: 10, bottom: 28, left: 34 }}
      series={[
        { type: 'bar', id: 'solid', data: solidData, stack: 'bars', color: fillFor(scope, 'solid', SOLID, palette) },
        { type: 'bar', id: 'hatched', data: hatchedData, stack: 'bars', color: fillFor(scope, 'hatched', HATCHED, palette) },
      ]}
      xAxis={[bandAxis(labels, { axisText: palette.axisText, categoryGapRatio: 0.25 })]}
      yAxis={[{ id: 'y', min: 0, ...(max !== undefined ? { max } : {}), tickLabelStyle: { fontSize: AXIS_FONT, fill: palette.axisText } }]}
    >
      <defs>
        <ChartPatternDef id={hatchId} color={palette.tones.primary} kind="diagonal" />
      </defs>
      <ChartsGrid horizontal />
      <BarPlot skipAnimation={reduced} borderRadius={3} />
      <BarValueLabels tops={values} texts={texts} />
      <GapMarkers gaps={gaps} />
      {referenceValue !== null && referenceValue !== undefined && (
        <ChartsReferenceLine
          y={referenceValue}
          label={referenceLabel}
          labelAlign="end"
          lineStyle={{ stroke: palette.text, strokeWidth: 2, strokeDasharray: '6 4' }}
          labelStyle={{ fontSize: 11, fontWeight: 700, fill: palette.text }}
        />
      )}
      <ChartsXAxis axisId="x" disableTicks />
      <ChartsYAxis axisId="y" disableTicks />
      <ChartsAxisHighlight x="band" />
      <ChartsTooltip trigger="axis" slots={{ axisContent: Tooltip }} />
    </ChartFrame>
  )
}
