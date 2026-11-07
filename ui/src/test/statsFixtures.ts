import type { MyLeaderboardColumn, MyLeaderboardRow, MyLeaderboardTable, MyStanding, MyStandingLine, MyStatsDto, MyStatsInningsPage, MyStatsInningsRow, MyTeamResultPoint, MyTeamStatsDto } from '../api/meStatsApi'
import type { MyResultFilters } from '../api/meResultsApi'
import { makeTeamStats } from './teamStatsFixtures'

// docs/specs/147: payload fixtures for the Player Hub stats tests, built from the API types. `makeMyStats` and `makeMyTeamStats` are FULL
// (every optional block present, so every card is ready); `withoutBlocks` strips blocks to prove a card never crashes on an older backend's
// payload. Figures are small and consistent (7 results, 6 with a batting card) but no test relies on them adding up: the client computes none.

export const KEY = 'k1'
export const SEASON = { id: 's1', name: '2025/26' }
export const LEAGUE = { id: 'l1', name: 'Premier League' }
export const TEAM = { id: 't1', name: 'U14 A' }

export const makeResultFilters = (over: Partial<MyResultFilters> = {}): MyResultFilters => ({
  currentSeasonId: SEASON.id,
  seasons: [SEASON, { id: 's0', name: '2024/25' }],
  teams: [TEAM, { id: 't2', name: 'U14 B' }],
  leagues: [LEAGUE],
  combos: [
    { seasonId: 's1', leagueId: 'l1', teamId: 't1' },
    { seasonId: 's1', leagueId: null, teamId: 't2' },
    { seasonId: 's0', leagueId: 'l1', teamId: 't1' },
  ],
  ...over,
})

const day = (n: number) => `2025-11-${String(n).padStart(2, '0')}T08:00:00Z`
const ref = (n: number) => ({ matchId: `m${n}`, matchDate: day(n), opponentName: `Rovers ${n}`, derby: false })
const split = (innings: number, runs: number) => ({ innings, dismissals: innings - 1, runs, average: runs / Math.max(innings - 1, 1) })

