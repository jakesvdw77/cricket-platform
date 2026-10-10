// Zoom and fit maths for the full-screen org chart (components/OrgChartFullScreen). Scales are fractions: 1 is 100 percent.
export const ZOOM_MIN = 0.5
export const ZOOM_MAX = 2
export const ZOOM_STEP = 0.1

export interface Size {
  width: number
  height: number
}

const EPSILON = 1e-9

// Rounds away floating point noise so 0.1 steps stay on the grid (0.7, not 0.7000000000000001).
function tidy(scale: number): number {
  return Math.round(scale * 100) / 100
}

export function clampZoom(scale: number): number {
  return tidy(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, scale)))
}

// The next step up or down from any scale, including an off-grid one such as a fit scale of 0.73 (up gives 0.8, down 0.7).
export function stepZoom(current: number, direction: 'in' | 'out'): number {
  const tenths = current / ZOOM_STEP
  const next = direction === 'in' ? Math.floor(tenths + EPSILON) + 1 : Math.ceil(tenths - EPSILON) - 1
  return clampZoom(next * ZOOM_STEP)
}

// The largest scale at which the chart fits the available area in both directions, kept within [ZOOM_MIN, maxScale]
// (maxScale is 1 by default, so a small chart is never blown up). Unmeasured sizes (zero, as in jsdom) give maxScale.
export function fitScale(chart: Size, available: Size, maxScale = 1): number {
  if (chart.width <= 0 || chart.height <= 0 || available.width <= 0 || available.height <= 0) {
    return clampZoom(maxScale)
  }
  const raw = Math.min(available.width / chart.width, available.height / chart.height, maxScale)
  return Math.max(ZOOM_MIN, Math.floor(raw * 100) / 100)
}
