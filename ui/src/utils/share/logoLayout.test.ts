import { describe, expect, it } from 'vitest'
import { fitLogo, layoutLogos, MAX_SHARE_SPONSORS, rectsOverlap } from './logoLayout'
import type { LogoLayoutFormat, Rect } from './logoLayout'

const SIZES: [LogoLayoutFormat, number, number][] = [
  ['PDF', 210, 297],
  ['IMAGE', 1080, 1080],
  ['IMAGE', 1080, 1350],
  ['IMAGE', 1080, 1920],
  ['TV', 1920, 1080],
]

const all = (layout: ReturnType<typeof layoutLogos>): Rect[] =>
  [layout.club, layout.league, layout.home, layout.away, layout.sponsorLabel, layout.footerText, ...layout.sponsors, layout.content].filter(
    (rect): rect is Rect => rect !== null,
  )

describe('layoutLogos', () => {
  it.each(SIZES)('never overlaps and stays on the canvas for %s %d x %d', (format, width, height) => {
    const layout = layoutLogos({ format, width, height, club: true, league: true, teamLogos: true, sponsors: 4, footerLine: true })
    const rects = all(layout)
    for (let i = 0; i < rects.length; i += 1) {
      expect(rects[i].x).toBeGreaterThanOrEqual(0)
      expect(rects[i].x + rects[i].width).toBeLessThanOrEqual(width + 1e-9)
      expect(rects[i].y + rects[i].height).toBeLessThanOrEqual(height + 1e-9)
      for (let j = i + 1; j < rects.length; j += 1) expect(rectsOverlap(rects[i], rects[j])).toBe(false)
    }
    expect(layout.content.height).toBeGreaterThan(0)
    expect(layout.sponsors).toHaveLength(MAX_SHARE_SPONSORS)
  })

  it('collapses absent slots and gives the room to the neighbours', () => {
    const layout = layoutLogos({ format: 'IMAGE', width: 1080, height: 1080, club: false, league: false, teamLogos: false, sponsors: 0, footerLine: false })
    expect([layout.club, layout.league, layout.home, layout.away, layout.sponsorLabel, layout.footerText]).toEqual([null, null, null, null, null, null])
    expect(layout.sponsors).toEqual([])
    expect(layout.headerText.width).toBeCloseTo(1080 - 2 * layout.margin, 6)
  })

  it('wraps the sponsor strip to two rows only on the Story size', () => {
    const rows = (height: number) =>
      new Set(layoutLogos({ format: 'IMAGE', width: 1080, height, club: true, league: true, teamLogos: true, sponsors: 4, footerLine: true }).sponsors.map((rect) => rect.y)).size
    expect(rows(1080)).toBe(1)
    expect(rows(1920)).toBe(2)
  })
})

describe('fitLogo', () => {
  it('keeps the aspect ratio inside the square slot', () => {
    const fitted = fitLogo({ x: 10, y: 10, width: 100, height: 100 }, 400, 200)
    expect(fitted).toEqual({ x: 10, y: 35, width: 100, height: 50 })
  })
})