export function makeMyStats(over: Partial<MyStatsDto> = {}): MyStatsDto {
  const scores = [12, 47, 5, 63, 0, 31]
  return {
    scope: { seasonId: 's1', leagueId: null, teamId: null, competition: null },
    playerFirstName: 'Sam',
    ageBand: 'ADULT',
    basis: { resultsCounted: 7, resultsWithBattingCard: 6, resultsWithBowlingCard: 5, resultsWithFieldingCard: 7, fixturesRemaining: 3, truncated: false, historyCap: 50 },
    batting: {
      matches: 7, innings: 6, notOuts: 1, dismissals: 5, runs: 158, ballsFaced: 190, fours: 14, sixes: 3, ducks: 1, goldenDucks: 0,
      thirtyPlus: 3, fiftyPlus: 1, hundredPlus: 0, centuries: 0, halfCenturies: 1,
      highestScore: { runs: 63, notOut: false },
      dismissalModes: { BOWLED: 2, CAUGHT: 2, LBW: 1 },
      positions: [{ position: 1, innings: 3, runs: 80, average: 40 }],
      average: 31.6, strikeRate: 83.2, boundaryPercentage: 38.6, ballsPerBoundary: 11.2,
      coverage: { inningsWithBalls: 6, inningsWithBoundaries: 6, inningsCounted: 6 },
    },
    bowling: {
      inningsBowled: 5, ballsBowled: 150, ballsPerOver: [6], mixedOverLengths: false, runsConceded: 120, wickets: 7, maidens: 2, wides: 4, noBalls: 1, dots: 70,
      threeWicketHauls: 1, fourWicketHauls: 0, fiveWicketHauls: 0, best: { wickets: 3, runs: 18 },
      dismissalModes: { BOWLED: 3, CAUGHT: 2, LBW: 2 }, dismissalsNotRecorded: 0,
      average: 17.1, economy: 4.8, strikeRate: 21.4, dotBallPercentage: 46.7,
      coverage: { inningsWithWides: 5, inningsWithNoBalls: 5, inningsWithDots: 5, inningsCounted: 5 },
    },
    fielding: { catches: 4, stumpings: 0, runOuts: 1, dismissals: 5, dismissalsPerMatch: 0.7 },
    awards: { playerOfTheMatch: 1, teamPlayerOfTheMatch: 0 },
    record: { won: 4, lost: 2, tied: 0, drawn: 1, internal: 0 },
    form: { batting: [6, 5, 4].map((n) => ({ matchId: `m${n}`, matchDate: day(n), runs: scores[n - 1], notOut: false, balls: scores[n - 1] + 8 })), bowling: [] },
    series: {
      window: { pointLimit: 30, historyCap: 50 },
      battingInnings: scores.map((runs, index) => ({ ...ref(index + 1), runs, balls: runs + 8, notOut: index === 1, howOut: index === 1 ? null : 'BOWLED' })),
      battingSummary: { inningsTotal: 6, shown: 6, notOuts: 1, runs: 158, averageRuns: 31.6 },
      dismissals: [
        { type: 'BOWLED', label: 'Bowled', count: 2, percent: 33.3, filter: 'BOWLED' },
        { type: 'CAUGHT', label: 'Caught', count: 2, percent: 33.3, filter: 'CAUGHT' },
        { type: 'LBW', label: 'LBW', count: 1, percent: 16.7, filter: 'LBW' },
        { type: 'NOT_OUT', label: 'Not out', count: 1, percent: 16.7, filter: 'NOT_OUT' },
      ],
      battingTrend: scores.map((_, index) => ({ ...ref(index + 1), cumulativeRuns: 10 * (index + 1), cumulativeDismissals: index, average: 12 + index })),
      bowlingMatches: [1, 2, 3, 4, 5].map((n) => ({ ...ref(n), balls: 30, ballsPerOver: 6, maidens: 0, runs: 24, wickets: n === 3 ? 3 : 1, economy: 4.8 })),
      wicketTypes: {
        types: [
          { type: 'BOWLED', label: 'Bowled', count: 3, percent: 42.9 },
          { type: 'CAUGHT', label: 'Caught', count: 2, percent: 28.6 },
          { type: 'LBW', label: 'LBW', count: 2, percent: 28.6 },
        ],
        notItemised: { count: 0, percent: null }, total: 7, itemised: 7,
        coverage: { wicketsItemised: 7, wicketsTotal: 7, inningsItemised: 5, inningsWithWickets: 5 },
      },
      economySummary: { overallEconomy: 4.8, matchesCounted: 5, matchesWithEconomy: 5, totalPoints: 5, shown: 5, recentEconomy: null, earlierEconomy: null, direction: null },
    },
    rolling: { span: 5, points: scores.map((_, index) => ({ matchId: `m${index + 1}`, matchDate: day(index + 1), average: 20 + index })), hint: { recent: 28, earlier: 22, direction: 'UP' } },
    guides: { low: 30, high: 50, basis: 'Adult guides' },
    bands: [
      { key: '0-9', label: '0 to 9', innings: 2, percent: 33.3, filter: 'BAND_0_9' },
      { key: '10-29', label: '10 to 29', innings: 1, percent: 16.7, filter: 'BAND_10_29' },
      { key: '30-49', label: '30 to 49', innings: 2, percent: 33.3, filter: 'BAND_30_49' },
      { key: '50+', label: '50 and over', innings: 1, percent: 16.7, filter: 'BAND_50' },
    ],
    byInningsNumber: {
      battingFirst: { innings: 4, notOuts: 1, runs: 100, average: 33.3, filter: 'FIRST' },
      chasing: { innings: 2, notOuts: 0, runs: 58, average: 29, filter: 'CHASING' },
    },
    byOpposition: [{ opponentName: 'Rovers 1', innings: 2, runs: 59, average: 29.5, scores: [{ matchId: 'm1', matchDate: day(1), runs: 12, notOut: false }, { matchId: 'm2', matchDate: day(2), runs: 47, notOut: true }] }],
    dismissedBy: { bowlers: [{ name: 'Alex Rao', count: 2 }, { name: 'Bo Khan', count: 1 }], notRecorded: 2, total: 5 },
    wicketsByPosition: { groups: [{ key: 'OPENER', label: 'Openers', count: 2 }, { key: '3', label: 'No. 3', count: 1 }], notRecorded: 4, total: 7, caughtBy: [{ name: 'Lee Fox', count: 2 }] },
    milestones: {
      runs: { current: 158, target: 250, toGo: 92 },
      wickets: { current: 7, target: 10, toGo: 3 },
      catches: { current: 4, target: 5, toGo: 1 },
      personalBests: {
        highestScore: { runs: 63, notOut: false, matchId: 'm4' },
        bestBowling: { wickets: 3, runs: 18, matchId: 'm3' },
        mostCatches: { catches: 2, matchId: 'm5' },
        bestStrikeRate: { strikeRate: 140, runs: 28, balls: 20, matchId: 'm6' },
        minimumBalls: 10,
      },
    },
    teamRecordWhenScoring: {
      threshold: 30,
      scored: { matches: 3, won: 3, lost: 0, tied: 0, drawn: 0, winPercent: 100 },
      notScored: { matches: 3, won: 1, lost: 2, tied: 0, drawn: 0, winPercent: 33.3 },
      scoredFilter: 'SCORED_30', notScoredFilter: 'NOT_SCORED_30',
    },
    homeAway: { home: split(3, 70), away: split(3, 88), unknownFieldMatches: 0 },
    bySeason: [
      { seasonId: 's0', label: '2024/25', matches: 9, innings: 8, runs: 210, average: 30, wickets: 4 },
      { seasonId: 's1', label: '2025/26', matches: 7, innings: 6, runs: 158, average: 31.6, wickets: 7 },
    ],
    bowlingDiscipline: {
      wides: 4, noBalls: 1, widesPerOver: 0.16, noBallsPerOver: 0.04, inningsRecorded: 5, inningsCounted: 5,
      byInnings: [{ matchId: 'm3', matchDate: day(3), opponentName: 'Rovers 3', balls: 30, ballsPerOver: 6, wides: 2, noBalls: 0 }],
    },
    availability: { pollsTotal: 8, pollsAnswered: 7, answeredAvailable: 6, matchesSelected: 7, matchesPlayed: 7 },
    teamFielding: { catches: 12, runOuts: 3, stumpings: 1 },
    teamFieldingRank: 2,
    standing: { rank: 3, playersRanked: 14, average: 31.6, innings: 6 },
    notCaptured: [],
    summary: {
      leaguesPlayed: [{ leagueId: 'l1', name: 'Premier League', matches: 5 }, { leagueId: 'l2', name: 'Cup', matches: 2 }],
      teamsRepresented: [{ teamId: 't1', name: 'U14 A', matches: 5 }, { teamId: 't2', name: 'U14 B', matches: 2 }],
      matchesPlayed: 7, runsScored: 158, ballsFaced: 190, ballsBowled: 150, ballsPerOver: 6, catchesTaken: 4,
    },
    battingPositionGroups: [
      { key: 'OPENER', label: 'Opener', innings: 3, runs: 80, notOuts: 0, dismissals: 3, average: 26.7, highest: 47 },
      { key: '3', label: '3', innings: 2, runs: 63, notOuts: 0, dismissals: 2, average: 31.5, highest: 63 },
      { key: '4', label: '4', innings: 1, runs: 15, notOuts: 1, dismissals: 0, average: null, highest: 15 },
    ],
    battingVenues: [
      { venueKey: 'a1', name: 'Riverside Oval', home: true, innings: 3, notOuts: 0, dismissals: 3, runs: 70, average: 23.3 },
      { venueKey: 'a2', name: 'Hilltop Ground', home: false, innings: 3, notOuts: 1, dismissals: 2, runs: 88, average: 44 },
    ],
    bowlingHomeAway: {
      home: { spells: 2, balls: 60, ballsPerOver: 6, maidens: 1, runs: 50, wickets: 3, economy: 5, average: 16.7 },
      away: { spells: 3, balls: 90, ballsPerOver: 6, maidens: 1, runs: 70, wickets: 4, economy: 4.7, average: 17.5 },
      unknownVenueSpells: 0,
    },
    bowlingVenues: [
      { venueKey: 'a1', name: 'Riverside Oval', home: true, spells: 2, balls: 60, ballsPerOver: 6, runs: 50, wickets: 3, economy: 5 },
      { venueKey: 'a2', name: 'Hilltop Ground', home: false, spells: 3, balls: 90, ballsPerOver: 6, runs: 70, wickets: 4, economy: 4.7 },
    ],
    ...over,
  }
}

