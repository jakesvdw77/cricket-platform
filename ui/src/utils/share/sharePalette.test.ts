import { describe, expect, it, vi } from 'vitest'
import { contrastRatio, drawResultImage, readableOn } from './resultImage'
import type { ResultImageColour, ResultImageOptions } from './resultImage'
import { privacyModel } from './sharePrivacyFixture'
import { sponsorStubImage } from './sharePaletteTestImage'

// docs/specs/114-share-result.md (Mobile-first and accessibility notes): the Daylight and Light templates meet the WCAG 4.5:1
// contrast against their text, and text stays readable on a LIGHT club colour. Checked on what is really drawn: a recording
// Canvas2D captures the background stops and the colour each fillText is drawn in, so the palette cannot drift unnoticed.

const WCAG_AA = 4.5

interface Recorded {
  stops: string[]
  texts: { text: string; colour: string }[]
  rects: { colour: string; x: number; y: number; width: number; height: number }[]
}

function record(options: ResultImageOptions): Recorded {
  const recorded: Recorded = { stops: [], texts: [], rects: [] }
  let fillStyle: unknown = ''
  const ctx = {
    fillRect: (x: number, y: number, width: number, height: number) => recorded.rects.push({ colour: String(fillStyle), x, y, width, height }),
    fillText: (text: string) => recorded.texts.push({ text: String(text), colour: String(fillStyle) }),
    drawImage: vi.fn(),
    createLinearGradient: () => ({ addColorStop: (_at: number, colour: string) => recorded.stops.push(colour) }),
    measureText: (text: string) => ({ width: text.length * 6 }),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    arcTo: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    font: '',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    set fillStyle(value: unknown) {
      fillStyle = value
    },
    get fillStyle() {
      return fillStyle
    },
  } as unknown as CanvasRenderingContext2D
  drawResultImage(ctx, privacyModel(false), options)
  return recorded
}

const GREEN: ResultImageColour = { main: '#2f6e4f', dark: '#234f39', contrastText: '#ffffff' }
// A light club colour whose own "contrast text" is white (the worst case: the theme says white, white is unreadable).
const YELLOW: ResultImageColour = { main: '#f5d90a', dark: '#c9ad00', contrastText: '#ffffff' }
const PALE: ResultImageColour = { main: '#bfe3cf', dark: '#8fcaa8', contrastText: '#ffffff' }

const base = (patch: Partial<ResultImageOptions>): ResultImageOptions => ({
  format: 'IMAGE',
  template: 'DAYLIGHT',
  size: 'SQUARE',
  colour: GREEN,
  topPerformers: true,
  playerOfTheMatch: true,
  venueAndDate: true,
  batters: true,
  bowlers: true,
  performers: 3,
  logos: { clubUrl: null, leagueUrl: null, teams: true, sponsorUrls: ['s1.png'] },
  images: new Map([['s1.png', sponsorStubImage()]]),
  clubWebsite: 'https://riverside-cc.example',
  footerLine: true,
  ...patch,
})

// "#rrggbb" or "rgba(r, g, b, a)" as [r, g, b, a].
function parse(colour: string): [number, number, number, number] {
  const hex = /^#([0-9a-f]{6})$/i.exec(colour)
  if (hex) {
    const value = parseInt(hex[1], 16)
    return [(value >> 16) & 255, (value >> 8) & 255, value & 255, 1]
  }
  const rgba = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)$/.exec(colour)
  if (!rgba) throw new Error(`Cannot read the colour ${colour}`)
  return [Number(rgba[1]), Number(rgba[2]), Number(rgba[3]), rgba[4] === undefined ? 1 : Number(rgba[4])]
}
const toHex = (channels: number[]): string => `#${channels.slice(0, 3).map((value) => Math.round(value).toString(16).padStart(2, '0')).join('')}`
// A (possibly translucent) text colour as it looks on an opaque background.
function over(text: string, background: string): string {
  const [r, g, b, a] = parse(text)
  const [br, bg, bb] = parse(background)
  return toHex([r * a + br * (1 - a), g * a + bg * (1 - a), b * a + bb * (1 - a)])
}
const INK_FAMILY = (colour: string): boolean => {
  const [r, g, b] = parse(colour)
  return r === 20 && g === 35 && b === 28
}

describe('contrast helpers', () => {
  it('computes the WCAG ratio: 21 for black on white, 1 for the same colour, symmetric', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5)
    expect(contrastRatio('#336699', '#336699')).toBeCloseTo(1, 5)
    expect(contrastRatio('#14231c', '#f4f7f5')).toBeCloseTo(contrastRatio('#f4f7f5', '#14231c'), 8)
  })

  it('picks the candidate that reads best on EVERY background, so light colours get dark text and dark colours light text', () => {
    expect(readableOn([YELLOW.main, YELLOW.dark], [YELLOW.contrastText, '#ffffff', '#14231c'])).toBe('#14231c')
    expect(readableOn([PALE.main, PALE.dark], [PALE.contrastText, '#ffffff', '#14231c'])).toBe('#14231c')
    expect(readableOn([GREEN.main, GREEN.dark], [GREEN.contrastText, '#ffffff', '#14231c'])).toBe('#ffffff')
    // A mixed pair is judged by the worse background.
    expect(readableOn(['#ffffff', '#000000'], ['#ffffff', '#000000'])).toBe('#ffffff')
  })

  it('treats an unreadable colour as no contrast rather than throwing', () => {
    expect(contrastRatio('not-a-colour', '#ffffff')).toBe(1)
  })

  it('keeps the chosen text above 4.5:1 on a light club colour and on a dark one', () => {
    for (const colour of [GREEN, YELLOW, PALE]) {
      const text = readableOn([colour.main, colour.dark], [colour.contrastText, '#ffffff', '#14231c'])
      expect(contrastRatio(text, colour.main)).toBeGreaterThanOrEqual(WCAG_AA)
      expect(contrastRatio(text, colour.dark)).toBeGreaterThanOrEqual(WCAG_AA)
    }
  })
})

