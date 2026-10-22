import { createContext, useContext, useMemo } from 'react'
import { ChartsAxisHighlight, ChartsGrid, ChartsReferenceLine, ChartsTooltip, ChartsXAxis, ChartsYAxis, LinePlot, MarkPlot } from '@mui/x-charts'
import type { MarkElementProps } from '@mui/x-charts'
import { ChartFrame, GapMarkers } from '../chartCommon'
import { AXIS_FONT, bandAxis, useReducedMotion, useTooltipContent } from '../chartUtils'
import type { ChartSize, PointTooltip } from '../chartUtils'
import { MarkerShape } from '../ChartLegend'
import type { LineMarkerShape } from '../ChartLegend'
import { useChartPalette } from '../chartStyles'
import type { ChartTone } from '../chartStyles'

export interface LineSeriesDef {
  key: string
  label: string
  // one value per point; null = a gap (the line breaks), never a zero
  values: (number | null)[]
  tone: ChartTone
  marker: LineMarkerShape
  dashed?: boolean
  // a label above every point (set when there are few points)
  pointTexts?: (string | null)[]
}

export interface LineSeriesChartProps {
  labels: string[]
  series: LineSeriesDef[]
  // a dashed reference line (overall economy, average) with its labelled value
  referenceValue?: number | null
  referenceLabel?: string
  // the word shown at a point where every series is missing ("n/r")
  gapText?: string
  // true: show gap markers for points where the first series is null
  markGaps?: boolean
  tooltip?: (index: number) => PointTooltip | null
  size?: ChartSize
}

interface MarkContextValue {
  shapes: Record<string, LineMarkerShape>
  texts: Record<string, (string | null)[] | undefined>
}

const MarkContext = createContext<MarkContextValue>({ shapes: {}, texts: {} })

// The point markers: a distinct shape per series and an optional direct value label.
function LineMark(props: MarkElementProps) {
  const { x, y, id, color, dataIndex } = props as unknown as { x: number; y: number; id: string; color: string; dataIndex: number }
  const { shapes, texts } = useContext(MarkContext)
  const palette = useChartPalette()
  const text = texts[id]?.[dataIndex]
  return (
    <g transform={`translate(${x}, ${y})`}>
      <MarkerShape shape={shapes[id] ?? 'circle'} cx={0} cy={0} color={color} fill={palette.paper} />
      {text && (
        <text fontFamily={palette.fontFamily} y={-10} textAnchor="middle" fontSize={10} fontWeight={700} fill={palette.text} stroke={palette.paper} strokeWidth={3} paintOrder="stroke">
          {text}
        </text>
      )}
    </g>
  )
}

// docs/specs/117-stats-dashboard.md ("Batting trend", "Economy rate", "Run rate trend"): single-axis lines with a distinct marker shape
// per series, broken (not zeroed) across missing values, an optional dashed reference line with a labelled value. The line is
// drawn from the response's values; nothing is computed here.
export function LineSeriesChart({ labels, series, referenceValue, referenceLabel, gapText = 'n/r', markGaps = true, tooltip, size }: LineSeriesChartProps) {
  const palette = useChartPalette()
  const reduced = useReducedMotion()
  const Tooltip = useTooltipContent(tooltip)
  const gaps = markGaps ? (series[0]?.values ?? []).flatMap((value, index) => (value === null && series.every((entry) => entry.values[index] === null) ? [{ index, text: gapText }] : [])) : []
  const context = useMemo<MarkContextValue>(
    () => ({ shapes: Object.fromEntries(series.map((entry) => [entry.key, entry.marker])), texts: Object.fromEntries(series.map((entry) => [entry.key, entry.pointTexts])) }),
    [series],
  )
  const lineSx = Object.fromEntries(
    series.map((entry) => [`& .MuiLineElement-series-${entry.key}`, { strokeWidth: 2.5, strokeDasharray: entry.dashed ? '7 5' : 'none' }]),
  )

  return (
    <MarkContext.Provider value={context}>
      <ChartFrame
        size={size}
        sx={lineSx}
        margin={{ top: 22, right: 14, bottom: 28, left: 34 }}
        series={series.map((entry) => ({
          type: 'line' as const,
          id: entry.key,
          label: entry.label,
          data: entry.values,
          color: entry.tone === 'grey' ? palette.text : palette.tones[entry.tone],
          showMark: true,
          curve: 'linear' as const,
          connectNulls: false,
        }))}
        xAxis={[bandAxis(labels, { axisText: palette.axisText })]}
        yAxis={[{ id: 'y', min: 0, tickLabelStyle: { fontSize: AXIS_FONT, fill: palette.axisText } }]}
      >
        <ChartsGrid horizontal />
        <LinePlot skipAnimation={reduced} />
        <MarkPlot skipAnimation={reduced} slots={{ mark: LineMark }} />
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
        <ChartsAxisHighlight x="line" />
        <ChartsTooltip trigger="axis" slots={{ axisContent: Tooltip }} />
      </ChartFrame>
    </MarkContext.Provider>
  )
}
