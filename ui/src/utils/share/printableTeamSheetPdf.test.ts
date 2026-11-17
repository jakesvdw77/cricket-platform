import { beforeEach, describe, expect, it, vi } from 'vitest'

// docs/specs/153: jsPDF mocked in the manner of resultPdf.test.ts; the assertions read the inputs to the drawing calls.
const textSpy = vi.fn()
const addPageSpy = vi.fn()
const roundedRectSpy = vi.fn()
const rectSpy = vi.fn()

vi.mock('jspdf', () => {
  class MockJsPDF {
    setFillColor = vi.fn()
    setDrawColor = vi.fn()
    setLineWidth = vi.fn()
    setTextColor = vi.fn()
    setFont = vi.fn()
    setFontSize = vi.fn()
    rect = rectSpy
    roundedRect = roundedRectSpy
    line = vi.fn()
    text = textSpy
    addImage = vi.fn()
    addPage = addPageSpy
    setLineDashPattern = vi.fn()
    getTextWidth = () => 10
    getImageProperties = () => ({ width: 100, height: 100 })
    splitTextToSize = (value: string) => [value]
    output = vi.fn(() => new Blob(['fake-pdf']))
  }
  return { jsPDF: MockJsPDF }
})

import { generateTeamSheetPdf } from './printableTeamSheetPdf'
import type { TeamSheetSpec } from './printableTeamSheetPdf'
import { EMPTY_MATCH_INFO } from '../teamSheet'
import type { SheetPlayer } from '../teamSheet'

const player = (n: number, patch: Partial<SheetPlayer> = {}): SheetPlayer => ({ key: `p${n}`, firstName: `First${n}`, lastName: `Last${n}`, shirt: n, isCaptain: false, isKeeper: false, ...patch })
const spec = (players: SheetPlayer[], patch: Partial<TeamSheetSpec> = {}): TeamSheetSpec => ({
  teamName: 'Irene Veterans',
  subtitle: 'Over 40  |  2026/2027',
  teamLogoUrl: null,
  leagueLogoUrl: null,
  match: EMPTY_MATCH_INFO,
  players,
  ...patch,
})
const printed = (): string[] => textSpy.mock.calls.map((call) => String(call[0]))
const filledBoxes = () => rectSpy.mock.calls.filter((call) => call[4] === 'FD').length

