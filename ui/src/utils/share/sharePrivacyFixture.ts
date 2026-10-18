import type { Match } from '../../api/matchApi'
import type { MatchResult, ResultPlayer, Scorecard } from '../../api/matchResultApi'
import { buildShareResultModel } from './shareResultData'
import type { ShareResultModel, TeamsChoice } from './shareResultData'

// docs/specs/114-share-result.md (Test Plan, privacy test): a fixed fixture with DISTINCTIVE full given names, including
// accented ones, a particle surname and guests, shared by the privacy test and the locked-state dialog test. Not
// production code.

// The full given names that must never appear with First names as initials on. None is a substring of any other text in the
// fixture (team, club, league, venue, sponsor names or the builders' own words).
export const GIVEN_NAMES = ['Mpho', 'Sibusiso', 'Émile', 'Zoë', 'Thabo', 'Pieter', 'Nomvula', 'Johan']
// Case-insensitive and accent-folded, as spec 108's privacy test matches.
export const fold = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
export const leakedGivenNames = (text: string): string[] => GIVEN_NAMES.filter((name) => fold(text).includes(fold(name)))

export const privacyMatch = {
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

export const privacyResult = {
  outcomeType: 'WON',
  decidedBy: 'REGULAR',
  winningSide: 'HOME',
  marginType: 'RUNS',
  marginValue: 24,
  ballsPerOver: 6,
  scheduledBalls: 240,
  tossWonBy: 'HOME',
  tossDecision: 'BAT',
  playingAreaName: null,
  hasScorecard: true,
  innings: [
    { sequence: 1, kind: 'REGULAR', battingSide: 'HOME', runs: 150, wickets: 6, balls: 240, extras: 8, wides: 5, byes: 3 },
    { sequence: 2, kind: 'REGULAR', battingSide: 'AWAY', runs: 126, wickets: 10, balls: 230, extras: 4 },
  ],
} as unknown as MatchResult

// The same match lost: the opposition won, so the Celebration template falls back to its neutral wording.
export const privacyLostResult = {
  ...privacyResult,
  winningSide: 'AWAY',
  marginType: 'RUNS',
  marginValue: 3,
  innings: [
    { sequence: 1, kind: 'REGULAR', battingSide: 'HOME', runs: 120, wickets: 10, balls: 240, extras: 8 },
    { sequence: 2, kind: 'REGULAR', battingSide: 'AWAY', runs: 123, wickets: 5, balls: 230, extras: 4 },
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

export function privacyScorecard(pomPlayerId: string | null = 'p1'): Scorecard {
  return {
    players: [
      player('p1', 'HOME', { playerProfileId: 'x1', firstName: 'Mpho', lastName: 'Naidoo', opposition: false }),
      player('p2', 'HOME', { playerProfileId: 'x2', firstName: 'Sibusiso', lastName: 'van der Westhuizen', opposition: false }),
      player('p3', 'HOME', { playerProfileId: 'x3', firstName: 'Émile', lastName: 'Öztürk', opposition: false }),
      player('p4', 'HOME', { playerProfileId: 'x4', firstName: 'Zoë', lastName: 'Müller', opposition: false }),
      player('o1', 'AWAY', { displayName: 'Thabo Mokoena', opposition: true }),
      player('o2', 'AWAY', { displayName: 'Pieter Botha', opposition: true }),
      player('o3', 'AWAY', { displayName: 'Nomvula Dlamini', opposition: true }),
      player('o4', 'AWAY', { displayName: 'Johan van Zyl', opposition: true }),
    ],
    batting: [
      { battingSide: 'HOME', resultPlayerId: 'p1', position: 1, howOut: 'CAUGHT', runs: 60, balls: 40, fours: 6, sixes: 1, bowlerPlayerId: 'o1', fielderPlayerId: 'o2' },
      { battingSide: 'HOME', resultPlayerId: 'p2', position: 2, howOut: 'NOT_OUT', runs: 30, balls: 30, fours: 2, sixes: 0 },
      { battingSide: 'HOME', resultPlayerId: 'p3', position: 3, howOut: 'BOWLED', runs: 12, balls: 15, bowlerPlayerId: 'o3' },
      { battingSide: 'HOME', resultPlayerId: 'p4', position: 4, howOut: 'STUMPED', runs: 8, balls: 12, bowlerPlayerId: 'o1', fielderPlayerId: 'o4' },
      { battingSide: 'AWAY', resultPlayerId: 'o1', position: 1, howOut: 'BOWLED', runs: 40, balls: 50, bowlerPlayerId: 'p2' },
      { battingSide: 'AWAY', resultPlayerId: 'o2', position: 2, howOut: 'CAUGHT', runs: 22, balls: 31, bowlerPlayerId: 'p4', fielderPlayerId: 'p3' },
      { battingSide: 'AWAY', resultPlayerId: 'o3', position: 3, howOut: 'LBW', runs: 5, balls: 9, bowlerPlayerId: 'p2' },
      { battingSide: 'AWAY', resultPlayerId: 'o4', position: 4, howOut: 'RUN_OUT', runs: 3, balls: 4, fielderPlayerId: 'p1' },
    ],
    bowling: [
      { battingSide: 'AWAY', resultPlayerId: 'p2', bowlingOrder: 1, balls: 24, maidens: 1, runs: 20, wickets: 3 },
      { battingSide: 'AWAY', resultPlayerId: 'p4', bowlingOrder: 2, balls: 18, maidens: 0, runs: 25, wickets: 1 },
      { battingSide: 'AWAY', resultPlayerId: 'p3', bowlingOrder: 3, balls: 12, maidens: 0, runs: 16, wickets: 0 },
      { battingSide: 'HOME', resultPlayerId: 'o1', bowlingOrder: 1, balls: 24, maidens: 0, runs: 30, wickets: 2 },
      { battingSide: 'HOME', resultPlayerId: 'o3', bowlingOrder: 2, balls: 18, maidens: 1, runs: 21, wickets: 1 },
    ],
    fielding: [],
    awards: pomPlayerId ? [{ awardType: 'PLAYER_OF_MATCH', side: pomPlayerId.startsWith('o') ? 'AWAY' : 'HOME', resultPlayerId: pomPlayerId }] : [],
  } as unknown as Scorecard
}

export interface PrivacyScenario {
  name: string
  result: MatchResult
  scorecard: Scorecard
}

// A win with our player of the match, a win with the opposition's, and a loss (the neutral Celebration wording).
export const PRIVACY_SCENARIOS: PrivacyScenario[] = [
  { name: 'win, our player of the match', result: privacyResult, scorecard: privacyScorecard('p1') },
  { name: 'win, their player of the match', result: privacyResult, scorecard: privacyScorecard('o1') },
  { name: 'loss', result: privacyLostResult, scorecard: privacyScorecard('p2') },
]

export function privacyModel(
  initialsOnly: boolean,
  options: { teamsChoice?: TeamsChoice; scenario?: PrivacyScenario } = {},
): ShareResultModel {
  const scenario = options.scenario ?? PRIVACY_SCENARIOS[0]
  return buildShareResultModel({
    match: privacyMatch,
    result: scenario.result,
    scorecard: scenario.scorecard,
    teamsChoice: options.teamsChoice ?? 'both',
    initialsOnly,
    clubName: 'Riverside CC',
    leagueName: 'Premier League',
  })
}
