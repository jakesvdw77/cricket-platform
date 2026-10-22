import type { PlayerDashboard, DashboardBattingInnings, DashboardBowlingMatch } from '../api/playerDashboardApi'
import type { TeamDashboard, TeamDashboardResult, TeamDashboardExtrasPoint, TeamDashboardDotBallsPoint } from '../api/teamDashboardApi'

// docs/specs/117-stats-dashboard.md: fixtures for the Overview tests. They carry the figures a server would send; a test asserts the
// client shows them as sent (nothing is computed in the UI), so the numbers here are deliberately not derivable from one another
// unless a test says so.

const instant = (day: number) => `2026-03-${String(day).padStart(2, '0')}T12:00:00Z`

export function makeInnings(n: number, over: Partial<DashboardBattingInnings> = {}): DashboardBattingInnings {
  return { matchId: `match-${n}`, resultId: `result-${n}`, matchDate: instant(n), opponentName: `Opponent ${n}`, derby: false, runs: 10 * n, balls: 8 * n, notOut: false, howOut: 'CAUGHT', ...over }
}

export function makeBowlingMatch(n: number, over: Partial<DashboardBowlingMatch> = {}): DashboardBowlingMatch {
  return { matchId: `match-${n}`, resultId: `result-${n}`, matchDate: instant(n), opponentName: `Opponent ${n}`, derby: false, balls: 24, ballsPerOver: 6, maidens: 1, runs: 20, wickets: n, economy: 5 + n / 10, ...over }
}

// A player with 3 innings (one not out), 3 bowled matches and 5 wickets, 4 of them itemised. The summary figures are the server's
// and intentionally differ from anything the three points would give.
export function makePlayerDashboard(over: Partial<PlayerDashboard> = {}): PlayerDashboard {
  return {
    playerId: 'player-1',
    scope: { kind: 'CLUB_VERIFIED', seasonId: null, leagueId: null, teamId: null, competition: null },
    basis: { matchesCounted: 3, resultsWithBattingCard: 3, resultsWithBowlingCard: 3 },
    window: { pointLimit: 30, historyCap: 300 },
    truncated: false,
    truncatedSince: null,
    battingInnings: [makeInnings(1), makeInnings(2, { runs: 56, balls: 40, notOut: true, howOut: 'NOT_OUT' }), makeInnings(3, { runs: null, balls: null, howOut: 'BOWLED' })],
    battingSummary: { inningsTotal: 3, shown: 3, notOuts: 1, runs: 412, averageRuns: 29.43 },
    dismissals: [
      { type: 'CAUGHT', label: 'Caught', count: 5, percent: 35.7 },
      { type: 'BOWLED', label: 'Bowled', count: 4, percent: 28.6 },
      { type: 'NOT_OUT', label: 'Not out', count: 3, percent: 21.4 },
    ],
    battingTrend: [
      { matchId: 'match-1', resultId: 'result-1', matchDate: instant(1), opponentName: 'Opponent 1', derby: false, cumulativeRuns: 10, cumulativeDismissals: 0, average: null },
      { matchId: 'match-2', resultId: 'result-2', matchDate: instant(2), opponentName: 'Opponent 2', derby: false, cumulativeRuns: 66, cumulativeDismissals: 1, average: 66 },
      { matchId: 'match-3', resultId: 'result-3', matchDate: instant(3), opponentName: 'Opponent 3', derby: false, cumulativeRuns: 412, cumulativeDismissals: 2, average: 29.43 },
    ],
    bowlingMatches: [makeBowlingMatch(1), makeBowlingMatch(2, { economy: null, balls: 0, runs: 0, wickets: 0 }), makeBowlingMatch(3, { balls: 22, wickets: 2, runs: 17 })],
    wicketTypes: {
      types: [
        { type: 'BOWLED', label: 'Bowled', count: 2, percent: 40 },
        { type: 'LBW', label: 'LBW', count: 2, percent: 40 },
        { type: 'CAUGHT', label: 'Caught', count: 0, percent: 0 },
      ],
      notItemised: { count: 1, percent: 20 },
      total: 5,
      itemised: 4,
      coverage: { wicketsItemised: 4, wicketsTotal: 5, inningsItemised: 2, inningsWithWickets: 3 },
    },
    economySummary: { overallEconomy: 5.8, matchesCounted: 3, matchesWithEconomy: 2, totalPoints: 3, shown: 3, recentEconomy: 5.1, earlierEconomy: 6, direction: 'DOWN' },
    notCaptured: [],
    ...over,
  }
}

export const emptyPlayerDashboard = (): PlayerDashboard =>
  makePlayerDashboard({
    basis: { matchesCounted: 0, resultsWithBattingCard: 0, resultsWithBowlingCard: 0 },
    battingInnings: [],
    battingSummary: { inningsTotal: 0, shown: 0, notOuts: 0, runs: 0, averageRuns: null },
    dismissals: [],
    battingTrend: [],
    bowlingMatches: [],
    wicketTypes: { types: [], notItemised: { count: 0, percent: null }, total: 0, itemised: 0, coverage: { wicketsItemised: 0, wicketsTotal: 0, inningsItemised: 0, inningsWithWickets: 0 } },
    economySummary: { overallEconomy: null, matchesCounted: 0, matchesWithEconomy: 0, totalPoints: 0, shown: 0, recentEconomy: null, earlierEconomy: null, direction: null },
  })

