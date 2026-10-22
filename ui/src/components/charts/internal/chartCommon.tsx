import type { ReactNode } from 'react'
import { ResponsiveChartContainer, useDrawingArea, useXScale, useYScale } from '@mui/x-charts'
import type { ResponsiveChartContainerProps } from '@mui/x-charts'
import { useChartPalette } from './chartStyles'
import type { ChartSize } from './chartUtils'
import { AXIS_FONT } from './chartUtils'

// docs/specs/117-stats-dashboard.md: components shared by the chart wrappers. Together with the wrappers this is the only code that
// imports @mui/x-charts (an oxlint override and a structural test keep it that way).

export function ChartFrame({ size, children, ...rest }: { size?: ChartSize; children: ReactNode } & Omit<ResponsiveChartContainerProps, 'width' | 'height' | 'children'>) {
  return (
    <ResponsiveChartContainer width={size?.width} height={size?.height} {...rest}>
      {children}
    </ResponsiveChartContainer>
  )
}

// Direct value labels above the bars of a band x axis (a per-point text from the response, never a computed figure). `valueAt`
// is the bar's top value (the stack total for a stacked chart); null skips the point.
export function BarValueLabels({ tops, texts, group }: { tops: (number | null)[]; texts: (string | null)[]; group?: { index: number; count: number } }) {
  const xScale = useXScale<'band'>() as unknown as ((index: number) => number | undefined) & { bandwidth: () => number }
  const yScale = useYScale() as unknown as (value: number) => number
  const palette = useChartPalette()
  return (
    <g aria-hidden>
      {tops.map((top, index) => {
        const text = texts[index]
        if (top === null || text === null || text === undefined) return null
        const x = xScale(index)
        if (x === undefined) return null
        return (
          <text key={index} fontFamily={palette.fontFamily} x={x + (group ? (xScale.bandwidth() / group.count) * (group.index + 0.5) : xScale.bandwidth() / 2)} y={yScale(top) - 3} textAnchor="middle" fontSize={11} fontWeight={700} fill={palette.text}>
            {text}
          </text>
        )
      })}
    </g>
  )
}

// A match with no value is a labelled gap: a short dashed outline at the base with a word ("n/r", "forfeit"), never a zero bar.
export function GapMarkers({ gaps }: { gaps: { index: number; text: string }[] }) {
  const xScale = useXScale<'band'>() as unknown as ((index: number) => number | undefined) & { bandwidth: () => number }
  const { top, height } = useDrawingArea()
  const palette = useChartPalette()
  const base = top + height
  return (
    <g aria-hidden>
      {gaps.map(({ index, text }) => {
        const x = xScale(index)
        if (x === undefined) return null
        const width = xScale.bandwidth()
        return (
          <g key={index}>
            <rect x={x + width * 0.2} y={base - 14} width={width * 0.6} height={14} rx={3} fill="none" stroke={palette.axisText} strokeWidth={1.5} strokeDasharray="3 2" />
            <text fontFamily={palette.fontFamily} x={x + width / 2} y={base - 18} textAnchor="middle" fontSize={AXIS_FONT} fill={palette.axisText}>
              {text}
            </text>
          </g>
        )
      })}
    </g>
  )
}
