import type { Match } from '../api/matchApi'
import type { Innings, MatchResult } from '../api/matchResultApi'

// Shared fixtures for the match and result tests and stories (not production code): the club's own team is team-1 ("1st XI",
// home); the opposition is the free-text "Riverside Occasionals" (away). The pages' own test utils re-export these.
export function makeMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: 'match-1',
    clubId: 'club-1',
    homeTeamId: 'team-1',
    homeTeamName: null,
    awayTeamId: null,
    awayTeamName: 'Riverside Occasionals',
    leagueId: null,
    seasonId: 'season-1',
    matchDate: '2026-10-03T10:00:00Z',
    venue: 'Riverside Oval',
    active: true,
    homeSideAnnounced: false,
    awaySideAnnounced: false,
    homePickedCount: 0,
    awayPickedCount: null,
    playingXiSize: 11,
    polls: [],
    homeTeamLogoUrl: null,
    awayTeamLogoUrl: null,
    homeLeagueTeamId: null,
    awayLeagueTeamId: null,
    createdAt: '',
    updatedAt: '',
    updatedBy: null,
    ...overrides,
  }
}

export const innings = (
  sequence: number,
  battingSide: 'HOME' | 'AWAY',
  runs: number | null,
  wickets: number | null = 5,
  balls: number | null = 240,
): Innings => ({ sequence, kind: sequence <= 2 ? 'REGULAR' : 'SUPER_OVER', battingSide, runs, wickets, balls })

export function makeResult(overrides: Partial<MatchResult> = {}): MatchResult {
  return {
    id: 'result-1',
    clubId: 'club-1',
    matchId: 'match-1',
    status: 'PUBLISHED',
    detailLevel: 'SUMMARY',
    outcomeType: 'WON',
    decidedBy: 'REGULAR',
    winningSide: 'HOME',
    marginType: 'RUNS',
    marginValue: 24,
    dlsTarget: null,
    dlsRevisedBalls: null,
    scheduledBalls: 240,
    ballsPerOver: 6,
    tossWonBy: 'HOME',
    tossDecision: 'BAT',
    playingAreaId: null,
    playingAreaName: null,
    note: null,
    source: 'MANUAL',
    externalId: null,
    publishedAt: '2026-10-04T10:00:00Z',
    publishedBy: null,
    createdAt: '2026-10-04T09:00:00Z',
    updatedAt: '2026-10-04T09:30:00Z',
    updatedBy: null,
    innings: [innings(1, 'HOME', 200), innings(2, 'AWAY', 176, 9)],
    hasScorecard: false,
    ...overrides,
  }
}
