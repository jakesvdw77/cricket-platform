import { Box } from '@mui/material'
import { alpha } from '@mui/material/styles'
import { Link } from 'react-router-dom'
import { BRAND, STATS_TONES } from '../../brandTokens'
import { useFaceTabIndex } from '../FlipCard'
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

const W = 320
const H = 190
const BOX = { left: 34, top: 12, width: 274, height: 140 }
const HIT = 15

// docs/specs/147: runs per innings in date order, guide lines at the server's values, a running-average line and a hollow dot for a not
// out. Our own SVG (no chart library). Each dot is a real link with an accessible name; links on the hidden face of a flip card leave
// the tab order. The drawing's text alternative is `alt`; the card's back repeats the values as a table.
export function LineChart({ points, average, guides = [], alt, startLabel, endLabel }: LineChartProps) {
  const tabIndex = useFaceTabIndex()
  const ceiling = niceCeil(Math.max(0, ...points.map((p) => p.value), ...guides.map((g) => g.value), ...(average ?? []).filter((v): v is number => v !== null)))
  const y = linearScale(0, ceiling, BOX.top + BOX.height, BOX.top)
  const xs = xPositions(points.length, BOX.left + 8, BOX.width - 16)
  const line: Point[] = points.map((p, index) => ({ x: xs[index], y: y(p.value) }))
  const avg: Point[] = (average ?? []).map((v, index) => ({ x: xs[index], y: v === null ? null : y(v) }))
  return (
    <Box
      component="svg"
      viewBox={`0 0 ${W} ${H}`}
      role="group"
      aria-label={alt}
      data-testid="line-chart"
      sx={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible', '& a': { outline: 'none' }, '& a:focus-visible circle.dot': { stroke: BRAND.cream, strokeWidth: 3 } }}
    >
      <title>{alt}</title>
      <line x1={BOX.left} x2={BOX.left + BOX.width} y1={y(0)} y2={y(0)} stroke={alpha(BRAND.cream, 0.28)} />
      {guides.map((guide) => (
        <g key={guide.label} data-testid="line-guide">
          <line x1={BOX.left} x2={BOX.left + BOX.width} y1={y(guide.value)} y2={y(guide.value)} stroke={alpha(STATS_TONES.gold, 0.7)} strokeDasharray="4 4" />
          <text x={BOX.left - 5} y={y(guide.value) + 4} fontSize="11" textAnchor="end" fill={STATS_TONES.gold} aria-hidden>
            {guide.label}
          </text>
        </g>
      ))}
      {line.length > 1 && <path d={linePath(line)} fill="none" stroke={alpha(BRAND.cream, 0.55)} strokeWidth={2} strokeLinejoin="round" />}
      {avg.length > 1 && <path data-testid="line-average" d={linePath(avg)} fill="none" stroke={STATS_TONES.blue} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />}
      {points.map((point, index) => {
        const dot = (
          <>
            <circle className="dot" cx={xs[index]} cy={y(point.value)} r={5} fill={point.notOut ? 'transparent' : BRAND.cream} stroke={BRAND.cream} strokeWidth={2} data-notout={point.notOut ? 'true' : 'false'} />
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
        <text x={BOX.left} y={H - 8} fontSize="11" fill={alpha(BRAND.cream, 0.66)} aria-hidden>
          {startLabel}
        </text>
      )}
      {endLabel && (
        <text x={BOX.left + BOX.width} y={H - 8} fontSize="11" textAnchor="end" fill={alpha(BRAND.cream, 0.66)} aria-hidden>
          {endLabel}
        </text>
      )}
    </Box>
  )
}
