import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Match } from '../../api/matchApi'
import type { MatchResult, ResultPlayer, Scorecard } from '../../api/matchResultApi'
import { contrastRatio, drawResultImage, generateResultImage, loadShareLogos, readableOn, resultImageSize } from './resultImage'
import type { ResultImageOptions } from './resultImage'
import { buildShareResultModel } from './shareResultData'

// docs/specs/114-share-result.md (Test Plan): Canvas2D mocked in the manner of leagueSchedulePoster.test.ts. Every drawing
// primitive the generator calls is a spy; the assertions read the inputs to fillText, never rendered pixels.
const fillTextSpy = vi.fn()
const drawImageSpy = vi.fn()
const fillRectSpy = vi.fn()
const addColorStopSpy = vi.fn()

function makeMockContext(): CanvasRenderingContext2D {
  return {
    fillRect: fillRectSpy,
    fillText: fillTextSpy,
    drawImage: drawImageSpy,
    createLinearGradient: vi.fn(() => ({ addColorStop: addColorStopSpy })),
    measureText: (text: string) => ({ width: text.length * 12 }),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    arcTo: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    fillStyle: '',
    font: '',
    textAlign: 'left',
    textBaseline: 'alphabetic',
  } as unknown as CanvasRenderingContext2D
}

const match = {
  id: 'm1',
  homeTeamId: 't1',
  homeTeamName: 'Riverside 1',
  awayTeamId: null,
  awayTeamName: 'Pretoria CC',
  homeTeamLogoUrl: null,
  awayTeamLogoUrl: null,
  matchDate: '2026-10-17T10:00:00',
  venue: 'Main Oval',
} as unknown as Match

const result = {
  outcomeType: 'WON',
  decidedBy: 'REGULAR',
  winningSide: 'HOME',
  marginType: 'RUNS',
  marginValue: 24,
  ballsPerOver: 6,
  tossWonBy: 'HOME',
  tossDecision: 'BAT',
  playingAreaName: null,
  innings: [
    { sequence: 1, kind: 'REGULAR', battingSide: 'HOME', runs: 150, wickets: 6, balls: 240, extras: 8 },
    { sequence: 2, kind: 'REGULAR', battingSide: 'AWAY', runs: 126, wickets: 10, balls: 230, extras: 4 },
  ],
} as unknown as MatchResult

const player = (id: string, side: 'HOME' | 'AWAY', extra: Partial<ResultPlayer>): ResultPlayer => ({
  id,
  side,
  playerProfileId: null,
  displayName: null,
  plannedBattingOrder: null,
  replacedPlayerProfileId: null,
  substitute: false,
  ...extra,
})

const scorecard = {
  players: [
    player('p1', 'HOME', { playerProfileId: 'x1', firstName: 'Mpho', lastName: 'Naidoo', opposition: false }),
    player('p2', 'HOME', { playerProfileId: 'x2', firstName: 'Sam', lastName: 'van der Westhuizen', opposition: false }),
    player('o1', 'AWAY', { displayName: 'Thabo Mokoena', opposition: true }),
    player('o2', 'AWAY', { displayName: 'Pieter Botha', opposition: true }),
  ],
  batting: [
    {
      battingSide: 'HOME',
      resultPlayerId: 'p1',
      position: 1,
      howOut: 'CAUGHT',
      runs: 60,
      balls: 40,
      bowlerPlayerId: 'o1',
      fielderPlayerId: 'o2',
    },
    { battingSide: 'HOME', resultPlayerId: 'p2', position: 2, howOut: 'NOT_OUT', runs: 30, balls: 30 },
    { battingSide: 'AWAY', resultPlayerId: 'o1', position: 1, howOut: 'BOWLED', runs: 40, balls: 50, bowlerPlayerId: 'p2' },
    { battingSide: 'AWAY', resultPlayerId: 'o2', position: 2, howOut: 'NOT_OUT', runs: 22, balls: 31 },
  ],
  bowling: [
    { battingSide: 'AWAY', resultPlayerId: 'p2', bowlingOrder: 1, balls: 24, maidens: 1, runs: 20, wickets: 3 },
    { battingSide: 'HOME', resultPlayerId: 'o1', bowlingOrder: 1, balls: 24, maidens: 0, runs: 30, wickets: 1 },
  ],
  fielding: [],
  awards: [{ awardType: 'PLAYER_OF_MATCH', side: 'HOME', resultPlayerId: 'p1' }],
} as unknown as Scorecard

