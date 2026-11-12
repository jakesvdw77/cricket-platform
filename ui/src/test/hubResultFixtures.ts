import type { MyResultDetail, MyResultInnings, MyResultList, MyResultRow, MyResultSummary } from '../api/meResultsApi'
import { resultRow } from './tickerFixtures'

// docs/specs/145: payload fixtures for the Player Hub Results tests, typed from the API types. Figures are small and consistent but no
// test relies on them adding up: the client computes none of them.
export const KEY = 'k1'

const battingInnings = (over: Partial<NonNullable<MyResultRow['batting']['innings']>[number]> = {}) => ({ runs: 46, balls: 40, notOut: false, howOut: 'CAUGHT' as const, fours: 4, sixes: 1, ...over })

export const battingRow = (over: Partial<MyResultRow> = {}): MyResultRow =>
  resultRow({ batting: { status: 'BATTED', innings: [battingInnings()], inningsCount: 1, runs: 46, ballsFaced: 40, fours: 4, sixes: 1 }, ...over })

export const bowlingRow = (over: Partial<MyResultRow> = {}): MyResultRow =>
  resultRow({
    batting: { status: 'DID_NOT_BAT', innings: [], inningsCount: 0, runs: 0, ballsFaced: 0, fours: 0, sixes: 0 },
    bowling: { status: 'BOWLED', spells: [{ balls: 24, maidens: 1, runs: 21, wickets: 2 }], balls: 24, maidens: 1, runs: 21, wickets: 2, dots: 10 },
    ...over,
  })

export const didNotBatRow = (over: Partial<MyResultRow> = {}): MyResultRow =>
  resultRow({ batting: { status: 'DID_NOT_BAT', innings: [], inningsCount: 0, runs: 0, ballsFaced: 0, fours: 0, sixes: 0 }, ...over })

export const noCardRow = (over: Partial<MyResultRow> = {}): MyResultRow =>
  resultRow({
    batting: { status: 'NO_CARD', innings: [], inningsCount: 0, runs: 0, ballsFaced: 0, fours: 0, sixes: 0 },
    bowling: { status: 'NO_CARD', balls: 0, maidens: 0, runs: 0, wickets: 0, dots: 0 },
    fielding: { status: 'NO_CARD', catches: 0, stumpings: 0, runOuts: 0 },
    ...over,
  })

export const makeResultList = (rows: MyResultRow[], over: Partial<MyResultList> = {}): MyResultList => ({
  scope: {},
  page: { number: 0, size: 20, totalElements: rows.length, hasMore: false },
  rows,
  ...over,
})

export const makeResultSummary = (over: Partial<MyResultSummary> = {}): MyResultSummary => ({
  scope: {},
  matches: 2,
  won: 1,
  lost: 1,
  tied: 0,
  drawn: 0,
  internal: 0,
  runs: 60,
  wickets: 2,
  catches: 0,
  playerOfTheMatch: 0,
  highestScore: { runs: 46, notOut: false },
  bestBowling: { wickets: 2, runs: 21 },
  lastFive: [],
  ...over,
})

export const makeInnings = (over: Partial<MyResultInnings> = {}): MyResultInnings => ({
  sequence: 1,
  battingSide: 'HOME',
  battingTeamName: 'Villagers',
  runs: 180,
  wickets: 4,
  overs: '40.0',
  extras: 8,
  wides: 3,
  noBalls: 1,
  byes: 2,
  legByes: 2,
  penaltyRuns: 0,
  batting: [
    { name: 'Aman Naidoo', mine: true, position: 1, howOut: 'CAUGHT', bowler: 'Sam Rover', fielder: 'Jo Rover', runs: 46, balls: 40, fours: 4, sixes: 1 },
    { name: 'Teammate Two', mine: false, position: 2, howOut: 'NOT_OUT', runs: 12, balls: 20, fours: 1, sixes: 0 },
  ],
  didNotBat: ['Late Order'],
  bowling: [{ name: 'Sam Rover', mine: false, overs: '8.0', maidens: 0, runs: 40, wickets: 2, wides: 1, noBalls: 0, dots: 20 }],
  ...over,
})

export const makeResultDetail = (over: Partial<MyResultDetail> = {}): MyResultDetail => ({
  mine: battingRow(),
  venue: 'Main Oval',
  innings: [
    makeInnings(),
    makeInnings({
      sequence: 2,
      battingSide: 'AWAY',
      battingTeamName: 'Rovers',
      runs: 156,
      wickets: 9,
      overs: '40.0',
      batting: [{ name: 'Sam Rover', mine: false, position: 1, howOut: 'BOWLED', bowler: 'Aman Naidoo', runs: 30, balls: 30, fours: 2, sixes: 0 }],
      didNotBat: [],
      bowling: [{ name: 'Aman Naidoo', mine: true, overs: '4.0', maidens: 1, runs: 21, wickets: 2, wides: 0, noBalls: 0, dots: 10 }],
    }),
  ],
  awards: [{ type: 'PLAYER_OF_MATCH', playerName: 'Aman Naidoo' }, { type: 'TEAM_PLAYER_OF_MATCH', side: 'AWAY', playerName: 'Sam Rover' }],
  ...over,
})
