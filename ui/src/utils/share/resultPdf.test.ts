import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Match } from '../../api/matchApi'
import type { MatchResult, ResultPlayer, Scorecard } from '../../api/matchResultApi'

// docs/specs/114-share-result.md (Test Plan): jsPDF mocked in the manner of teamSheetPdf.test.ts. The assertions read the
// inputs to the drawing calls (text, addImage, setProperties), never the PDF bytes.
const textSpy = vi.fn()
const addImageSpy = vi.fn()
const addPageSpy = vi.fn()
const propertiesSpy = vi.fn()

vi.mock('jspdf', () => {
  class MockJsPDF {
    setFillColor = vi.fn()
    setDrawColor = vi.fn()
    setLineWidth = vi.fn()
    setTextColor = vi.fn()
    setFont = vi.fn()
    setFontSize = vi.fn()
    setProperties = propertiesSpy
    rect = vi.fn()
    roundedRect = vi.fn()
    line = vi.fn()
    text = textSpy
    addImage = addImageSpy
    addPage = addPageSpy
    getTextWidth = (value: string) => value.length * 1.6
    output = vi.fn(() => new Blob(['fake-pdf']))
  }
  return { jsPDF: MockJsPDF }
})

import { generateResultPdf } from './resultPdf'
import type { ResultPdfOptions } from './resultPdf'
import { buildShareResultModel } from './shareResultData'
import type { TeamsChoice } from './shareResultData'
import { shareFileName } from './shareFileName'

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

// Distinctive given names, including an accented one and a particle surname.
const GIVEN_NAMES = ['Mpho', 'Sibusiso', 'Thabo', 'Pieter']

function makeScorecard(extraBatters = 0): Scorecard {
  const filler = Array.from({ length: extraBatters }, (_, index) =>
    player(`f${index}`, 'HOME', { playerProfileId: `fx${index}`, firstName: 'Zanele', lastName: `Filler${index}`, opposition: false }),
  )
  return {
    players: [
      player('p1', 'HOME', { playerProfileId: 'x1', firstName: 'Mpho', lastName: 'Naidoo', opposition: false }),
      player('p2', 'HOME', { playerProfileId: 'x2', firstName: 'Sibusiso', lastName: 'van der Westhuizen', opposition: false }),
      player('o1', 'AWAY', { displayName: 'Thabo Mokoena', opposition: true }),
      player('o2', 'AWAY', { displayName: 'Pieter Botha', opposition: true }),
      ...filler,
    ],
    batting: [
      { battingSide: 'HOME', resultPlayerId: 'p1', position: 1, howOut: 'CAUGHT', runs: 60, balls: 40, bowlerPlayerId: 'o1', fielderPlayerId: 'o2' },
      { battingSide: 'HOME', resultPlayerId: 'p2', position: 2, howOut: 'NOT_OUT', runs: 30, balls: 30 },
      ...filler.map((item, index) => ({ battingSide: 'HOME', resultPlayerId: item.id, position: 3 + index, howOut: 'BOWLED', runs: 1, balls: 2, bowlerPlayerId: 'o1' })),
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
}

const model = (initialsOnly: boolean, teamsChoice: TeamsChoice = 'both', extraBatters = 0) =>
  buildShareResultModel({ match, result, scorecard: makeScorecard(extraBatters), teamsChoice, initialsOnly, clubName: 'Riverside CC', leagueName: 'Premier League' })

const options = (overrides: Partial<ResultPdfOptions> = {}): ResultPdfOptions => ({
  template: 'CLUB',
  colour: { main: '#2f6e4f', dark: '#234f39', contrastText: '#ffffff' },
  include: { batting: true, bowling: true, extras: true, toss: true, playerOfTheMatch: true },
  logos: { clubUrl: null, leagueUrl: null, teams: true, sponsorUrls: [] },
  clubWebsite: 'https://riverside-cc.example/',
  footerLine: true,
  ...overrides,
})

const drawnText = (): string[] => textSpy.mock.calls.map((call) => String(call[0]))
const allText = (): string => drawnText().join('\n').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const TEMPLATES = ['CLUB', 'CLASSIC', 'COMPACT'] as const

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:pdf'), revokeObjectURL: vi.fn() }))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('generateResultPdf privacy', () => {
  for (const template of TEMPLATES) {
    for (const teams of ['both', 'ours'] as const) {
      it(`with Initials only on, no full given name is drawn or stored (${template}, ${teams})`, async () => {
        const built = model(true, teams)
        const output = await generateResultPdf(built, options({ template }))

        const text = allText()
        for (const given of GIVEN_NAMES) expect(text).not.toContain(given.toLowerCase())
        const metadata = JSON.stringify(propertiesSpy.mock.calls).toLowerCase()
        for (const given of GIVEN_NAMES) expect(metadata).not.toContain(given.toLowerCase())
        expect(metadata).not.toContain('naidoo')
        expect(shareFileName(built, 'pdf')).toBe('Riverside 1 v Pretoria CC 2026-10-17.pdf')
        expect(output.pageCount).toBeGreaterThan(0)
        expect(drawnText().some((value) => value.includes('M. N.'))).toBe(true)
      })

      it(`with Initials only off the surname form is drawn, so the privacy check is not vacuous (${template}, ${teams})`, async () => {
        await generateResultPdf(model(false, teams), options({ template }))

        expect(allText()).toContain('naidoo')
        expect(drawnText().some((value) => value.includes('M. N.'))).toBe(false)
      })
    }
  }

  it('titles the document with the team names only', async () => {
    await generateResultPdf(model(true), options())

    expect(propertiesSpy).toHaveBeenCalledWith(expect.objectContaining({ title: 'Riverside 1 v Pretoria CC' }))
  })
})