describe('Daylight (Image) palette', () => {
  for (const colour of [GREEN, YELLOW, PALE]) {
    it(`text and muted text are 4.5:1 on both background stops, and chip text on the club colour (${colour.main})`, () => {
      const recorded = record(base({ template: 'DAYLIGHT', colour }))
      const [from, to] = recorded.stops
      expect(recorded.texts.length).toBeGreaterThan(10)
      for (const { text, colour: ink } of recorded.texts) {
        if (INK_FAMILY(ink)) {
          for (const background of [from, to]) {
            expect(contrastRatio(over(ink, background), background), `"${text}" ${ink} on ${background}`).toBeGreaterThanOrEqual(WCAG_AA)
          }
        } else {
          // Anything else is drawn on the club colour (the result chip and the avatar tiles).
          expect(contrastRatio(ink, colour.main), `"${text}" ${ink} on the club colour`).toBeGreaterThanOrEqual(WCAG_AA)
        }
      }
    })
  }

  it('uses a light background, so its dark ink is what is drawn', () => {
    const recorded = record(base({ template: 'DAYLIGHT' }))
    expect(contrastRatio(recorded.stops[0], '#ffffff')).toBeLessThan(1.2)
    expect(recorded.texts.some((item) => INK_FAMILY(item.colour))).toBe(true)
  })
})

describe('Light (TV) palette', () => {
  for (const colour of [GREEN, YELLOW, PALE]) {
    it(`text, muted text, the header bar and the sponsor strip are 4.5:1 (${colour.main})`, () => {
      const recorded = record(base({ format: 'TV', template: 'LIGHT', colour, size: undefined }))
      const [from] = recorded.stops
      // The sponsor strip is the full-width rectangle that is not the header bar or the result chip.
      const strip = recorded.rects.find((rect) => rect.width === 1920 && rect.height > 0 && rect.height < 300 && rect.y > 700 && !INK_FAMILY(rect.colour) && rect.colour !== colour.main)
      for (const { text, colour: ink } of recorded.texts) {
        if (INK_FAMILY(ink)) {
          const backgrounds = [from, ...(strip ? [strip.colour] : [])]
          const worst = Math.min(...backgrounds.map((background) => contrastRatio(over(ink, background), background)))
          expect(worst, `"${text}" ${ink}`).toBeGreaterThanOrEqual(WCAG_AA)
        } else {
          expect(contrastRatio(ink, colour.main), `"${text}" ${ink} on the club colour`).toBeGreaterThanOrEqual(WCAG_AA)
        }
      }
      expect(strip, 'the sponsor strip was drawn').toBeDefined()
    })
  }
})

describe('club colour templates on a light club colour', () => {
  const cases: [string, Partial<ResultImageOptions>][] = [
    ['Image Club green', { format: 'IMAGE', template: 'CLUB_GREEN' }],
    ['TV Club colour', { format: 'TV', template: 'CLUB', size: undefined }],
  ]
  for (const [label, patch] of cases) {
    for (const colour of [GREEN, YELLOW, PALE]) {
      it(`${label}: the main text reads 4.5:1 on both ends of the gradient (${colour.main})`, () => {
        const recorded = record(base({ ...patch, colour, logos: { clubUrl: null, leagueUrl: null, teams: true, sponsorUrls: [] } }))
        const [from, to] = recorded.stops
        const heading = recorded.texts.find((item) => /FULL TIME|MATCH SUMMARY/.test(item.text))
        expect(heading, 'heading drawn').toBeDefined()
        for (const background of [from, to]) {
          expect(contrastRatio(over((heading as { colour: string }).colour, background), background)).toBeGreaterThanOrEqual(WCAG_AA)
        }
      })
    }
  }

  it('draws dark ink on a light club colour and white on a dark one', () => {
    const light = record(base({ template: 'CLUB_GREEN', colour: YELLOW, logos: { clubUrl: null, leagueUrl: null, teams: true, sponsorUrls: [] } }))
    const dark = record(base({ template: 'CLUB_GREEN', colour: GREEN, logos: { clubUrl: null, leagueUrl: null, teams: true, sponsorUrls: [] } }))
    expect(light.texts.find((item) => item.text === 'FULL TIME')?.colour).toBe('#14231c')
    expect(dark.texts.find((item) => item.text === 'FULL TIME')?.colour).toBe('#ffffff')
  })
})