const model = (initialsOnly: boolean) => buildShareResultModel({ match, result, scorecard, teamsChoice: 'both', initialsOnly })

const colour = { main: '#2f6e4f', dark: '#234f39', contrastText: '#ffffff' }
const baseOptions = (overrides: Partial<ResultImageOptions>): ResultImageOptions => ({
  format: 'IMAGE',
  template: 'CLUB_GREEN',
  colour,
  logos: { clubUrl: null, leagueUrl: null, teams: true, sponsorUrls: [] },
  images: new Map(),
  clubWebsite: 'https://riverside-cc.example',
  footerLine: true,
  ...overrides,
})

function drawnText(): string[] {
  return fillTextSpy.mock.calls.map((call) => String(call[0]))
}

const ALL_VARIANTS: ResultImageOptions[] = [
  ...(['CLUB_GREEN', 'NIGHT', 'DAYLIGHT'] as const).flatMap((template) =>
    (['SQUARE', 'PORTRAIT', 'STORY'] as const).map((size) => baseOptions({ format: 'IMAGE', template, size })),
  ),
  ...(['BROADCAST', 'CLUB', 'LIGHT'] as const).map((template) => baseOptions({ format: 'TV', template, performers: 3 })),
]

beforeEach(() => {
  vi.clearAllMocks()
})

describe('resultImageSize', () => {
  it('gives the three card sizes and a fixed 16:9 for the TV summary', () => {
    expect(resultImageSize({ format: 'IMAGE', size: 'SQUARE' })).toEqual({ width: 1080, height: 1080 })
    expect(resultImageSize({ format: 'IMAGE', size: 'PORTRAIT' })).toEqual({ width: 1080, height: 1350 })
    expect(resultImageSize({ format: 'IMAGE', size: 'STORY' })).toEqual({ width: 1080, height: 1920 })
    expect(resultImageSize({ format: 'TV', size: 'STORY' })).toEqual({ width: 1920, height: 1080 })
  })
})

describe('drawResultImage', () => {
  it('draws the scores, the result line and the performers', () => {
    drawResultImage(makeMockContext(), model(false), baseOptions({ size: 'SQUARE' }))
    const text = drawnText().join('\n')

    expect(text).toContain('RIVERSIDE 1')
    expect(text).toContain('150/6')
    expect(text).toContain('RIVERSIDE 1 WON BY 24 RUNS')
    expect(text).toContain('Mpho Naidoo')
    expect(text).toContain('Player of the match')
  })

  it('never draws a full given name with First names as initials on, in any template, size or format', () => {
    for (const options of ALL_VARIANTS) {
      fillTextSpy.mockClear()
      drawResultImage(makeMockContext(), model(true), options)
      const text = drawnText().join('\n')
      for (const given of ['Mpho', 'Sam', 'Thabo', 'Pieter'])
        expect(text, `${options.format} ${options.template} ${options.size}`).not.toContain(given)
      expect(text).toContain('M. Naidoo')
    }
  })

  it('shows the full name with First names as initials off, so the check above cannot pass vacuously', () => {
    for (const options of ALL_VARIANTS) {
      fillTextSpy.mockClear()
      drawResultImage(makeMockContext(), model(false), options)
      expect(drawnText().join('\n')).toContain('Mpho Naidoo')
    }
  })

  it('removes the web address and the platform credit with the Footer line off', () => {
    for (const options of ALL_VARIANTS) {
      fillTextSpy.mockClear()
      drawResultImage(makeMockContext(), model(false), { ...options, footerLine: true })
      const withFooter = drawnText().join('\n')
      expect(withFooter).toContain('riverside-cc.example')
      expect(withFooter).toContain('Generated by Cricket Legend')

      fillTextSpy.mockClear()
      drawResultImage(makeMockContext(), model(false), { ...options, footerLine: false })
      const without = drawnText().join('\n')
      expect(without).not.toContain('riverside-cc.example')
      expect(without).not.toContain('Generated by Cricket Legend')
    }
  })

  it('never invents a web address when the club has no website', () => {
    drawResultImage(makeMockContext(), model(false), baseOptions({ clubWebsite: null }))
    const text = drawnText().join('\n')

    expect(text).toContain('Generated by Cricket Legend')
    expect(text).not.toContain('.example')
    expect(text).not.toContain('http')
  })

  it('draws a loaded logo, and gives a team with no logo an initial tile', () => {
    const clubLogo = { naturalWidth: 200, naturalHeight: 100, width: 200, height: 100 } as HTMLImageElement
    drawResultImage(
      makeMockContext(),
      model(false),
      baseOptions({
        logos: { clubUrl: 'club.png', leagueUrl: null, teams: true, sponsorUrls: [] },
        images: new Map([['club.png', clubLogo]]),
      }),
    )

    expect(drawImageSpy).toHaveBeenCalledTimes(1)
    expect(drawImageSpy.mock.calls[0][0]).toBe(clubLogo)
    // The logo keeps its 2:1 shape (never stretched).
    const [, , , width, height] = drawImageSpy.mock.calls[0]
    expect(width / height).toBeCloseTo(2)
    expect(drawnText()).toEqual(expect.arrayContaining(['R', 'P']))
  })

  it('skips a logo that failed to load without error and keeps its slot collapsed', () => {
    drawResultImage(
      makeMockContext(),
      model(false),
      baseOptions({
        logos: { clubUrl: 'club.png', leagueUrl: 'league.png', teams: false, sponsorUrls: ['s1.png'] },
        images: new Map([
          ['club.png', null],
          ['s1.png', null],
        ]),
      }),
    )

    expect(drawImageSpy).not.toHaveBeenCalled()
    expect(drawnText().join('\n')).not.toContain('Proudly sponsored by')
  })

  it('leaves out the performers, the player of the match and the venue line when their switches are off', () => {
    drawResultImage(makeMockContext(), model(false), baseOptions({ topPerformers: false, playerOfTheMatch: false, venueAndDate: false }))
    const text = drawnText().join('\n')

    expect(text).not.toContain('Naidoo')
    expect(text).not.toContain('Player of the match')
    expect(text).not.toContain('Main Oval')
  })

  it('lists the chosen number of performers per innings on the TV summary', () => {
    drawResultImage(makeMockContext(), model(false), baseOptions({ format: 'TV', template: 'BROADCAST', performers: 2 }))
    const text = drawnText().join('\n')

    expect(text).toContain('MATCH SUMMARY')
    expect(text).toContain('BATTING')
    expect(text).toContain('BOWLING')
    expect(text).toContain('Main Oval')
  })

  it('throws when a canvas has no 2D context, so the screen can show its inline error', () => {
    const canvas = { getContext: () => null } as unknown as HTMLCanvasElement
    expect(() => drawResultImage(canvas, model(false), baseOptions({}))).toThrow()
  })
})

