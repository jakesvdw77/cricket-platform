import { useEffect, useRef, useState } from 'react'
import { Box } from '@mui/material'
import { alpha } from '@mui/material/styles'
import { Link } from 'react-router-dom'
import { BRAND, STATS_COLOUR } from '../../brandTokens'
import { useFaceTabIndex } from '../FlipCard'
import { ColumnChart } from './ColumnChart'
import { linePath, linearScale, niceCeil, xPositions } from './statsMath'
import type { Point } from './statsMath'

export interface LineChartPoint {
  key: string
  value: number
  // A hollow dot: the innings ended not out.
  notOut?: boolean
  // The Result page this dot opens; omitted, the dot is not a link.
  href?: string
  // The dot's accessible name when it is a link ("47 not out against Rovers, 1 November"); a hollow dot says "not out" in it.
  name: string
  // The number printed by the dot (default: the value as it is); the date under a column when there are too few points for a line.
  valueLabel?: string
  label?: string
}

export interface LineGuide {
  value: number
  label: string
}

export interface LineChartProps {
  points: LineChartPoint[]
  // The running average after each point (same length, null where there is none yet). Values come from the server.
  average?: (number | null)[]
  guides?: LineGuide[]
  // The text alternative of the whole drawing (the back of the card carries the same values as a table).
  alt: string
  // The first and last date, under the axis.
  startLabel?: string
  endLabel?: string
}

// Fixed sizes in px: the drawing is measured (ResizeObserver) and drawn in a viewBox equal to its real pixel size, so text (10 to 11 px),
// strokes (1.5 and 2 px) and dots (radius 4) never scale with the width. The height is the region it is in (a flex item, 96 px to start, capped at 140 px; the expanded card sets --stats-chart-scale to 2).
const DEFAULT = { w: 320, h: 96 }
const PAD = { left: 30, right: 12, top: 18, bottom: 18 }
// Every dot gets its number when there are this many points or fewer.
const LABELLED_MAX = 8
// Fewer points than this are drawn as labelled columns, not a line.
const LINE_MIN = 3
const HIT = 12

// docs/specs/147: runs per innings in date order, guide lines at the server's values, a running-average line and a hollow dot for a not
// out. Our own SVG (no chart library). Each dot is a real link with an accessible name; links on the hidden face of a flip card leave
// the tab order. The drawing's text alternative is `alt`; the card's back repeats the values as a table.
export function LineChart(props: LineChartProps) {
  if (props.points.length < LINE_MIN) {
    return (
      <ColumnChart
        alt={props.alt}
        columns={props.points.map((point) => ({ key: point.key, value: point.value, valueLabel: point.valueLabel ?? String(point.value), label: point.label, href: point.href, name: point.name }))}
      />
    )
  }
  return <Line {...props} />
}

