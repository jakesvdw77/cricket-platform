import { describe, expect, it } from 'vitest'
import type { SquadMember } from '../api/teamSquadApi'
import { BLANK_LINES, matchInfoFor, metaCells, EMPTY_MATCH_INFO, preMarks, ROWS_PER_PAGE, sheetDate, sheetPages, sheetPlayers, sheetTime, teamMatches, teamSheetFileName } from './teamSheet'

const member = (patch: Partial<SquadMember>): SquadMember =>
  ({
    playerProfileId: patch.playerProfileId ?? `${patch.firstName}-${patch.lastName}`,
    firstName: 'A',
    lastName: 'Z',
    active: true,
    isCaptain: false,
    isWicketKeeper: false,
    squadJerseyNumber: null,
    jerseyNumber: null,
    ...patch,
  }) as SquadMember

describe('sheetPlayers (spec 153)', () => {
  it('sorts by surname then first name, ignoring case and accents, with "Van der" under V', () => {
    const list = sheetPlayers([
      member({ firstName: 'Jaco', lastName: 'Van der Westhuizen' }),
      member({ firstName: 'Zane', lastName: 'botha' }),
      member({ firstName: 'Andre', lastName: 'Botha' }),
      member({ firstName: 'Eloff', lastName: 'Éloff' }),
      member({ firstName: 'Piet', lastName: 'Du Plessis' }),
    ])
    expect(list.map((p) => `${p.firstName} ${p.lastName}`)).toEqual(['Andre Botha', 'Zane botha', 'Piet Du Plessis', 'Eloff Éloff', 'Jaco Van der Westhuizen'])
  })

  it('lists every active squad player and leaves out inactive ones', () => {
    const list = sheetPlayers([member({ firstName: 'On', lastName: 'A' }), member({ firstName: 'Off', lastName: 'B', active: false })])
    expect(list.map((p) => p.firstName)).toEqual(['On'])
  })

  it('uses the squad number, then the standing number, else blank', () => {
    const list = sheetPlayers([
      member({ lastName: 'A', squadJerseyNumber: 7, jerseyNumber: 99 }),
      member({ lastName: 'B', squadJerseyNumber: null, jerseyNumber: 12 }),
      member({ lastName: 'C' }),
    ])
    expect(list.map((p) => p.shirt)).toEqual([7, 12, null])
  })
})

describe('sheetPages', () => {
  const players = (count: number) => sheetPlayers(Array.from({ length: count }, (_, i) => member({ firstName: 'P', lastName: `L${String(i).padStart(2, '0')}` })))

  it('adds no empty lines when switched off, and an empty squad is still one page', () => {
    expect(sheetPages(players(12), 0)[0]).toHaveLength(12)
    expect(sheetPages([], 0)).toEqual([[]])
  })

  it('adds two empty lines after the squad on the same page when there is room', () => {
    const pages = sheetPages(players(12))
    expect(pages).toHaveLength(1)
    expect(pages[0]).toHaveLength(12 + BLANK_LINES)
    expect(pages[0].slice(-BLANK_LINES).every((row) => row.kind === 'blank')).toBe(true)
  })

  it('flows a long squad onto a second page', () => {
    const pages = sheetPages(players(ROWS_PER_PAGE + 3))
    expect(pages).toHaveLength(2)
    expect(pages[0]).toHaveLength(ROWS_PER_PAGE)
    expect(pages[1]).toHaveLength(3 + BLANK_LINES)
  })

  it('gives an empty squad one page of empty lines', () => {
    const pages = sheetPages([])
    expect(pages).toHaveLength(1)
    expect(pages[0]).toHaveLength(BLANK_LINES)
  })
})

