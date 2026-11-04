import type { TeamSelectionMatch } from '../../../api/teamSelectionApi'

// docs/specs/137: the date sort the Matches and Time Slots tabs share (like the Availability Polls and the Seasons list): Soonest First
// (the order the overview arrives in) or Latest First.
export type MatchSort = 'asc' | 'desc'

export const MATCH_SORT_OPTIONS = [
  { value: 'asc', label: 'Soonest First', linkLabel: 'Soonest First' },
  { value: 'desc', label: 'Latest First', linkLabel: 'Latest First' },
]

export function sortMatchesByDate(matches: TeamSelectionMatch[], sort: MatchSort): TeamSelectionMatch[] {
  const direction = sort === 'desc' ? -1 : 1
  return [...matches].sort((a, b) => direction * (new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime()))
}
