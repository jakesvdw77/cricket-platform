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
    expect(model.innings[0].batting[0]).toMatchObject({ name: 'Mpho Naidoo', howOut: 'c Pieter Botha b Thabo Mokoena' })
    expect(model.innings[0].extras?.text).toBe('Extras 8 (b 3, w 5)')
    expect(model.playerOfTheMatch).toEqual({ name: 'Mpho Naidoo', ours: true })
  })

  it('never leaks a full given name with First names as initials on', () => {
    const text = JSON.stringify(build({ initialsOnly: true }))
    for (const given of ['Mpho', 'Sam ', 'Thabo', 'Pieter']) expect(text).not.toContain(given)
    expect(text).toContain('c P. Botha b T. Mokoena')
    expect(text).toContain('M. Naidoo')
    expect(JSON.stringify(build({ initialsOnly: false }))).toContain('Mpho Naidoo')
  })

  it('omits the opposition rows, names and player of the match with Our team only but keeps the totals', () => {
    const model = build({ teamsChoice: 'ours' })
    expect(model.teams).toBe('ours')
    expect(model.home.scoreText).toBe('150/6 (40.0)')
    expect(model.away.scoreText).toBe('126/10 (38.2)')
    const text = JSON.stringify(model)
    expect(text).not.toContain('Botha')
    expect(text).not.toContain('Mokoena')
    expect(text).not.toContain('Thabo Mokoena')
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
    expect(model.playerOfTheMatch).toEqual({ name: 'P. Botha', ours: false })
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

  it('reports two different players who share the same shortened name', () => {
    const twins = {
      ...scorecard,
      players: [...scorecard.players, player('p3', 'HOME', { playerProfileId: 'x3', firstName: 'Mandla', lastName: 'Naidoo', opposition: false })],
      batting: [
        ...scorecard.batting,
        { battingSide: 'HOME', resultPlayerId: 'p3', position: 3, howOut: 'NOT_OUT', runs: 1, balls: 1, fours: 0, sixes: 0, featuredOverride: null },
      ],
    } as Scorecard
    expect(build({ initialsOnly: true, scorecard: twins }).initialsCollisions).toEqual(['M. Naidoo'])
    expect(build({ initialsOnly: false, scorecard: twins }).initialsCollisions).toEqual([])
  })

  it('ranks the top performers', () => {
    const model = build()
    expect(model.innings[0].topBatters.map((row) => row.name)).toEqual(['Mpho Naidoo', 'Sam van der Westhuizen'])
    expect(model.innings[0].topBowlers.map((row) => row.name)).toEqual(['Thabo Mokoena'])
    expect(model.innings[1].topBowlers[0]).toMatchObject({ name: 'Sam van der Westhuizen', wickets: 3, economy: 5 })
  })
})

describe('buildShareResultModel team names (regression: "Home team")', () => {
  const teams = [
    { id: 't1', name: 'Riverside 1st XI', logoUrl: 'https://x/t1.png' },
    { id: 't2', name: 'Riverside 2nd XI', logoUrl: null },
  ]
  // The match carries NO name for one of the club's own teams; it lives on the Team.
  const ownMatch = { ...match, homeTeamName: null } as unknown as Match

  it('reads the club team name from the Team, not the fallback', () => {
    const model = buildShareResultModel({ match: ownMatch, result, scorecard, teams, teamsChoice: 'both', initialsOnly: false })
    expect(model.home.name).toBe('Riverside 1st XI')
    expect(model.resultLine).toBe('Riverside 1st XI won by 24 runs')
    expect(model.toss).toBe('Riverside 1st XI won the toss and chose to bat')
    expect(model.innings[0].battingTeam).toBe('Riverside 1st XI')
    expect(model.innings[1].bowlingTeam).toBe('Riverside 1st XI')
    expect(JSON.stringify(model)).not.toContain('Home team')
  })

  it('prefers the Team name over the name on the match, and falls back to the match name for a free-text opponent', () => {
    const model = buildShareResultModel({ match, result, scorecard, teams, teamsChoice: 'both', initialsOnly: false })
    expect(model.home.name).toBe('Riverside 1st XI')
    expect(model.away.name).toBe('Pretoria CC')
  })

  it('falls back to "Home team" and "Away team" only when nothing names the side', () => {
    const bare = { ...match, homeTeamName: null, awayTeamName: null } as unknown as Match
    const model = buildShareResultModel({ match: bare, result, scorecard, teamsChoice: 'both', initialsOnly: false })
    expect(model.home.name).toBe('Home team')
    expect(model.away.name).toBe('Away team')
  })

  it("falls back to the team's own logo when the match carries none", () => {
    const model = buildShareResultModel({ match: ownMatch, result, scorecard, teams, teamsChoice: 'both', initialsOnly: false })
    expect(model.home.logoUrl).toBe('https://x/t1.png')
    expect(model.away.logoUrl).toBeNull()
  })

  it('names both sides of a derby from the Teams', () => {
    const derbyMatch = { ...match, homeTeamName: null, awayTeamId: 't2', awayTeamName: null } as unknown as Match
    const model = buildShareResultModel({ match: derbyMatch, result, scorecard, teams, teamsChoice: 'both', initialsOnly: false })
    expect(model.home.name).toBe('Riverside 1st XI')
    expect(model.away.name).toBe('Riverside 2nd XI')
  })
})