// An empty scope: results counted but nothing scored, bowled or caught in them.
export function makeEmptyMyStats(): MyStatsDto {
  const full = makeMyStats()
  return makeMyStats({
    basis: { ...full.basis, resultsCounted: 0, resultsWithBattingCard: 0, resultsWithBowlingCard: 0, resultsWithFieldingCard: 0 },
    batting: { ...full.batting, matches: 0, innings: 0, notOuts: 0, dismissals: 0, runs: 0, ballsFaced: 0, fours: 0, sixes: 0, ducks: 0, thirtyPlus: 0, fiftyPlus: 0, halfCenturies: 0, highestScore: null, average: null, strikeRate: null },
    series: { ...full.series, battingInnings: [], battingTrend: [], bowlingMatches: [], dismissals: [] },
    bySeason: [],
    bands: [],
    milestones: { ...full.milestones, runs: { current: 0, target: 50, toGo: 50 }, wickets: { current: 0, target: 5, toGo: 5 } },
  })
}

// Strips named optional blocks (an older backend), or any block at all, to prove no card takes the page down.
export function withoutBlocks<T extends object>(payload: T, ...blocks: string[]): T {
  const copy = { ...payload } as Record<string, unknown>
  for (const block of blocks) delete copy[block]
  return copy as T
}
export const MINE_OPTIONAL_BLOCKS = ['summary', 'battingPositionGroups', 'battingVenues', 'bowlingHomeAway', 'bowlingVenues']
export const TEAM_OPTIONAL_BLOCKS = ['dismissals', 'battingPositionGroups', 'boundaries', 'venues', 'wicketTypes', 'fielding', 'byInningsNumber']