function Line({ points, average, guides = [], alt, startLabel, endLabel }: LineChartProps) {
  const tabIndex = useFaceTabIndex()
  const ref = useRef<SVGSVGElement>(null)
  const [size, setSize] = useState(DEFAULT)
  useEffect(() => {
    const node = ref.current
    if (!node) return undefined
    const measure = () => {
      const w = Math.round(node.clientWidth)
      const h = Math.round(node.clientHeight)
      if (w > 0 && h > 0) setSize((current) => (current.w === w && current.h === h ? current : { w, h }))
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  const W = size.w
  const H = size.h
  const BOX = { left: PAD.left, top: PAD.top, width: Math.max(W - PAD.left - PAD.right, 40), height: Math.max(H - PAD.top - PAD.bottom, 30) }
  const ceiling = niceCeil(Math.max(0, ...points.map((p) => p.value), ...guides.map((g) => g.value), ...(average ?? []).filter((v): v is number => v !== null)))
  const y = linearScale(0, ceiling, BOX.top + BOX.height, BOX.top)
  const xs = xPositions(points.length, BOX.left + 6, BOX.width - 12)
  const line: Point[] = points.map((p, index) => ({ x: xs[index], y: y(p.value) }))
  const avg: Point[] = (average ?? []).map((v, index) => ({ x: xs[index], y: v === null ? null : y(v) }))
  const labelled = points.length <= LABELLED_MAX
  const tickClear = (value: number) => guides.every((guide) => Math.abs(y(guide.value) - y(value)) > 10)
  return (
    <Box data-chart-grow="" sx={{ position: 'relative', flex: '1 1 auto', minWidth: 0, width: '100%', maxWidth: 'calc(560px * var(--stats-chart-scale, 1))', minHeight: 72, height: 'calc(96px * var(--stats-chart-scale, 1))', maxHeight: 'calc(140px * var(--stats-chart-scale, 1))' }}>
    <Box
      component="svg"
      ref={ref}
      viewBox={`0 0 ${W} ${H}`}
      role="group"
      aria-label={alt}
      data-testid="line-chart"
      sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', overflow: 'visible', '& a': { outline: 'none' }, '& a:focus-visible circle.dot': { stroke: BRAND.cream, strokeWidth: 2.5 } }}
    >
      <title>{alt}</title>
      <line x1={BOX.left} x2={BOX.left + BOX.width} y1={y(0)} y2={y(0)} stroke={alpha(BRAND.cream, 0.28)} />
      {[0, ceiling].filter(tickClear).map((tick) => (
        <text key={`tick-${tick}`} data-testid="line-tick" x={BOX.left - 5} y={y(tick) + 3} fontSize="10" textAnchor="end" fill={alpha(BRAND.cream, 0.55)} aria-hidden>
          {tick}
        </text>
      ))}
      {guides.map((guide) => (
        <g key={guide.label} data-testid="line-guide">
          <line x1={BOX.left} x2={BOX.left + BOX.width} y1={y(guide.value)} y2={y(guide.value)} stroke={STATS_COLOUR.guide} strokeDasharray="3 3" />
          <text x={BOX.left - 5} y={y(guide.value) + 3} fontSize="10" textAnchor="end" fill={STATS_COLOUR.guideLabel} aria-hidden>
            {guide.label}
          </text>
        </g>
      ))}
      {line.length > 1 && <path d={linePath(line)} fill="none" stroke={STATS_COLOUR.line} strokeWidth={1.5} strokeLinejoin="round" />}
      {avg.length > 1 && <path data-testid="line-average" d={linePath(avg)} fill="none" stroke={STATS_COLOUR.average} strokeWidth={2} strokeDasharray="5 3" strokeLinecap="round" strokeLinejoin="round" />}
      {points.map((point, index) => {
        const dot = (
          <>
            <circle className="dot" cx={xs[index]} cy={y(point.value)} r={4} fill={point.notOut ? 'transparent' : STATS_COLOUR.marker} stroke={STATS_COLOUR.marker} strokeWidth={1.5} data-notout={point.notOut ? 'true' : 'false'} />
            {labelled && (
              <text data-testid="line-value" x={xs[index]} y={y(point.value) - 8} fontSize="10" fontWeight="700" textAnchor="middle" fill={STATS_COLOUR.valueLabel} aria-hidden>
                {point.valueLabel ?? String(point.value)}
              </text>
            )}
            {point.href && <circle cx={xs[index]} cy={y(point.value)} r={HIT} fill="transparent" />}
          </>
        )
        return point.href ? (
          <Link key={point.key} to={point.href} aria-label={point.name} tabIndex={tabIndex} data-testid="line-dot">
            {dot}
          </Link>
        ) : (
          <g key={point.key} data-testid="line-dot">
            {dot}
          </g>
        )
      })}
      {startLabel && (
        <text x={BOX.left} y={H - 4} fontSize="10" fill={alpha(BRAND.cream, 0.66)} aria-hidden>
          {startLabel}
        </text>
      )}
      {endLabel && (
        <text x={BOX.left + BOX.width} y={H - 4} fontSize="10" textAnchor="end" fill={alpha(BRAND.cream, 0.66)} aria-hidden>
          {endLabel}
        </text>
      )}
    </Box>
    </Box>
  )
}