describe('buildShareResultModel Our team only in detail', () => {
  it('drops the opposition tables, extras and performers and keeps ours, the totals and the result line', () => {
    const model = build({ teamsChoice: 'ours' })
    const ours = model.innings.find((item) => item.battingSide === 'HOME')
    const theirs = model.innings.find((item) => item.battingSide === 'AWAY')
    expect(ours?.batting.map((row) => row.name)).toEqual(['Mpho Naidoo', 'Sam van der Westhuizen'])
    expect(ours?.extras?.text).toBe('Extras 8 (b 3, w 5)')
    // Their bowling of OUR innings is not ours; ours bowl in THEIR innings.
    expect(ours?.bowling.map((row) => row.name)).toEqual([])
    expect(theirs?.bowling.map((row) => row.name)).toEqual(['Sam van der Westhuizen'])
    expect(theirs?.batting).toEqual([])
    expect(theirs?.topBatters).toEqual([])
    expect(theirs?.extras).toBeNull()
    expect(model.resultLine).toBe('Riverside 1 won by 24 runs')
    expect(model.home.scoreText).toBe('150/6 (40.0)')
    expect(model.away.scoreText).toBe('126/10 (38.2)')
  })

  it('shows both teams in full for the same data', () => {
    const model = build({ teamsChoice: 'both' })
    const theirs = model.innings.find((item) => item.battingSide === 'AWAY')
    expect(theirs?.batting.map((row) => row.name)).toEqual(['Thabo Mokoena'])
    expect(model.innings.find((item) => item.battingSide === 'HOME')?.bowling.map((row) => row.name)).toEqual(['Thabo Mokoena'])
  })

  it('keeps a dismissal with only our people named, and a plain word where the other name is the opposition', () => {
    const allOurs = {
      ...scorecard,
      batting: [
        { battingSide: 'HOME', resultPlayerId: 'p1', position: 1, howOut: 'CAUGHT', runs: 60, balls: 40, bowlerPlayerId: 'p2', fielderPlayerId: 'p2', featuredOverride: null },
        { battingSide: 'HOME', resultPlayerId: 'p2', position: 2, howOut: 'BOWLED', runs: 5, balls: 9, bowlerPlayerId: 'o1', featuredOverride: null },
        { battingSide: 'HOME', resultPlayerId: 'p1', position: 3, howOut: 'RUN_OUT', runs: 1, balls: 1, fielderPlayerId: 'o2', featuredOverride: null },
      ],
    } as unknown as Scorecard
    const rows = build({ teamsChoice: 'ours', initialsOnly: true, scorecard: allOurs }).innings[0].batting
    expect(rows[0].howOut).toBe('c S. van der Westhuizen b S. van der Westhuizen')
    expect(rows[1].howOut).toBe('bowled')
    expect(rows[2].howOut).toBe('run out')
    expect(JSON.stringify(rows)).not.toMatch(/Botha|Mokoena|Thabo|Pieter/)
  })

  it('writes every dismissal kind in the shared form with both names', () => {
    const kinds = ['BOWLED', 'LBW', 'STUMPED', 'RUN_OUT', 'CAUGHT_AND_BOWLED', 'HIT_WICKET', 'CAUGHT'] as const
    const withKind = (howOut: string) =>
      ({
        ...scorecard,
        batting: [{ battingSide: 'HOME', resultPlayerId: 'p1', position: 1, howOut, runs: 1, balls: 1, bowlerPlayerId: 'o1', fielderPlayerId: 'o2', featuredOverride: null }],
      }) as unknown as Scorecard
    const out = Object.fromEntries(kinds.map((kind) => [kind, build({ initialsOnly: true, scorecard: withKind(kind) }).innings[0].batting[0].howOut]))
    expect(out).toEqual({
      BOWLED: 'b T. Mokoena',
      LBW: 'lbw b T. Mokoena',
      STUMPED: 'st P. Botha b T. Mokoena',
      RUN_OUT: 'run out (P. Botha)',
      CAUGHT_AND_BOWLED: 'c & b T. Mokoena',
      HIT_WICKET: 'hit wicket b T. Mokoena',
      CAUGHT: 'c P. Botha b T. Mokoena',
    })
  })
})

