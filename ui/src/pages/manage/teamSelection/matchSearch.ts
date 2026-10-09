import type { TeamSelectionMatch } from '../../../api/teamSelectionApi'

// The hub's search text against a match: its label, league, and each club side's team and opponent. Empty matches all.
export function matchesSearch(match: TeamSelectionMatch, term: string): boolean {
  if (!term) return true
  const haystack = [match.label, match.leagueName, ...match.sides.flatMap((side) => [side.teamName, side.opponentName])]
  return haystack.some((text) => text?.toLowerCase().includes(term))
}
