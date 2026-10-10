import { describe, expect, it } from 'vitest'
import { ZOOM_MAX, ZOOM_MIN, clampZoom, fitScale, stepZoom } from './chartZoom'

describe('stepZoom', () => {
  it('moves in steps of 10 percent', () => {
    expect(stepZoom(1, 'in')).toBe(1.1)
    expect(stepZoom(1, 'out')).toBe(0.9)
    expect(stepZoom(0.7, 'in')).toBe(0.8)
  })

  it('clamps at the limits', () => {
    expect(stepZoom(ZOOM_MAX, 'in')).toBe(ZOOM_MAX)
    expect(stepZoom(ZOOM_MIN, 'out')).toBe(ZOOM_MIN)
    expect(stepZoom(0.55, 'out')).toBe(ZOOM_MIN)
  })

  it('snaps an off-grid scale to the next step', () => {
    expect(stepZoom(0.73, 'in')).toBe(0.8)
    expect(stepZoom(0.73, 'out')).toBe(0.7)
  })
})

describe('clampZoom', () => {
  it('keeps a scale within 50 to 200 percent', () => {
    expect(clampZoom(0.1)).toBe(0.5)
    expect(clampZoom(5)).toBe(2)
    expect(clampZoom(1.2)).toBe(1.2)
  })
})

describe('fitScale', () => {
  it('fits the tighter of width and height', () => {
    expect(fitScale({ width: 2000, height: 500 }, { width: 1000, height: 800 })).toBe(0.5)
    expect(fitScale({ width: 1000, height: 1000 }, { width: 1000, height: 800 })).toBe(0.8)
  })

  it('never exceeds 1 by default, but can be given a higher ceiling', () => {
    expect(fitScale({ width: 400, height: 300 }, { width: 1200, height: 900 })).toBe(1)
    expect(fitScale({ width: 400, height: 300 }, { width: 1200, height: 900 }, 2)).toBe(2)
  })

  it('never goes below 50 percent', () => {
    expect(fitScale({ width: 5000, height: 4000 }, { width: 500, height: 400 })).toBe(0.5)
  })

  it('returns the ceiling when a size is not measured', () => {
    expect(fitScale({ width: 0, height: 0 }, { width: 0, height: 0 })).toBe(1)
  })
})
