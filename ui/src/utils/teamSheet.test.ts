import { describe, expect, it } from 'vitest'
import type { SquadMember } from '../api/teamSquadApi'
import { BLANK_LINES, surnameDisplay, surnameParts, sidePlayers, hourStyle, tournamentRange, EMPTY_MATCH_INFO, leaderNames, matchInfoFor, metaCells, preMarks, POSTER_ROWS_PER_PAGE, ROWS_PER_PAGE, sheetDate, sheetPages, sheetPlayers, sheetTime, teamMatches, teamSheetFileName } from './teamSheet'

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

  it('sorts by first name when asked, with the surname breaking ties', () => {
    const list = sheetPlayers(
      [member({ firstName: 'Sam', lastName: 'Zulu' }), member({ firstName: 'Andre', lastName: 'Botha' }), member({ firstName: 'Sam', lastName: 'Adams' }), member({ firstName: 'Piet', lastName: 'Du Plessis' })],
      'firstName',
    )
    expect(list.map((p) => `${p.firstName} ${p.lastName}`)).toEqual(['Andre Botha', 'Piet Du Plessis', 'Sam Adams', 'Sam Zulu'])
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

  it('cuts a poster into shorter pages with its own rows per page', () => {
    const pages = sheetPages(players(POSTER_ROWS_PER_PAGE + 2), 0, POSTER_ROWS_PER_PAGE)
    expect(pages).toHaveLength(2)
    expect(pages[0]).toHaveLength(POSTER_ROWS_PER_PAGE)
    expect(POSTER_ROWS_PER_PAGE).toBeLessThan(ROWS_PER_PAGE)
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
  const match = { homeTeamId: 't1', homeTeamName: 'Irene Veterans', awayTeamId: null, awayTeamName: 'Midlands CC', matchDate: '2026-11-19T14:30:00', venue: ' Durbanville CC B ', active: true, homeTeamLogoUrl: null, awayTeamLogoUrl: '/media/midlands.png' }

  it('prints the other side as the opposition, whichever way round the fixture is', () => {
    expect(matchInfoFor(match, 't1', 'VCASA Club Champs', 'T20')).toEqual({
      league: 'VCASA Club Champs',
      opposition: 'Midlands CC',
      date: 'Thu 19 Nov 2026',
      time: '14:30',
      venue: 'Durbanville CC B',
      overs: 'T20',
      oppositionLogoUrl: '/media/midlands.png',
      stage: null,
    })
    const away = { ...match, homeTeamId: null, homeTeamName: 'Frontier Vets', awayTeamId: 't1', awayTeamName: 'Irene Veterans' }
    expect(matchInfoFor(away, 't1', null, null).opposition).toBe('Frontier Vets')
    expect(matchInfoFor(away, 't1', null, null).overs).toBeNull()
    expect(matchInfoFor(away, 't1', null, null).oppositionLogoUrl).toBeNull()
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
    expect(teamSheetFileName({ teamName: 'Irene Veterans', kind: 'cover', leagueName: 'VCASA Club Champs 2026' })).toBe('Tournament Cover - VCASA Club Champs 2026 - Irene Veterans.pdf')
    expect(teamSheetFileName({ teamName: 'Irene Veterans', kind: 'cover' })).toBe('Tournament Cover - Irene Veterans.pdf')
  })
})

describe('metaCells', () => {
  const labels = (cells: { label: string }[]) => cells.map((cell) => cell.label)
  const total = (cells: { span: number }[]) => cells.reduce((sum, cell) => sum + cell.span, 0)

  it('is League, Opposition, Date, Start time, then Venue three wide and Overs when nothing optional is on', () => {
    const cells = metaCells(EMPTY_MATCH_INFO, { tossBoxes: false, leaderFields: false })
    expect(labels(cells)).toEqual(['League', 'Opposition', 'Date', 'Start time', 'Venue', 'Overs'])
    expect(cells.find((cell) => cell.label === 'Venue')?.span).toBe(3)
    expect(total(cells)).toBe(8)
  })

  it('adds the toss boxes in row two, every box one column', () => {
    const cells = metaCells(EMPTY_MATCH_INFO, { tossBoxes: true, leaderFields: false })
    expect(labels(cells)).toEqual(['League', 'Opposition', 'Date', 'Start time', 'Venue', 'Toss won by', 'Elected to', 'Overs'])
    expect(total(cells)).toBe(8)
  })

  it('puts Captain and Wicketkeeper in row two when the toss boxes are off, with the names filled', () => {
    const cells = metaCells(EMPTY_MATCH_INFO, { tossBoxes: false, leaderFields: true, captain: 'Hannes Kruger', keeper: 'Pieter Du Plessis' })
    expect(labels(cells)).toEqual(['League', 'Opposition', 'Date', 'Start time', 'Venue', 'Captain', 'Wicketkeeper', 'Overs'])
    expect(cells.find((cell) => cell.label === 'Captain')?.value).toBe('Hannes Kruger')
    expect(total(cells)).toBe(8)
  })

  it('gives Captain and Wicketkeeper a third row when the toss boxes are on too', () => {
    const cells = metaCells(EMPTY_MATCH_INFO, { tossBoxes: true, leaderFields: true })
    expect(labels(cells).slice(-2)).toEqual(['Captain', 'Wicketkeeper'])
    expect(total(cells)).toBe(12)
  })
})

describe('leaderNames', () => {
  it('names the captain and joins the wicketkeepers', () => {
    const list = sheetPlayers([
      member({ firstName: 'Hannes', lastName: 'Kruger', isCaptain: true }),
      member({ firstName: 'Pieter', lastName: 'Du Plessis', isWicketKeeper: true }),
      member({ firstName: 'Riaan', lastName: 'Smit', isWicketKeeper: true }),
    ])
    expect(leaderNames(list)).toEqual({ captain: 'Hannes Kruger', keeper: 'Pieter Du Plessis, Riaan Smit' })
    expect(leaderNames([])).toEqual({ captain: null, keeper: null })
  })
})

describe('tournamentRange and hourStyle', () => {
  it('writes the first to the last day of a tournament', () => {
    expect(tournamentRange([])).toBeNull()
    expect(tournamentRange(['2026-11-19T12:30:00'])).toBe('19 NOV 2026')
    expect(tournamentRange(['2026-11-21T09:00:00', '2026-11-19T12:30:00'])).toBe('19-21 NOV 2026')
    expect(tournamentRange(['2026-11-30T09:00:00', '2026-12-02T09:00:00'])).toBe('30 NOV - 2 DEC 2026')
    expect(tournamentRange(['2026-12-30T09:00:00', '2027-01-02T09:00:00'])).toBe('30 DEC 2026 - 2 JAN 2027')
  })

  it('writes a start time as 14H30', () => {
    expect(hourStyle('14:30')).toBe('14H30')
  })
})

describe('sidePlayers (Selected Side)', () => {
  const squad = [
    member({ playerProfileId: 'a', firstName: 'Andre', lastName: 'Botha', squadJerseyNumber: 7 }),
    member({ playerProfileId: 'b', firstName: 'Hannes', lastName: 'Kruger', jerseyNumber: 3 }),
    member({ playerProfileId: 'c', firstName: 'Willem', lastName: 'Meyer' }),
    member({ playerProfileId: 'd', firstName: 'Jaco', lastName: 'Zeelie', squadJerseyNumber: 31 }),
  ]
  const side = {
    captainPlayerId: 'b',
    wicketKeeperPlayerId: 'c',
    twelfthManPlayerId: 'd',
    players: [
      { playerProfileId: 'c', battingOrder: 1, role: 'BATSMAN' as const },
      { playerProfileId: 'a', battingOrder: 2, role: 'BATSMAN' as const },
      { playerProfileId: 'b', battingOrder: null, role: 'BOWLER' as const },
    ],
  }

  it('lists the XI in batting order, a player with no position after those with one, and the twelfth man last', () => {
    const list = sidePlayers(side, squad, 'batting')
    expect(list.map((p) => p.lastName)).toEqual(['Meyer', 'Botha', 'Kruger', 'Zeelie'])
    expect(list.at(-1)?.twelfth).toBe(true)
  })

  it('sorts the alphabetical XI by first name when asked, the twelfth man still last', () => {
    expect(sidePlayers(side, squad, 'alphabetical', 'firstName').map((p) => p.firstName)).toEqual(['Andre', 'Hannes', 'Willem', 'Jaco'])
  })

  it('lists the XI alphabetically with the twelfth man still last', () => {
    expect(sidePlayers(side, squad, 'alphabetical').map((p) => p.lastName)).toEqual(['Botha', 'Kruger', 'Meyer', 'Zeelie'])
  })

  it('flags the captain and keeper, takes the shirt from the squad (squad number first), and names a player not on the squad from the side', () => {
    const list = sidePlayers({ ...side, players: [...side.players, { playerProfileId: 'x', battingOrder: 3, role: 'BATSMAN', firstName: 'Guest', lastName: 'Player' }] }, squad, 'batting')
    expect(list.find((p) => p.lastName === 'Kruger')).toMatchObject({ isCaptain: true, shirt: 3 })
    expect(list.find((p) => p.lastName === 'Meyer')).toMatchObject({ isKeeper: true, shirt: null })
    expect(list.find((p) => p.lastName === 'Botha')?.shirt).toBe(7)
    expect(list.find((p) => p.key === 'x')).toMatchObject({ firstName: 'Guest', lastName: 'Player', shirt: null })
  })
})

describe('surnameDisplay: the surname in capitals with its leading particles in lower case', () => {
  it.each([
    ['Van der Westhuizen', 'van der WESTHUIZEN'],
    ['van der Merwe', 'van der MERWE'],
    ['De Villiers', 'de VILLIERS'],
    ['du Plessis', 'du PLESSIS'],
    ['vd Westhuizen', 'vd WESTHUIZEN'],
    ['Coetzer', 'COETZER'],
    ['Botha', 'BOTHA'],
  ])('%s prints as %s', (input, expected) => {
    expect(surnameDisplay(input)).toBe(expected)
  })

  it('splits the particles from the main part for the posters that print them on two lines', () => {
    expect(surnameParts('Van der Westhuizen')).toEqual({ particles: 'van der', main: 'WESTHUIZEN' })
    expect(surnameParts('Botha')).toEqual({ particles: '', main: 'BOTHA' })
  })

  it('keeps at least one word in capitals, even when the whole surname is a particle', () => {
    expect(surnameDisplay('Van')).toBe('VAN')
    expect(surnameDisplay('de la Rey')).toBe('de la REY')
    expect(surnameDisplay('  ')).toBe('')
  })
})
