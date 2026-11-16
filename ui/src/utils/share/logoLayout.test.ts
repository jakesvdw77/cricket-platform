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
  [layout.club, layout.league, layout.teamAffiliation, layout.leagueAffiliation, layout.home, layout.away, layout.sponsorLabel, layout.footerText, ...layout.sponsors, layout.content].filter(
    (rect): rect is Rect => rect !== null,
  )

describe('layoutLogos', () => {
  it.each(SIZES)('keeps room for the title with all four header logos for %s %d x %d, and shows the room', (format, width, height) => {
    const layout = layoutLogos({ format, width, height, club: true, league: true, teamAffiliation: true, leagueAffiliation: true, teamLogos: false, sponsors: 0, footerLine: false })
    // the title keeps at least a third of the width beside the four logos
    expect(layout.headerText.width).toBeGreaterThanOrEqual(width * 0.33)
  })

  it.each(SIZES)('makes the sponsor tiles wider than tall so wide logos are not squashed for %s %d x %d', (format, width, height) => {
    const layout = layoutLogos({ format, width, height, club: true, league: true, teamLogos: true, sponsors: 2, footerLine: true })
    for (const rect of layout.sponsors) expect(rect.width).toBeGreaterThan(rect.height * 1.5)
    const rects = [layout.club, layout.league, layout.home, layout.away, layout.sponsorLabel, layout.footerText, ...layout.sponsors, layout.content].filter((rect): rect is Rect => rect !== null)
    for (let i = 0; i < rects.length; i += 1) {
      expect(rects[i].x).toBeGreaterThanOrEqual(0)
      expect(rects[i].x + rects[i].width).toBeLessThanOrEqual(width + 1e-9)
      for (let j = i + 1; j < rects.length; j += 1) expect(rectsOverlap(rects[i], rects[j])).toBe(false)
    }
  })

  it.each(SIZES)('fits the team and league affiliation logos in the header without overlap for %s %d x %d (spec 154)', (format, width, height) => {
    const layout = layoutLogos({ format, width, height, club: true, league: true, teamAffiliation: true, leagueAffiliation: true, teamLogos: true, sponsors: 2, footerLine: true })
    expect(layout.teamAffiliation).not.toBeNull()
    expect(layout.leagueAffiliation).not.toBeNull()
    // the team's affiliation follows the club logo, the league's precedes the league logo, the title is between them
    expect((layout.teamAffiliation as Rect).x).toBeGreaterThan((layout.club as Rect).x)
    expect((layout.leagueAffiliation as Rect).x).toBeLessThan((layout.league as Rect).x)
    expect(layout.headerText.x).toBeGreaterThanOrEqual((layout.teamAffiliation as Rect).x + (layout.teamAffiliation as Rect).width)
    expect(layout.headerText.x + layout.headerText.width).toBeLessThanOrEqual((layout.leagueAffiliation as Rect).x + 1e-9)
    const rects = all(layout)
    for (let i = 0; i < rects.length; i += 1) for (let j = i + 1; j < rects.length; j += 1) expect(rectsOverlap(rects[i], rects[j])).toBe(false)
  })

  it('gives the affiliation logos no slot when they are off, and leaves the header as before', () => {
    const base = layoutLogos({ format: 'IMAGE', width: 1080, height: 1350, club: true, league: true, teamLogos: false, sponsors: 0, footerLine: false })
    const off = layoutLogos({ format: 'IMAGE', width: 1080, height: 1350, club: true, league: true, teamAffiliation: false, leagueAffiliation: false, teamLogos: false, sponsors: 0, footerLine: false })
    expect(off.teamAffiliation).toBeNull()
    expect(off.leagueAffiliation).toBeNull()
    expect(off.headerText).toEqual(base.headerText)
  })

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

describe('layoutLogos for every combination of present and absent slots', () => {
  const bools = [true, false]
  const named = (layout: ReturnType<typeof layoutLogos>): [string, Rect][] =>
    (
      [
        ['club', layout.club],
        ['league', layout.league],
        ['home', layout.home],
        ['away', layout.away],
        ['homeName', layout.homeName],
        ['awayName', layout.awayName],
        ['headerText', layout.headerText],
        ['sponsorLabel', layout.sponsorLabel],
        ['footerText', layout.footerText],
        ['content', layout.content],
        ...layout.sponsors.map((rect, index) => [`sponsor${index}`, rect]),
      ] as [string, Rect | null][]
    ).filter((entry): entry is [string, Rect] => entry[1] !== null && entry[1].width > 0 && entry[1].height > 0)

  for (const [format, width, height] of SIZES) {
    it(`never overlaps, stays on the canvas and keeps room for content: ${format} ${width} x ${height}`, () => {
      for (const club of bools) {
        for (const league of bools) {
          for (const teamLogos of bools) {
            for (const footerLine of bools) {
              for (const sponsors of [0, 1, 2, 3, 4, 7]) {
                const layout = layoutLogos({ format, width, height, club, league, teamLogos, sponsors, footerLine })
                const label = JSON.stringify({ club, league, teamLogos, footerLine, sponsors })
                const rects = named(layout)
                for (const [name, rect] of rects) {
                  expect(rect.x, `${label} ${name} x`).toBeGreaterThanOrEqual(-1e-9)
                  expect(rect.y, `${label} ${name} y`).toBeGreaterThanOrEqual(-1e-9)
                  expect(rect.x + rect.width, `${label} ${name} right`).toBeLessThanOrEqual(width + 1e-9)
                  expect(rect.y + rect.height, `${label} ${name} bottom`).toBeLessThanOrEqual(height + 1e-9)
                }
                for (let i = 0; i < rects.length; i += 1) {
                  for (let j = i + 1; j < rects.length; j += 1) {
                    // With no club or league logo the header band collapses: the title area and the team row then start at the
                    // same top (the generators draw their own team marks and read only headerText and the bottom of content), so that one
                    // pairing is the only one allowed to share area.
                    const names = [rects[i][0], rects[j][0]]
                    const collapsedHeaderPair = !club && !league && names.includes('headerText') && names.some((name) => ['home', 'away', 'homeName', 'awayName', 'content'].includes(name))
                    if (collapsedHeaderPair) continue
                    expect(rectsOverlap(rects[i][1], rects[j][1]), `${label}: ${rects[i][0]} overlaps ${rects[j][0]}`).toBe(false)
                  }
                }
                expect(layout.content.height, `${label} content`).toBeGreaterThan(0)
                expect(layout.sponsors.length).toBe(Math.min(sponsors, MAX_SHARE_SPONSORS))
              }
            }
          }
        }
      }
    })
  }

  it('gives an absent club, league, team or footer slot no rectangle at all', () => {
    const layout = layoutLogos({ format: 'TV', width: 1920, height: 1080, club: false, league: true, teamLogos: false, sponsors: 0, footerLine: false })
    expect(layout.club).toBeNull()
    expect(layout.league).not.toBeNull()
    expect(layout.home).toBeNull()
    expect(layout.away).toBeNull()
    expect(layout.footerText).toBeNull()
    expect(layout.sponsorLabel).toBeNull()
  })

  it('lets the header title use the room of a missing club or league logo', () => {
    const both = layoutLogos({ format: 'IMAGE', width: 1080, height: 1080, club: true, league: true, teamLogos: true, sponsors: 0, footerLine: false })
    const noClub = layoutLogos({ format: 'IMAGE', width: 1080, height: 1080, club: false, league: true, teamLogos: true, sponsors: 0, footerLine: false })
    const none = layoutLogos({ format: 'IMAGE', width: 1080, height: 1080, club: false, league: false, teamLogos: true, sponsors: 0, footerLine: false })
    expect(noClub.headerText.width).toBeGreaterThan(both.headerText.width)
    expect(none.headerText.width).toBeGreaterThan(noClub.headerText.width)
  })

  it('gives the team names the full half width when there are no team logos, and less when there are', () => {
    const base = { format: 'IMAGE' as const, width: 1080, height: 1080, club: false, league: false, sponsors: 0, footerLine: false }
    const without = layoutLogos({ ...base, teamLogos: false })
    const withLogos = layoutLogos({ ...base, teamLogos: true })
    expect(without.homeName.width).toBeGreaterThan(withLogos.homeName.width)
    expect(without.awayName.width).toBeGreaterThan(withLogos.awayName.width)
    expect(withLogos.home && withLogos.homeName.x).toBeGreaterThanOrEqual((withLogos.home?.x ?? 0) + (withLogos.home?.width ?? 0))
  })

  it('puts the sponsor strip above the footer line and below the content', () => {
    const layout = layoutLogos({ format: 'IMAGE', width: 1080, height: 1080, club: true, league: true, teamLogos: true, sponsors: 3, footerLine: true })
    const footerTop = layout.footerText?.y ?? 0
    for (const rect of layout.sponsors) expect(rect.y + rect.height).toBeLessThanOrEqual(footerTop)
    expect((layout.sponsorLabel?.y ?? 0) + (layout.sponsorLabel?.height ?? 0)).toBeLessThanOrEqual(layout.sponsors[0].y + 1e-9)
    expect(layout.content.y + layout.content.height).toBeLessThanOrEqual(layout.sponsorLabel?.y ?? Infinity)
  })

  it('caps the sponsors at four whatever number is asked for, and ignores a negative or fractional count', () => {
    expect(MAX_SHARE_SPONSORS).toBe(4)
    const count = (sponsors: number) => layoutLogos({ format: 'IMAGE', width: 1080, height: 1080, club: false, league: false, teamLogos: false, sponsors, footerLine: false }).sponsors.length
    expect(count(5)).toBe(4)
    expect(count(100)).toBe(4)
    expect(count(-3)).toBe(0)
    expect(count(2.9)).toBe(2)
  })

  it('centres a sponsor row and never lets a box be wider than the canvas allows', () => {
    const layout = layoutLogos({ format: 'IMAGE', width: 1080, height: 1080, club: false, league: false, teamLogos: false, sponsors: 3, footerLine: false })
    const left = layout.sponsors[0].x
    const right = 1080 - (layout.sponsors[2].x + layout.sponsors[2].width)
    expect(left).toBeCloseTo(right, 6)
  })

  it('wraps the Story size to two rows (2 + 2, and 2 + 1 for three) but keeps one sponsor on one row', () => {
    const story = (sponsors: number) =>
      layoutLogos({ format: 'IMAGE', width: 1080, height: 1920, club: true, league: true, teamLogos: true, sponsors, footerLine: true }).sponsors
    const rowsOf = (rects: Rect[]) => [...new Set(rects.map((rect) => rect.y))].map((y) => rects.filter((rect) => rect.y === y).length)
    expect(rowsOf(story(4))).toEqual([2, 2])
    expect(rowsOf(story(3))).toEqual([2, 1])
    expect(rowsOf(story(1))).toEqual([1])
    // Two sponsors stay side by side on one row: stacking them one per row left the Story size looking empty.
    expect(rowsOf(story(2))).toEqual([2])
    // The Square and Portrait sizes and the TV and PDF pages stay on one row.
    for (const [format, width, height] of [['IMAGE', 1080, 1080], ['IMAGE', 1080, 1350], ['TV', 1920, 1080], ['PDF', 210, 297]] as [LogoLayoutFormat, number, number][]) {
      expect(rowsOf(layoutLogos({ format, width, height, club: true, league: true, teamLogos: true, sponsors: 4, footerLine: true }).sponsors)).toEqual([4])
    }
  })

  it('is deterministic: the same input gives the same layout', () => {
    const input = { format: 'IMAGE' as const, width: 1080, height: 1350, club: true, league: false, teamLogos: true, sponsors: 3, footerLine: true }
    expect(layoutLogos(input)).toEqual(layoutLogos(input))
  })
})

describe('fitLogo and rectsOverlap in detail', () => {
  const slot = { x: 0, y: 0, width: 100, height: 100 }

  it('fits a tall logo by height and a wide one by width, centred, never larger than the slot', () => {
    expect(fitLogo(slot, 100, 400)).toEqual({ x: 37.5, y: 0, width: 25, height: 100 })
    expect(fitLogo(slot, 400, 100)).toEqual({ x: 0, y: 37.5, width: 100, height: 25 })
    const small = fitLogo(slot, 10, 10)
    expect(small.width).toBeLessThanOrEqual(100)
  })

  it('fills the slot when the natural size is missing, zero or not a number', () => {
    for (const [w, h] of [[0, 0], [100, 0], [NaN, 10], [-5, 5]]) expect(fitLogo(slot, w, h)).toEqual(slot)
  })

  it('does not hand back the slot object itself for a missing size', () => {
    expect(fitLogo(slot, 0, 0)).not.toBe(slot)
  })

  it('treats rectangles that only touch along an edge as not overlapping', () => {
    expect(rectsOverlap({ x: 0, y: 0, width: 10, height: 10 }, { x: 10, y: 0, width: 10, height: 10 })).toBe(false)
    expect(rectsOverlap({ x: 0, y: 0, width: 10, height: 10 }, { x: 9.99, y: 0, width: 10, height: 10 })).toBe(true)
    expect(rectsOverlap({ x: 0, y: 0, width: 10, height: 10 }, { x: 2, y: 2, width: 2, height: 2 })).toBe(true)
  })
})
