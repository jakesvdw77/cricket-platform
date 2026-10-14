import type { Match } from '../../../api/matchApi'
import type { Innings, MatchResult } from '../../../api/matchResultApi'
import type { Page } from '../../../api/productApi'
import { makeMatch } from '../matches/matchTestUtils'

// Shared fixtures for the 100 results tests (not production code). The club's own team is team-1 ("1st XI", home);
// the opposition is the free-text "Riverside Occasionals" (away).
export { makeMatch, makeTeam, makeTeams } from '../matches/matchTestUtils'

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

export function makeListItem(matchOverrides: Partial<Match> = {}, resultOverrides: Partial<MatchResult> = {}) {
  const match = makeMatch({ id: 'match-1', ...matchOverrides })
  return { match, result: makeResult({ matchId: match.id, ...resultOverrides }), playerOfTheMatch: null }
}

export function makePage<T>(content: T[], overrides: Partial<Page<T>> = {}): Page<T> {
  return { content, totalElements: content.length, totalPages: 1, number: 0, size: 20, ...overrides }
}