// ---- Team stats ----

const coverage = (recorded: number, counted: number) => ({ recorded, counted })
const points: MyTeamResultPoint[] = [
  ['WON', 180, 6, 150, 10], ['LOST', 120, 10, 160, 5], ['WON', 200, 4, 100, 10], ['TIED', 140, 8, 140, 7], ['WON', 160, 5, 90, 10],
].map(([result, ownRuns, ownWickets, oppRuns, oppWickets], index) => ({
  matchId: `m${index + 1}`, matchDate: day(index + 1), opponentName: `Rovers ${index + 1}`, derby: false, forfeit: false,
  result: result as MyTeamResultPoint['result'], ownRuns: ownRuns as number, ownWickets: ownWickets as number, ownBalls: 240, oppRuns: oppRuns as number, oppWickets: oppWickets as number, oppBalls: 240, ownRunRate: 4.5, oppRunRate: 4,
}))

const types = (a: number, b: number) => [
  { type: 'BOWLED', label: 'Bowled', count: a, percent: 50 },
  { type: 'CAUGHT', label: 'Caught', count: b, percent: 50 },
]
const extrasSide = {
  total: 40, sharePercent: 10, inningsWithExtras: 5, inningsCounted: 5,
  wides: { value: 20, inningsRecorded: 5, inningsCounted: 5 }, noBalls: { value: 5, inningsRecorded: 5, inningsCounted: 5 },
  byes: { value: 8, inningsRecorded: 5, inningsCounted: 5 }, legByes: { value: 6, inningsRecorded: 5, inningsCounted: 5 }, penaltyRuns: { value: 1, inningsRecorded: 5, inningsCounted: 5 },
}

