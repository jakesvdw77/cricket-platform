import { useRef } from 'react'
import type { ReactNode } from 'react'
import { useMediaQuery } from '@mui/material'
import type { ChartsAxisContentProps, ResponsiveChartContainerProps } from '@mui/x-charts'
import { ChartTooltipBody } from './internal/ChartTooltipBody'
import type { CategoryStyle } from './chartStyles'

// docs/specs/117-stats-dashboard.md: non-component helpers shared by the chart wrappers (see chartCommon for the components).

// Fixed pixel size. Omitted in the app (the chart fills its 220 / 280 px area); tests and stories pass it because jsdom measures nothing.
export interface ChartSize {
  width: number
  height: number
}

// What a tooltip shows for one point; assembled by the page from response fields, never computed here.
export interface PointTooltip {
  title: string
  rows: { label: string; value: string; style?: CategoryStyle }[]
}

export const AXIS_FONT = 11

// Animation off under prefers-reduced-motion (spec "Reduced motion").
export function useReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)', { noSsr: true })
}

// How many x labels fit: every one up to 8 points, then thinned so 30 dates stay readable at 375 px.
export function labelStride(count: number, longest = 0): number {
  // a two-part label ("4 Oct W") needs twice the room of a bare date
  if (count <= 8) return longest > 6 && count > 5 ? 2 : 1
  if (count <= 16) return 2
  return 4
}

// A tooltip body for the axis trigger. The caller's function may change every render, so the component stays stable (a ref) and the
// slot never remounts while the pointer is over the chart.
export function useTooltipContent(tooltip: ((index: number) => PointTooltip | null) | undefined) {
  const ref = useRef(tooltip)
  ref.current = tooltip
  const contentRef = useRef<((props: ChartsAxisContentProps) => ReactNode) | null>(null)
  if (!contentRef.current) {
    const Content = (props: ChartsAxisContentProps) => {
      const index = props.dataIndex
      const data = index === null || index === undefined ? null : ref.current?.(index)
      if (!data) return null
      return <ChartTooltipBody data={data} />
    }
    contentRef.current = Content
  }
  return contentRef.current as (props: ChartsAxisContentProps) => ReactNode
}

type XAxisConfig = NonNullable<ResponsiveChartContainerProps['xAxis']>[number]

// The shared band x axis: one slot per point, the labels from `labels` (so two matches on one date stay two bars), thinned to fit.
// The library's axis union loses the band-only gap ratios in its type, hence the single cast here.
export function bandAxis(labels: string[], options: { categoryGapRatio?: number; barGapRatio?: number; axisText: string }): XAxisConfig {
  const stride = labelStride(labels.length, Math.max(0, ...labels.map((label) => label.length)))
  return {
    id: 'x',
    scaleType: 'band',
    data: labels.map((_, index) => index),
    valueFormatter: (index: number) => labels[index] ?? '',
    tickLabelInterval: (_value: number, index: number) => index % stride === 0,
    tickLabelStyle: { fontSize: AXIS_FONT, fill: options.axisText },
    // an undefined gap ratio would override the library default and measure NaN, so only defined ones are passed
    ...(options.categoryGapRatio !== undefined ? { categoryGapRatio: options.categoryGapRatio } : {}),
    ...(options.barGapRatio !== undefined ? { barGapRatio: options.barGapRatio } : {}),
  } as unknown as XAxisConfig
}
