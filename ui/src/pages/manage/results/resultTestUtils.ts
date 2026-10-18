import type { Match } from '../../../api/matchApi'
import type { MatchResult } from '../../../api/matchResultApi'
import type { Page } from '../../../api/productApi'
import { makeMatch, makeResult } from '../../../test/resultFixtures'

// Shared fixtures for the 100 results tests (not production code). The club's own team is team-1 ("1st XI", home);
// the opposition is the free-text "Riverside Occasionals" (away).
export { makeTeam, makeTeams } from '../matches/matchTestUtils'
export { innings, makeMatch, makeResult } from '../../../test/resultFixtures'

export function makeListItem(matchOverrides: Partial<Match> = {}, resultOverrides: Partial<MatchResult> = {}) {
  const match = makeMatch({ id: 'match-1', ...matchOverrides })
  return { match, result: makeResult({ matchId: match.id, ...resultOverrides }), playerOfTheMatch: null }
}

export function makePage<T>(content: T[], overrides: Partial<Page<T>> = {}): Page<T> {
  return { content, totalElements: content.length, totalPages: 1, number: 0, size: 20, ...overrides }
}