export function makeMyTeamStats(over: Partial<MyTeamStatsDto> = {}): MyTeamStatsDto {
  const page = makeTeamStats({ teamName: TEAM.name })
  return {
    scope: { seasonId: 's1', leagueId: null, teamId: 't1', competition: null },
    teamName: TEAM.name,
    basis: {
      ...page.basis, resultsCounted: 5, resultsWithBothInnings: 5, truncated: false, historyCap: 50,
      coverage: { battingOrder: coverage(5, 5), toss: coverage(5, 5), availability: coverage(5, 5), runCards: coverage(5, 5), wicketCards: coverage(5, 5), closeMargins: coverage(5, 5) },
    },
    record: page.record,
    form: page.form.map((entry) => ({ matchId: entry.matchId, matchDate: entry.matchDate, opponentName: entry.opponentName, derby: entry.derby, result: entry.result as MyTeamStatsDto['form'][number]['result'], forfeit: entry.forfeit })),
    batting: page.batting,
    chasing: page.chasing,
    bowling: page.bowling,
    extras: page.extras,
    netRunRate: page.netRunRate,
    series: {
      window: { pointLimit: 30, historyCap: 50 },
      results: points,
      resultsSummary: { played: 5, won: 3, lost: 1, tied: 1, drawn: 0, noResult: 0, wonPercent: 60, lostPercent: 20, tiedPercent: 20, drawnPercent: 0, noResultPercent: 0, forfeits: 0, totalPoints: 5, shown: 5, withRuns: 5 },
      runRateTrend: points.map((point) => ({ matchId: point.matchId, matchDate: point.matchDate, opponentName: point.opponentName, teamRunRate: 4.5, oppositionRunRate: 4 })),
      netRunRateTrend: { status: 'SHOWN', points: points.map((point) => ({ matchId: point.matchId, matchDate: point.matchDate, opponentName: point.opponentName, value: 0.5 })) },
      extrasConceded: points.map((point) => ({ matchId: point.matchId, matchDate: point.matchDate, opponentName: point.opponentName, derby: false, wides: 4, noBalls: 1, byes: 2, legByes: 1, penaltyRuns: 0, itemised: true, notItemised: 0, total: 8 })),
      extrasSummary: { matchesCounted: 5, matchesWithExtras: 5, matchesItemised: 5, totalPoints: 5, shown: 5, widesRecorded: 5, noBallsRecorded: 5, byesRecorded: 5, legByesRecorded: 5, penaltyRunsRecorded: 5 },
      dotBalls: [],
      dotBallsSummary: { matchesCounted: 5, matchesWithDots: 0, totalPoints: 0, shown: 0, averageDotPercent: null, recentAverage: null, earlierAverage: null, direction: null },
    },
    contribution: {
      runs: { total: 800, inningsWithCard: 5, inningsCounted: 5, lines: [{ kind: 'PLAYER', label: 'Sam Naidoo', value: 300, sharePercent: 37.5 }, { kind: 'PLAYER', label: 'Alex Rao', value: 200, sharePercent: 25 }, { kind: 'EXTRAS', label: 'Extras', value: 100, sharePercent: 12.5 }, { kind: 'OTHERS', label: 'Others', value: 200, sharePercent: 25 }] },
      wickets: { total: 30, inningsWithCard: 5, inningsCounted: 5, lines: [{ kind: 'PLAYER', label: 'Bo Khan', value: 12, sharePercent: 40 }, { kind: 'OTHERS', label: 'Others', value: 18, sharePercent: 60 }] },
    },
    battingOrder: { battingFirst: { played: 3, won: 2 }, chasing: { played: 2, won: 1 }, recorded: 5, counted: 5 },
    tossWon: { won: 3, known: 5, counted: 5, partly: false },
    headToHead: [{ opponentName: 'Rovers 1', played: 2, won: 1, lost: 1, tied: 0, drawn: 0, noResult: 0, results: [{ matchId: 'm1', matchDate: day(1), result: 'WON', forfeit: false }, { matchId: 'm9', matchDate: day(9), result: 'LOST', forfeit: false }] }],
    squad: { playersUsed: 14, guestAppearances: 1, averageAvailable: 12.4, matchesWithPoll: 5, counted: 5, partly: false },
    closeGames: { played: 2, won: 1, closeRuns: 1, closeWickets: 1, decided: 4, withMargin: 4 },
    extrasCard: { gaveAway: extrasSide, received: extrasSide, partly: false },
    notCaptured: [],
    dismissals: { notOut: 2, wickets: 30, types: types(15, 15), notRecorded: 0, coverage: coverage(5, 5) },
    battingPositionGroups: [
      { key: 'OPENER', label: 'Opener', innings: 10, runs: 300, sharePercent: 37.5, notOuts: 1, dismissals: 9, average: 33.3 },
      { key: '3', label: '3', innings: 5, runs: 150, sharePercent: 18.8, notOuts: 0, dismissals: 5, average: 30 },
    ],
    boundaries: { fours: 60, sixes: 12, boundaryRuns: 312, boundaryPercent: 39, ballsPerBoundary: 16.7, inningsRecorded: 5, inningsCounted: 5 },
    venues: [
      { venueKey: 'a1', name: 'Riverside Oval', home: true, matches: 3, won: 2, lost: 1, tied: 0, runsScored: 500, runsConceded: 420, wicketsTaken: 20, wicketsLost: 18 },
      { venueKey: 'a2', name: 'Hilltop Ground', home: false, matches: 2, won: 1, lost: 0, tied: 1, runsScored: 300, runsConceded: 240, wicketsTaken: 10, wicketsLost: 12 },
    ],
    wicketTypes: { total: 30, types: types(18, 12), notItemised: 0, coverage: coverage(5, 5) },
    fielding: {
      catches: 12, stumpings: 1, runOuts: 3, dismissals: 16, dismissalsPerMatch: 3.2,
      byFielder: [{ name: 'Lee Fox', catches: 5, stumpings: 0, runOuts: 1, total: 6 }, { name: 'Sam Naidoo', catches: 4, stumpings: 0, runOuts: 1, total: 5 }], others: 5, coverage: coverage(5, 5),
    },
    byInningsNumber: {
      first: { played: 3, won: 2, innings: 3, runs: 520, average: 28.9 },
      chasing: { played: 2, won: 1, innings: 2, runs: 280, average: 23.3 },
    },
    ...over,
  }
}