describe('buildShareResultModel derby and summary-only', () => {
  const derbyMatch = { ...match, awayTeamId: 't2' } as unknown as Match
  const derbyCard = {
    ...scorecard,
    players: scorecard.players.map((item) => ({ ...item, opposition: false })),
  } as unknown as Scorecard

  it('keeps everything in a derby whatever is chosen, because both sides are ours', () => {
    const both = buildShareResultModel({ match: derbyMatch, result, scorecard: derbyCard, teamsChoice: 'both', initialsOnly: false })
    const ours = buildShareResultModel({ match: derbyMatch, result, scorecard: derbyCard, teamsChoice: 'ours', initialsOnly: false })
    expect(ours.teamsChoiceDisabledReason).toBe('DERBY')
    expect(ours.teams).toBe('both')
    expect(ours).toEqual(both)
    expect(ours.innings).toHaveLength(2)
    expect(ours.home.ours && ours.away.ours).toBe(true)
  })

  it('builds a summary-only result with scores, line, toss and venue but no rows, whatever is chosen', () => {
    for (const scorecardValue of [null, undefined, { ...scorecard, players: [] } as unknown as Scorecard]) {
      const model = build({ scorecard: scorecardValue, teamsChoice: 'ours' })
      expect(model.hasScorecard).toBe(false)
      expect(model.teamsChoiceDisabledReason).toBe('NO_SCORECARD')
      expect(model.teams).toBe('both')
      expect(model.innings).toEqual([])
      expect(model.playerOfTheMatch).toBeNull()
      expect(model.initialsCollisions).toEqual([])
      expect(model.home.scoreText).toBe('150/6 (40.0)')
      expect(model.away.scoreText).toBe('126/10 (38.2)')
      expect(model.resultLine).toBe('Riverside 1 won by 24 runs')
      expect(model.toss).toBe('Riverside 1 won the toss and chose to bat')
      expect(model.venue).toBe('Main Oval')
    }
  })

  it('reports a derby before a missing scorecard', () => {
    const model = buildShareResultModel({ match: derbyMatch, result, scorecard: null, teamsChoice: 'ours', initialsOnly: false })
    expect(model.teamsChoiceDisabledReason).toBe('DERBY')
  })
})

describe('buildShareResultModel player of the match', () => {
  const award = (patch: object) => ({ ...scorecard, awards: [{ awardType: 'PLAYER_OF_MATCH', ...patch }] }) as unknown as Scorecard

  it('names one of ours, in the shared form, under Both teams and Our team only', () => {
    for (const teamsChoice of ['both', 'ours'] as const) {
      expect(build({ teamsChoice, initialsOnly: true, scorecard: award({ side: 'HOME', resultPlayerId: 'p2' }) }).playerOfTheMatch).toEqual({
        name: 'S. van der Westhuizen',
        ours: true,
      })
    }
  })

  it("names the opposition's player under Both teams and drops it under Our team only", () => {
    const opposition = award({ side: 'AWAY', resultPlayerId: 'o1' })
    expect(build({ initialsOnly: false, scorecard: opposition }).playerOfTheMatch).toEqual({ name: 'Thabo Mokoena', ours: false })
    expect(build({ initialsOnly: true, scorecard: opposition }).playerOfTheMatch).toEqual({ name: 'T. Mokoena', ours: false })
    expect(build({ teamsChoice: 'ours', scorecard: opposition }).playerOfTheMatch).toBeNull()
  })

  it('has none when there is no award, or the award names nobody known', () => {
    expect(build({ scorecard: { ...scorecard, awards: [] } as unknown as Scorecard }).playerOfTheMatch).toBeNull()
    expect(build({ scorecard: award({ side: 'HOME' }) }).playerOfTheMatch).toBeNull()
    expect(build({ scorecard: { ...scorecard, awards: [{ awardType: 'BEST_FIELDER', resultPlayerId: 'p1' }] } as unknown as Scorecard }).playerOfTheMatch).toBeNull()
  })

  it('reads the structured player, never the pre-formatted award name', () => {
    const model = build({ initialsOnly: true, scorecard: award({ side: 'HOME', resultPlayerId: 'p1', playerName: 'Mpho Naidoo', displayName: null }) })
    expect(model.playerOfTheMatch?.name).toBe('M. Naidoo')
  })
})

describe('buildShareResultModel other result shapes', () => {
  it('has no overs to spare for a win by runs and never invents a batting order for no innings', () => {
    const model = build()
    expect(model.oversRemaining).toBeNull()
    expect(model.battingFirst).toBe('HOME')
    const none = build({ result: { ...result, innings: [] } as unknown as MatchResult, scorecard: null })
    expect(none.battingFirst).toBeNull()
    expect(none.home.scoreText).toBe('')
  })

  it('works out the overs to spare for a chase won by wickets', () => {
    const chase = {
      ...result,
      winningSide: 'AWAY',
      marginType: 'WICKETS',
      marginValue: 4,
      scheduledBalls: 240,
      innings: [
        { sequence: 1, kind: 'REGULAR', battingSide: 'HOME', runs: 100, wickets: 10, balls: 200 },
        { sequence: 2, kind: 'REGULAR', battingSide: 'AWAY', runs: 101, wickets: 6, balls: 214 },
      ],
    } as unknown as MatchResult
    expect(build({ result: chase, scorecard: null }).oversRemaining).toBe('4.2')
  })
})
