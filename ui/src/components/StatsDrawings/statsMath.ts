// docs/specs/147: the pure scale and path helpers behind the stats drawings, in the style of components/ResultDrawings/drawingMath.ts.
// No React, no DOM, no chart library. They turn numbers the server already computed into coordinates; they work out no statistic
// (no average, no share of a figure), so a drawing never disagrees with the card it sits on.

export interface Point {
  x: number
  // null leaves a gap in a line (a value that was not recorded), never a zero.
  y: number | null
}

export interface PlotBox {
  left: number
  top: number
  width: number
  height: number
}

// Maps a value in [d0, d1] to [r0, r1]. A flat domain maps to the middle of the range.
export function linearScale(d0: number, d1: number, r0: number, r1: number): (value: number) => number {
  if (d1 === d0) return () => (r0 + r1) / 2
  return (value) => r0 + ((value - d0) / (d1 - d0)) * (r1 - r0)
}

// The next "nice" top for an axis: 1, 2, 5 times a power of ten at or above the value (at least 1).
export function niceCeil(value: number): number {
  if (!(value > 0)) return 1
  const power = Math.pow(10, Math.floor(Math.log10(value)))
  const fraction = value / power
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10
  return nice * power
}

// `count` x positions across `width` from `left`, evenly spaced; one value sits in the middle.
export function xPositions(count: number, left: number, width: number): number[] {
  if (count <= 0) return []
  if (count === 1) return [left + width / 2]
  return Array.from({ length: count }, (_, index) => left + (index / (count - 1)) * width)
}

// A polyline path through the points; a null y starts a new segment so a gap is drawn as a gap.
export function linePath(points: Point[]): string {
  let path = ''
  let pen = false
  for (const point of points) {
    if (point.y === null) {
      pen = false
      continue
    }
    path += `${pen ? 'L' : 'M'}${round(point.x)} ${round(point.y)} `
    pen = true
  }
  return path.trim()
}

const round = (value: number) => Math.round(value * 100) / 100

// Evenly spaced axis values from 0 to `max` (inclusive), `count` of them at least two.
export function tickValues(max: number, count = 3): number[] {
  const steps = Math.max(count, 2) - 1
  return Array.from({ length: steps + 1 }, (_, index) => (max / steps) * index)
}

export interface Arc {
  path: string
  start: number
  end: number
}

const TAU = Math.PI * 2
// A donut slice never closes on itself (a single full circle is drawn just short of 360 degrees).
const FULL = TAU - 0.0001

function polar(cx: number, cy: number, radius: number, angle: number): [number, number] {
  return [round(cx + radius * Math.cos(angle)), round(cy + radius * Math.sin(angle))]
}

export function arcPath(cx: number, cy: number, outer: number, inner: number, start: number, end: number): string {
  const sweep = Math.min(end - start, FULL)
  const stop = start + sweep
  const large = sweep > Math.PI ? 1 : 0
  const [ox1, oy1] = polar(cx, cy, outer, start)
  const [ox2, oy2] = polar(cx, cy, outer, stop)
  const [ix2, iy2] = polar(cx, cy, inner, stop)
  const [ix1, iy1] = polar(cx, cy, inner, start)
  return `M${ox1} ${oy1} A${outer} ${outer} 0 ${large} 1 ${ox2} ${oy2} L${ix2} ${iy2} A${inner} ${inner} 0 ${large} 0 ${ix1} ${iy1} Z`
}

// One arc per value, clockwise from the top, with `gap` radians between visible slices. A zero or negative value gets no arc (null).
export function donutArcs(values: number[], cx: number, cy: number, outer: number, inner: number, gap = 0.03): (Arc | null)[] {
  const total = values.reduce((sum, value) => sum + Math.max(value, 0), 0)
  const visible = values.filter((value) => value > 0).length
  if (total <= 0) return values.map(() => null)
  const room = TAU - (visible > 1 ? gap * visible : 0)
  let angle = -Math.PI / 2
  return values.map((value) => {
    if (value <= 0) return null
    const span = (value / total) * room
    const start = angle
    const end = angle + span
    angle = end + (visible > 1 ? gap : 0)
    return { path: arcPath(cx, cy, outer, inner, start, end), start, end }
  })
}

// Bar lengths in proportion to `max` across `width` (a value above max is clamped; a negative one is zero).
export function barLengths(values: number[], max: number, width: number): number[] {
  if (!(max > 0) || width <= 0) return values.map(() => 0)
  return values.map((value) => Math.min(Math.max(value, 0) / max, 1) * width)
}

// How full a progress bar is, 0 to 1 (a target of zero or less is empty).
export function progressFraction(value: number, target: number): number {
  if (!(target > 0)) return 0
  return Math.min(Math.max(value / target, 0), 1)
}