// ---- Leaderboards ----

export const BOARD_COLUMNS: MyLeaderboardColumn[] = [
  { code: 'runs', label: 'Runs', longLabel: 'Runs scored', sortable: true, direction: 'HIGHEST', minimumKind: 'NONE', more: false },
  { code: 'average', label: 'Avg', longLabel: 'Batting average', sortable: true, direction: 'HIGHEST', minimumKind: 'INNINGS', more: false },
  { code: 'fours', label: '4s', longLabel: 'Fours', sortable: true, direction: 'HIGHEST', minimumKind: 'NONE', more: true },
]
const cell = (value: number | null) => ({ value, runs: null, wickets: null, notOut: null })

export function boardRow(rank: number | null, firstName: string, over: Partial<MyLeaderboardRow> = {}): MyLeaderboardRow {
  return { rank, mine: false, firstName, lastName: 'Player', teamName: 'U14 A', smallSample: false, values: { runs: cell(200 - (rank ?? 9) * 10), average: cell(30 - (rank ?? 9)), fours: cell(10 - (rank ?? 9)) }, ...over }
}

export function makeBoardTable(over: Partial<MyLeaderboardTable> = {}): MyLeaderboardTable {
  const rows = [boardRow(1, 'Ann'), boardRow(2, 'Ben'), boardRow(3, 'Sam', { mine: true, lastName: 'Naidoo' }), boardRow(null, 'Zed', { smallSample: true })]
  return {
    group: 'BATTING',
    columns: BOARD_COLUMNS,
    sort: { code: 'runs', direction: 'HIGHEST' },
    scope: { seasonId: 's1', leagueId: null, teamId: null },
    minimum: { applies: true, value: 3, suggestedDefault: 3, unit: 'INNINGS' },
    basis: { resultsCounted: 12, playersListed: 4, playersRanked: 3, belowMinimum: 1, coverage: null },
    page: { number: 0, size: 25, totalElements: 4, hasMore: false },
    rows,
    me: { position: 3, page: 0, row: rows[2] },
    ...over,
  }
}