describe('preMarks', () => {
  const [captain, keeper] = sheetPlayers([member({ lastName: 'A', isCaptain: true }), member({ lastName: 'B', isWicketKeeper: true })])
  it('marks nothing unless pre-marking is on', () => {
    expect(preMarks({ kind: 'player', player: captain }, false)).toEqual({ captain: false, keeper: false })
  })
  it('marks the captain and the keepers when on, never an empty line', () => {
    expect(preMarks({ kind: 'player', player: captain }, true)).toEqual({ captain: true, keeper: false })
    expect(preMarks({ kind: 'player', player: keeper }, true)).toEqual({ captain: false, keeper: true })
    expect(preMarks({ kind: 'blank', key: 'b' }, true)).toEqual({ captain: false, keeper: false })
  })
})

describe('match details', () => {
  const match = { homeTeamId: 't1', homeTeamName: 'Irene Veterans', awayTeamId: null, awayTeamName: 'Midlands CC', matchDate: '2026-11-19T14:30:00', venue: ' Durbanville CC B ', active: true }

  it('prints the other side as the opposition, whichever way round the fixture is', () => {
    expect(matchInfoFor(match, 't1', 'VCASA Club Champs', 'T20')).toEqual({
      league: 'VCASA Club Champs',
      opposition: 'Midlands CC',
      date: 'Thu 19 Nov 2026',
      time: '14:30',
      venue: 'Durbanville CC B',
      overs: 'T20',
    })
    const away = { ...match, homeTeamId: null, homeTeamName: 'Frontier Vets', awayTeamId: 't1', awayTeamName: 'Irene Veterans' }
    expect(matchInfoFor(away, 't1', null, null).opposition).toBe('Frontier Vets')
    expect(matchInfoFor(away, 't1', null, null).overs).toBeNull()
  })

  it('formats the date and time', () => {
    expect(sheetDate('2026-11-20T09:30:00')).toBe('Fri 20 Nov 2026')
    expect(sheetTime('2026-11-20T09:05:00')).toBe('09:05')
  })

  it('keeps only the team\'s active matches, soonest first', () => {
    const matches = [
      { ...match, matchDate: '2026-11-20T09:30:00' },
      { ...match, matchDate: '2026-11-19T14:30:00' },
      { ...match, homeTeamId: 'other', matchDate: '2026-11-18T09:00:00' },
      { ...match, active: false, matchDate: '2026-11-17T09:00:00' },
    ]
    expect(teamMatches(matches, 't1').map((m) => m.matchDate)).toEqual(['2026-11-19T14:30:00', '2026-11-20T09:30:00'])
  })
})

describe('teamSheetFileName', () => {
  it('names the blank, match and bundle files', () => {
    expect(teamSheetFileName({ teamName: 'Irene Veterans', kind: 'blank' })).toBe('Team Sheet - Irene Veterans (blank).pdf')
    expect(teamSheetFileName({ teamName: 'Irene Veterans', kind: 'match', opposition: 'Midlands CC', isoDate: '2026-11-19T14:30:00' })).toBe('Team Sheet - Irene Veterans - Midlands CC - 2026-11-19.pdf')
    expect(teamSheetFileName({ teamName: 'Irene Veterans', kind: 'bundle', leagueName: 'VCASA: Club Champs' })).toBe('Team Sheets - VCASA Club Champs - Irene Veterans.pdf')
  })
})

describe('metaCells', () => {
  it('has the toss boxes when asked, every box one column', () => {
    const cells = metaCells(EMPTY_MATCH_INFO, true)
    expect(cells.map((cell) => cell.label)).toEqual(['League', 'Opposition', 'Date', 'Start time', 'Venue', 'Toss won by', 'Elected to', 'Overs'])
    expect(cells.every((cell) => cell.span === 1)).toBe(true)
  })

  it('drops the toss boxes and gives Venue their room, so the row still fills four columns', () => {
    const cells = metaCells(EMPTY_MATCH_INFO, false)
    expect(cells.map((cell) => cell.label)).toEqual(['League', 'Opposition', 'Date', 'Start time', 'Venue', 'Overs'])
    expect(cells.find((cell) => cell.label === 'Venue')?.span).toBe(3)
    expect(cells.reduce((sum, cell) => sum + cell.span, 0)).toBe(8)
  })
})