describe('generateResultImage', () => {
  it('resolves with the PNG blob of the drawn canvas, sized to the format', async () => {
    const blob = new Blob(['x'], { type: 'image/png' })
    const canvas = {
      getContext: () => makeMockContext(),
      toBlob: (callback: (value: Blob | null) => void) => callback(blob),
      width: 0,
      height: 0,
    }
    vi.spyOn(document, 'createElement').mockReturnValueOnce(canvas as unknown as HTMLElement)

    await expect(generateResultImage(model(false), baseOptions({ size: 'PORTRAIT' }))).resolves.toBe(blob)
    expect(canvas.width).toBe(1080)
    expect(canvas.height).toBe(1350)
    vi.restoreAllMocks()
  })

  it('rejects when the canvas cannot make a blob', async () => {
    const canvas = { getContext: () => makeMockContext(), toBlob: (callback: (value: Blob | null) => void) => callback(null) }
    vi.spyOn(document, 'createElement').mockReturnValueOnce(canvas as unknown as HTMLElement)

    await expect(generateResultImage(model(false), baseOptions({}))).rejects.toThrow()
    vi.restoreAllMocks()
  })
})

describe('loadShareLogos', () => {
  it('resolves null for a logo that cannot be fetched and never rejects', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('offline'))),
    )
    const logos = await loadShareLogos(['https://example.com/a.png', 'https://example.com/a.png', ''])

    expect([...logos.entries()]).toEqual([['https://example.com/a.png', null]])
    vi.unstubAllGlobals()
  })
})

describe('colour contrast', () => {
  it('picks readable text on a light club colour and on a dark one', () => {
    expect(readableOn(['#f5d90a', '#c9ad00'], ['#ffffff', '#14231c'])).toBe('#14231c')
    expect(readableOn(['#2f6e4f', '#234f39'], ['#14231c', '#ffffff'])).toBe('#ffffff')
    expect(contrastRatio('#14231c', '#ffffff')).toBeGreaterThan(4.5)
  })
})
