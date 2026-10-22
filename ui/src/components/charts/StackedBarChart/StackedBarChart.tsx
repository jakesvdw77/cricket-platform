import { useId } from 'react'
import { BarPlot, ChartsAxisHighlight, ChartsGrid, ChartsTooltip, ChartsXAxis, ChartsYAxis } from '@mui/x-charts'
import { BarValueLabels, ChartFrame, GapMarkers } from '../internal/chartCommon'
import { AXIS_FONT, bandAxis, useReducedMotion, useTooltipContent } from '../chartUtils'
import type { ChartSize, PointTooltip } from '../chartUtils'
import { ChartPatternDef } from '../chartPatterns'
import { fillFor, patternId, useChartPalette } from '../chartStyles'
import type { CategoryStyle } from '../chartStyles'

export interface StackedCategory {
  key: string
  label: string
  style: CategoryStyle
}

export interface StackedBarChartProps {
  labels: string[]
  // bottom to top
  categories: StackedCategory[]
  // values[c][i]: category c at point i; null = not recorded (no segment, never 0)
  values: (number | null)[][]
  // the server's total per point, drawn above the stack; null = a gap (nothing recorded)
  totals: (number | null)[]
  gapText?: string
  tooltip?: (index: number) => PointTooltip | null
  size?: ChartSize
}

// docs/specs/117-stats-dashboard.md ("Extras conceded"): one stacked bar per match, a distinct pattern per type, the total on top,
// a labelled gap where nothing was recorded. Single axis. Draws only what the response supplies.
export function StackedBarChart({ labels, categories, values, totals, gapText = 'n/r', tooltip, size }: StackedBarChartProps) {
  const palette = useChartPalette()
  const scope = useId()
  const reduced = useReducedMotion()
  const Tooltip = useTooltipContent(tooltip)
  const gaps = totals.flatMap((total, index) => (total === null ? [{ index, text: gapText }] : []))

  return (
    <ChartFrame
      size={size}
      margin={{ top: 18, right: 10, bottom: 28, left: 34 }}
      series={categories.map((category, index) => ({
        type: 'bar' as const,
        id: category.key,
        label: category.label,
        // a null cannot be stacked (the library measures NaN): a segment not recorded is 0 high, so nothing is drawn for it
        data: (values[index] ?? []).map((value) => value ?? 0),
        stack: 'stack',
        color: fillFor(scope, category.key, category.style, palette),
      }))}
      xAxis={[bandAxis(labels, { axisText: palette.axisText, categoryGapRatio: 0.25 })]}
      yAxis={[{ id: 'y', min: 0, tickLabelStyle: { fontSize: AXIS_FONT, fill: palette.axisText } }]}
    >
      <defs>
        {categories.map((category) => (
          <ChartPatternDef key={category.key} id={patternId(scope, category.key)} color={palette.tones[category.style.tone]} kind={category.style.pattern} />
        ))}
      </defs>
      <ChartsGrid horizontal />
      <BarPlot skipAnimation={reduced} />
      <BarValueLabels tops={totals} texts={totals.map((total) => (total === null ? null : String(total)))} />
      <GapMarkers gaps={gaps} />
      <ChartsXAxis axisId="x" disableTicks />
      <ChartsYAxis axisId="y" disableTicks />
      <ChartsAxisHighlight x="band" />
      <ChartsTooltip trigger="axis" slots={{ axisContent: Tooltip }} />
    </ChartFrame>
  )
}