describe('generateTeamSheetPdf (spec 153)', () => {
  beforeEach(() => {
    textSpy.mockClear()
    addPageSpy.mockClear()
    rectSpy.mockClear()
  })

  it('returns a PDF file with the given name', async () => {
    const file = await generateTeamSheetPdf([spec([player(1)])], { preMark: false, fileName: 'Team Sheet - Irene Veterans (blank).pdf' })
    expect(file.name).toBe('Team Sheet - Irene Veterans (blank).pdf')
    expect(file.type).toBe('application/pdf')
  })

  it('prints the team, every player in full and the signature lines', async () => {
    await generateTeamSheetPdf([spec([player(1), player(2)])], { preMark: false, fileName: 'x.pdf' })
    const text = printed()
    expect(text).toContain('IRENE VETERANS')
    expect(text).toEqual(expect.arrayContaining(['First1', 'Last1', 'First2', 'Last2', '1', '2', "Captain's signature", "Umpire's signature"]))
  })

  it('fills the match boxes for a match sheet', async () => {
    await generateTeamSheetPdf([spec([player(1)], { match: { league: 'VCASA Club Champs', opposition: 'Midlands CC', date: 'Thu 19 Nov 2026', time: '14:30', venue: 'Durbanville CC B', overs: 'T20' } })], { preMark: false, fileName: 'x.pdf' })
    expect(printed()).toEqual(expect.arrayContaining(['Midlands CC', 'Thu 19 Nov 2026', '14:30', 'Durbanville CC B', 'T20', 'VCASA Club Champs']))
  })

  it('prints the toss labels only when the toss boxes are on', async () => {
    await generateTeamSheetPdf([spec([player(1)])], { preMark: false, fileName: 'x.pdf' })
    expect(printed().map((text) => text.toUpperCase())).not.toContain('TOSS WON BY')
    await generateTeamSheetPdf([spec([player(1)])], { preMark: false, tossBoxes: true, fileName: 'x.pdf' })
    expect(printed().map((text) => text.toUpperCase())).toEqual(expect.arrayContaining(['TOSS WON BY', 'ELECTED TO']))
  })

  it('drops the Capt and Keeper columns and writes Captain and Wicketkeeper in boxes when the ticks are off', async () => {
    await generateTeamSheetPdf([spec([player(1)])], { preMark: false, fileName: 'x.pdf' })
    expect(printed()).toContain('CAPT')
    textSpy.mockClear()
    await generateTeamSheetPdf([spec([player(1)])], { preMark: false, leaderTicks: false, fileName: 'x.pdf' })
    expect(printed()).not.toContain('CAPT')
    expect(printed().map((text) => text.toUpperCase())).toEqual(expect.arrayContaining(['CAPTAIN', 'WICKETKEEPER']))
  })

  it('draws no filled box unless pre-marking is on', async () => {
    const players = [player(1, { isCaptain: true }), player(2, { isKeeper: true })]
    await generateTeamSheetPdf([spec(players)], { preMark: false, fileName: 'x.pdf' })
    expect(filledBoxes()).toBe(0)
    rectSpy.mockClear()
    await generateTeamSheetPdf([spec(players)], { preMark: true, fileName: 'x.pdf' })
    expect(filledBoxes()).toBe(2)
  })

  it('makes a page for every sheet and a second page for a long squad', async () => {
    await generateTeamSheetPdf([spec([player(1)]), spec([player(1)]), spec(Array.from({ length: 23 }, (_, i) => player(i)))], { preMark: false, fileName: 'x.pdf' })
    // 1 + 1 + 2 pages = 4 pages, so 3 page breaks.
    expect(addPageSpy).toHaveBeenCalledTimes(3)
  })

  describe('Poster style (spec 153 addendum)', () => {
    const poster = { leagueTitle: 'VCASA Club Champs 2026', dateRange: '19-21 NOV 2026', affiliationName: 'Titans Veterans Cricket', affiliationLogoUrl: null, leagueAffiliationName: 'VCASA', leagueAffiliationLogoUrl: null, hostName: 'Boland Veterans', hostLogoUrl: null, sponsorLogoUrls: [] }
    const matchInfo = { ...EMPTY_MATCH_INFO, league: 'VCASA Club Champs', opposition: 'Midlands CC', date: 'Thu 19 Nov 2026', time: '14:30', venue: 'Durbanville CC B' }

    it('prints the league title, tournament dates, affiliation, host, date line and the names with the surname in capitals', async () => {
      await generateTeamSheetPdf([spec([player(1, { firstName: 'Andre', lastName: 'Botha' })], { match: matchInfo, poster })], { preMark: false, style: 'poster', fileName: 'x.pdf' })
      expect(printed()).toEqual(expect.arrayContaining(['VCASA CLUB CHAMPS 2026', '19-21 NOV 2026', 'Titans Veterans Cricket', 'VCASA', 'BOLAND VETERANS', 'MIDLANDS CC', 'DATE: Thu 19 Nov 2026 - 14H30', 'Andre', 'BOTHA', 'TEAM SHEET']))
    })

    // Owner, 2026-11-17: the league's affiliation (VCASA) is top left and the team's affiliation top right; the tournament badge is the hero.
    it('puts the league affiliation top left and the team affiliation in the footer, as its first tile', async () => {
      await generateTeamSheetPdf([spec([player(1)], { match: matchInfo, poster })], { preMark: false, style: 'poster', fileName: 'x.pdf' })
      const at = (label: string) => textSpy.mock.calls.find((call) => String(call[0]).includes(label))
      const league = at('VCASA')
      const team = at('Titans')
      expect(league?.[1]).toBe(16)
      // Centred on the first footer tile (16 + 30 / 2), low on the page.
      expect(team?.[1]).toBe(31)
      expect(team?.[2]).toBeGreaterThan(252)
      expect(team?.[3]).toMatchObject({ align: 'center' })
    })

    it('leaves the footer to four sponsors when there is no team affiliation', async () => {
      const sponsorLogoUrls = ['a', 'b', 'c', 'd', 'e'].map((n) => `/media/${n}.png`)
      roundedRectSpy.mockClear()
      await generateTeamSheetPdf([spec([player(1)], { match: matchInfo, poster: { ...poster, affiliationName: null, affiliationLogoUrl: null, sponsorLogoUrls } })], { preMark: false, style: 'poster', fileName: 'x.pdf' })
      const noAffiliation = roundedRectSpy.mock.calls.length
      roundedRectSpy.mockClear()
      await generateTeamSheetPdf([spec([player(1)], { match: matchInfo, poster: { ...poster, sponsorLogoUrls } })], { preMark: false, style: 'poster', fileName: 'x.pdf' })
      // Four sponsor tiles alone, against one affiliation tile and three sponsor tiles: the same number of tiles, so the footer never grows.
      expect(roundedRectSpy.mock.calls.length).toBe(noAffiliation)
    })

    it('has no Capt column and no S/N, only W/K, and adds Bat Pos, Bowl and Comment when asked', async () => {
      await generateTeamSheetPdf([spec([player(1)], { match: matchInfo, poster })], { preMark: false, style: 'poster', fileName: 'x.pdf' })
      expect(printed()).toEqual(expect.arrayContaining(['W/K', 'PLAYING', 'PLAYER', 'SHIRT']))
      expect(printed()).not.toContain('CAPT')
      expect(printed()).not.toContain('S/N')
      expect(printed()).not.toContain('BAT POS')
      textSpy.mockClear()
      await generateTeamSheetPdf([spec([player(1)], { match: matchInfo, poster })], { preMark: false, style: 'poster', batBowl: true, comment: true, fileName: 'x.pdf' })
      expect(printed()).toEqual(expect.arrayContaining(['PLAYERS', 'BAT POS', 'BOWL', 'COMMENT']))
    })

    it('pre-marks the captain line and the W/K column only when asked', async () => {
      const players = [player(1, { firstName: 'Hannes', lastName: 'Kruger', isCaptain: true }), player(2, { isKeeper: true })]
      await generateTeamSheetPdf([spec(players, { match: matchInfo, poster })], { preMark: false, style: 'poster', fileName: 'x.pdf' })
      expect(printed()).not.toContain('Hannes Kruger')
      expect(printed().filter((text) => text === 'W/K')).toHaveLength(1)
      textSpy.mockClear()
      await generateTeamSheetPdf([spec(players, { match: matchInfo, poster })], { preMark: true, style: 'poster', fileName: 'x.pdf' })
      expect(printed()).toContain('Hannes Kruger')
      expect(printed().filter((text) => text === 'W/K')).toHaveLength(2)
    })

    it('leaves the opposition, date, time and venue as write-on lines for a blank match', async () => {
      await generateTeamSheetPdf([spec([player(1)], { poster: { ...poster, hostName: null } })], { preMark: false, style: 'poster', fileName: 'x.pdf' })
      expect(printed()).toEqual(expect.arrayContaining(['DATE:', 'TIME:', 'VENUE:']))
      expect(printed().some((text) => text.startsWith('DATE: '))).toBe(false)
      expect(printed()).not.toContain('HOST:')
    })

    describe('Selected Side', () => {
      const sidePlayersList = [player(1, { firstName: 'Hannes', lastName: 'Kruger', isCaptain: true }), player(2, { firstName: 'Pieter', lastName: 'Du Plessis', isKeeper: true }), player(3, { twelfth: true })]

      it('has no Playing column or empty lines, shows C, W/K and 12th always, fills the captain and reads PLAYING XII', async () => {
        await generateTeamSheetPdf([spec(sidePlayersList, { match: matchInfo, poster, selectedSide: true })], { preMark: false, style: 'poster', fileName: 'x.pdf' })
        const out = printed()
        expect(out).toEqual(expect.arrayContaining(['C / W/K', 'C', 'W/K', '12th', 'Hannes Kruger', 'PLAYING XII', 'KRUGER']))
        expect(out).not.toContain('PLAYING')
        expect(out).not.toContain('TEAM SHEET')
      })

      it('reads PLAYING XI without a twelfth man', async () => {
        await generateTeamSheetPdf([spec(sidePlayersList.slice(0, 2), { match: matchInfo, poster, selectedSide: true })], { preMark: false, style: 'poster', fileName: 'x.pdf' })
        expect(printed()).toContain('PLAYING XI')
      })
    })
  })
})