describe('generateResultPdf footer', () => {
  it('shows the web address and the platform credit with the Footer line on', async () => {
    await generateResultPdf(model(false), options({ footerLine: true }))

    expect(drawnText()).toContain('Page 1 of 1 · riverside-cc.example · Generated by Cricket Legend')
  })

  it('removes the web address and the platform credit with the Footer line off but keeps the page number on a multi-page PDF', async () => {
    const output = await generateResultPdf(model(false, 'both', 40), options({ footerLine: false }))

    expect(output.pageCount).toBeGreaterThan(1)
    expect(addPageSpy).toHaveBeenCalledTimes(output.pageCount - 1)
    expect(allText()).not.toContain('riverside-cc.example')
    expect(allText()).not.toContain('generated by cricket legend')
    expect(drawnText()).toContain('Page 1 of ' + output.pageCount)
    expect(drawnText()).toContain(`Page ${output.pageCount} of ${output.pageCount}`)
  })

  it('never shows a web address when the club has no website', async () => {
    await generateResultPdf(model(false), options({ clubWebsite: null }))

    expect(drawnText()).toContain('Page 1 of 1 · Generated by Cricket Legend')
  })
})

describe('generateResultPdf content and logos', () => {
  it('drops a section when its switch is off', async () => {
    await generateResultPdf(model(false), options({ include: { batting: false, bowling: false, extras: false, toss: false, playerOfTheMatch: false } }))

    const text = allText()
    expect(text).not.toContain('player of the match')
    expect(text).not.toContain('won the toss')
    expect(text).not.toContain('extras')
    expect(text).not.toContain('bowling:')
  })

  it('does not throw when a logo cannot be loaded, and still produces the document', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))

    const output = await generateResultPdf(
      model(false),
      options({ logos: { clubUrl: 'https://x/club.png', leagueUrl: 'https://x/league.png', teams: true, sponsorUrls: ['https://x/s.png'] } }),
    )

    expect(addImageSpy).not.toHaveBeenCalled()
    expect(output.blob).toBeInstanceOf(Blob)
    expect(allText()).not.toContain('proudly sponsored by')
  })
})
