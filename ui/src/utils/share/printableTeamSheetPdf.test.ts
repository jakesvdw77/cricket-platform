import { beforeEach, describe, expect, it, vi } from 'vitest'

// docs/specs/153: jsPDF mocked in the manner of resultPdf.test.ts; the assertions read the inputs to the drawing calls.
const textSpy = vi.fn()
const addPageSpy = vi.fn()
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
    roundedRect = vi.fn()
    line = vi.fn()
    text = textSpy
    addImage = vi.fn()
    addPage = addPageSpy
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
})