// ---- team ----

export function makeTeamResult(n: number, over: Partial<TeamDashboardResult> = {}): TeamDashboardResult {
  return {
    matchId: `match-${n}`, resultId: `result-${n}`, matchDate: instant(n), opponentName: `Opponent ${n}`, derby: false, forfeit: false, result: 'WON',
    ownRuns: 150 + n, ownWickets: 6, ownBalls: 240, oppRuns: 120 + n, oppWickets: 10, oppBalls: 200, ownRunRate: 4.5, oppRunRate: 3.6, ...over,
  }
}

export function makeExtrasPoint(n: number, over: Partial<TeamDashboardExtrasPoint> = {}): TeamDashboardExtrasPoint {
  return {
    matchId: `match-${n}`, resultId: `result-${n}`, matchDate: instant(n), opponentName: `Opponent ${n}`, derby: false,
    wides: 4, noBalls: 1, byes: 2, legByes: 3, penaltyRuns: 0, itemised: true, notItemised: null, total: 10, ...over,
  }
}

export function makeDotsPoint(n: number, over: Partial<TeamDashboardDotBallsPoint> = {}): TeamDashboardDotBallsPoint {
  return { matchId: `match-${n}`, resultId: `result-${n}`, matchDate: instant(n), opponentName: `Opponent ${n}`, derby: false, ballsBowled: 120, dots: 48, dotPercent: 40, ...over }
}

// A team with 4 results, 4 extras points (one total-only, one with nothing recorded), 3 dots points (one not recorded).
export function makeTeamDashboard(over: Partial<TeamDashboard> = {}): TeamDashboard {
  return {
    teamId: 'team-1',
    teamName: 'Villagers 1',
    scope: { kind: 'CLUB_VERIFIED', seasonId: null, leagueId: null, competition: null },
    basis: { resultsCounted: 14, internalResults: 0, resultsNoBallBowled: 0, forfeits: { received: 0, conceded: 0 }, resultsWithBothInnings: 14 },
    window: { pointLimit: 30, historyCap: 300 },
    truncated: false,
    truncatedSince: null,
    results: [
      makeTeamResult(1),
      makeTeamResult(2, { result: 'LOST', ownRuns: 100, oppRuns: 130 }),
      makeTeamResult(3, { result: 'WON', forfeit: true, ownRuns: null, ownWickets: null, oppRuns: null, oppWickets: null, ownBalls: null, oppBalls: null, ownRunRate: null, oppRunRate: null }),
      makeTeamResult(4, { result: 'DRAWN', derby: true, opponentName: null }),
    ],
    resultsSummary: {
      played: 14, won: 9, lost: 4, tied: 1, drawn: 0, noResult: 0,
      wonPercent: 64.3, lostPercent: 28.6, tiedPercent: 7.1, drawnPercent: 0, noResultPercent: 0,
      forfeits: 1, totalPoints: 4, shown: 4, withRuns: 3,
    },
    runRateTrend: [
      { matchId: 'match-1', resultId: 'result-1', matchDate: instant(1), opponentName: 'Opponent 1', teamRunRate: 4.5, oppositionRunRate: 3.6 },
      { matchId: 'match-2', resultId: 'result-2', matchDate: instant(2), opponentName: 'Opponent 2', teamRunRate: 4.25, oppositionRunRate: null },
    ],
    netRunRateTrend: { status: 'SHOWN', points: [{ matchId: 'match-1', resultId: 'result-1', matchDate: instant(1), opponentName: 'Opponent 1', value: 0.9 }, { matchId: 'match-2', resultId: 'result-2', matchDate: instant(2), opponentName: 'Opponent 2', value: 0.84 }] },
    extrasConceded: [
      makeExtrasPoint(1),
      makeExtrasPoint(2, { wides: null, byes: null, total: 7 }),
      makeExtrasPoint(3, { wides: null, noBalls: null, byes: null, legByes: null, penaltyRuns: null, itemised: false, notItemised: 12, total: 12 }),
      makeExtrasPoint(4, { wides: null, noBalls: null, byes: null, legByes: null, penaltyRuns: null, itemised: false, total: null }),
    ],
    extrasSummary: { matchesCounted: 14, matchesWithExtras: 3, matchesItemised: 2, totalPoints: 4, shown: 4, widesRecorded: 2, noBallsRecorded: 2, byesRecorded: 1, legByesRecorded: 2, penaltyRunsRecorded: 2 },
    dotBalls: [makeDotsPoint(1), makeDotsPoint(2, { dotPercent: 33.3, dots: 40 }), makeDotsPoint(3, { ballsBowled: null, dots: null, dotPercent: null })],
    dotBallsSummary: { matchesCounted: 14, matchesWithDots: 2, totalPoints: 3, shown: 3, averageDotPercent: 36.7, recentAverage: 38.2, earlierAverage: 33.9, direction: 'UP' },
    notCaptured: [],
    ...over,
  }
}