const line = (key: string, group: string, label: string, rank: number | null, value: number | null, over: Partial<MyStandingLine> = {}): MyStandingLine => ({
  key, group, label, rank, playersListed: 14, playersRanked: rank === null ? 12 : 14, value: value === null ? null : cell(value),
  sample: { matches: 7, innings: 6, ballsFaced: 190, balls: null, overs: null, ballsPerOver: null }, minimum: null, belowMinimum: false, ...over,
})

// Eight lines, the full "Where Sam stands" card: batting, bowling, fielding and awards, with a rate below the minimum.
export function makeStanding(over: Partial<MyStanding> = {}): MyStanding {
  return {
    scope: { seasonId: 's1', leagueId: null, teamId: null },
    playerFirstName: 'Sam',
    resultsCounted: 7,
    playersInReach: 14,
    lines: [
      line('runs', 'batting', 'Runs', 3, 158),
      line('average', 'batting', 'Batting average', 4, 31.6, { minimum: { unit: 'INNINGS', value: 3 } }),
      line('strikeRate', 'batting', 'Strike rate', 6, 83.2, { minimum: { unit: 'INNINGS', value: 3 } }),
      line('wickets', 'bowling', 'Wickets', 2, 7),
      line('economy', 'bowling', 'Economy', null, 4.8, { minimum: { unit: 'OVERS', value: 10 }, belowMinimum: true, playersRanked: 9 }),
      line('catches', 'fielding', 'Catches', 1, 4),
      line('playerOfTheMatch', 'awards', 'Player of the match', 2, 1),
      line('fours', 'batting', 'Fours', 5, 14),
    ],
    ...over,
  }
}

// ---- The match drill ----

export function drillRow(n: number, over: Partial<MyStatsInningsRow> = {}): MyStatsInningsRow {
  return {
    matchId: `m${n}`, matchDate: day(n), opponentName: `Rovers ${n}`, derby: false, ourTeamName: 'U14 A', result: 'WON',
    batting: { inningsNumber: 1, runs: 40 + n, balls: 50, fours: 4, sixes: 1, notOut: false, howOut: 'BOWLED', bowlerName: 'Alex Rao', strikeRate: 82 },
    bowling: null, fielding: null, ...over,
  }
}

export function drillPage(rows: MyStatsInningsRow[], number: number, hasMore: boolean, total = rows.length, over: Partial<MyStatsInningsPage> = {}): MyStatsInningsPage {
  return { kind: 'BATTING', filter: 'BAND_50', title: 'Batting innings', filterLabel: 'Scores of 50 or more', truncated: false, page: { number, size: 20, totalElements: total, hasMore }, rows, ...over }
}
