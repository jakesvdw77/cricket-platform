import { describe, expect, it } from 'vitest'
import type { Match } from '../../api/matchApi'
import type { MatchResult, ResultPlayer, Scorecard } from '../../api/matchResultApi'
import { buildShareResultModel } from './shareResultData'

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
    { sequence: 1, kind: 'REGULAR', battingSide: 'HOME', runs: 150, wickets: 6, balls: 240, extras: 8, wides: 5, byes: 3 },
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
    { battingSide: 'HOME', resultPlayerId: 'p1', position: 1, howOut: 'CAUGHT', runs: 60, balls: 40, fours: 6, sixes: 1, bowlerPlayerId: 'o1', fielderPlayerId: 'o2', featuredOverride: null },
    { battingSide: 'HOME', resultPlayerId: 'p2', position: 2, howOut: 'NOT_OUT', runs: 30, balls: 30, fours: 2, sixes: 0, featuredOverride: null },
    { battingSide: 'AWAY', resultPlayerId: 'o1', position: 1, howOut: 'BOWLED', runs: 40, balls: 50, fours: 3, sixes: 0, bowlerPlayerId: 'p2', featuredOverride: null },
  ],
  bowling: [
    { battingSide: 'AWAY', resultPlayerId: 'p2', bowlingOrder: 1, balls: 24, maidens: 1, runs: 20, wickets: 3, wides: 0, noBalls: 0, featuredOverride: null },
    { battingSide: 'HOME', resultPlayerId: 'o1', bowlingOrder: 1, balls: 24, maidens: 0, runs: 30, wickets: 1, wides: 0, noBalls: 0, featuredOverride: null },
  ],
  fielding: [],
  awards: [{ awardType: 'PLAYER_OF_MATCH', side: 'HOME', resultPlayerId: 'p1' }],
} as unknown as Scorecard

const build = (overrides: Partial<Parameters<typeof buildShareResultModel>[0]> = {}) =>
  buildShareResultModel({ match, result, scorecard, teamsChoice: 'both', initialsOnly: false, ...overrides })

describe('buildShareResultModel', () => {
  it('assembles the summary, rows and dismissal text with names in the shared form', () => {
    const model = build()
    expect(model.resultLine).toBe('Riverside 1 won by 24 runs')
    expect(model.home.scoreText).toBe('150/6 (40.0)')
    expect(model.toss).toBe('Riverside 1 won the toss and chose to bat')
    expect(model.innings).toHaveLength(2)
    expect(model.innings[0].batting[0]).toMatchObject({ name: 'M. Naidoo', howOut: 'c P. Botha b T. Mokoena' })
    expect(model.innings[0].extras?.text).toBe('Extras 8 (b 3, w 5)')
    expect(model.playerOfTheMatch).toEqual({ name: 'M. Naidoo', ours: true })
  })

  it('never leaks a full given name with Initials only on', () => {
    const text = JSON.stringify(build({ initialsOnly: true }))
    for (const given of ['Mpho', 'Sam ', 'Thabo', 'Pieter']) expect(text).not.toContain(given)
    expect(text).toContain('c P. B. b T. M.')
  })

  it('omits the opposition rows, names and player of the match with Our team only but keeps the totals', () => {
    const model = build({ teamsChoice: 'ours' })
    expect(model.teams).toBe('ours')
    expect(model.home.scoreText).toBe('150/6 (40.0)')
    expect(model.away.scoreText).toBe('126/10 (38.2)')
    const text = JSON.stringify(model)
    expect(text).not.toContain('Botha')
    expect(text).not.toContain('Mokoena')
    expect(text).not.toContain('T. Mokoena')
    const awayInnings = model.innings.find((item) => item.battingSide === 'AWAY')
    expect(awayInnings?.batting).toEqual([])
    expect(awayInnings?.extras).toBeNull()
    expect(model.innings[0].batting[0].howOut).toBe('caught')
    const dropped = build({
      teamsChoice: 'ours',
      scorecard: { ...scorecard, awards: [{ awardType: 'PLAYER_OF_MATCH', side: 'AWAY', resultPlayerId: 'o1' }] } as Scorecard,
    })
    expect(dropped.playerOfTheMatch).toBeNull()
  })

  it('reads an opposition player of the match from the award display name', () => {
    const model = build({
      initialsOnly: true,
      scorecard: { ...scorecard, awards: [{ awardType: 'PLAYER_OF_MATCH', side: 'AWAY', displayName: 'Pieter Botha' }] } as Scorecard,
    })
    expect(model.playerOfTheMatch).toEqual({ name: 'P. B.', ours: false })
  })

  it('flags a derby and a summary-only result and still builds the summary', () => {
    const derby = build({ match: { ...match, awayTeamId: 't2' } as Match, teamsChoice: 'ours' })
    expect(derby.teamsChoiceDisabledReason).toBe('DERBY')
    expect(derby.teams).toBe('both')
    const summary = build({ scorecard: null, teamsChoice: 'ours' })
    expect(summary.teamsChoiceDisabledReason).toBe('NO_SCORECARD')
    expect(summary.innings).toEqual([])
    expect(summary.resultLine).toBe('Riverside 1 won by 24 runs')
    expect(summary.playerOfTheMatch).toBeNull()
  })

  it('reports shared initials without keeping any full name', () => {
    const twins = {
      ...scorecard,
      players: [...scorecard.players, player('p3', 'HOME', { playerProfileId: 'x3', firstName: 'Mike', lastName: 'Nel', opposition: false })],
      batting: [
        ...scorecard.batting,
        { battingSide: 'HOME', resultPlayerId: 'p3', position: 3, howOut: 'NOT_OUT', runs: 1, balls: 1, fours: 0, sixes: 0, featuredOverride: null },
      ],
    } as Scorecard
    expect(build({ initialsOnly: true, scorecard: twins }).initialsCollisions).toEqual(['M. N.'])
    expect(build({ initialsOnly: false, scorecard: twins }).initialsCollisions).toEqual([])
  })

  it('ranks the top performers', () => {
    const model = build()
    expect(model.innings[0].topBatters.map((row) => row.name)).toEqual(['M. Naidoo', 'S. van der Westhuizen'])
    expect(model.innings[0].topBowlers.map((row) => row.name)).toEqual(['T. Mokoena'])
    expect(model.innings[1].topBowlers[0]).toMatchObject({ name: 'S. van der Westhuizen', wickets: 3, economy: 5 })
  })
})
