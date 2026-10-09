import type { Match } from '../../../api/matchApi'
import type { Team } from '../../../api/teamApi'

export interface FixtureFilters {
  // A club team id or a league team id; matches that have it as either side are kept.
  teamId: string | null
  search: string
  // Keep only matches with a side that is one of the club's own teams.
  onlyOurs: boolean
  // false (the default) hides matches before the start of today.
  showPlayed: boolean
  // The start of today; a parameter so the rule is testable.
  today: Date
}

// A real club team resolves its name by id; a free-text or league-team side uses the match's own name.
export function fixtureSideName(teamId: string | null, teamName: string | null, teamsById: Map<string, Team>): string {
  if (teamId) {
    return teamsById.get(teamId)?.name ?? 'Unknown team'
  }
  return teamName ?? 'TBC'
}

// A match is "ours" when either side is one of the club's own teams.
export function isOurMatch(match: Pick<Match, 'homeTeamId' | 'awayTeamId'>): boolean {
  return Boolean(match.homeTeamId || match.awayTeamId)
}

// docs/specs/091 (C): the Schedule tab's client-side filters over the season's matches (already fetched whole). Search
// looks at both team names and the venue.
export function filterFixtures(matches: Match[], filters: FixtureFilters, teamsById: Map<string, Team>): Match[] {
  const term = filters.search.trim().toLowerCase()
  const startOfToday = new Date(filters.today.getFullYear(), filters.today.getMonth(), filters.today.getDate()).getTime()
  return matches.filter((match) => {
    if (!filters.showPlayed && new Date(match.matchDate).getTime() < startOfToday) return false
    if (filters.onlyOurs && !isOurMatch(match)) return false
    if (
      filters.teamId &&
      ![match.homeTeamId, match.awayTeamId, match.homeLeagueTeamId, match.awayLeagueTeamId].includes(filters.teamId)
    ) {
      return false
    }
    if (term) {
      const haystack = [
        fixtureSideName(match.homeTeamId, match.homeTeamName, teamsById),
        fixtureSideName(match.awayTeamId, match.awayTeamName, teamsById),
        match.venue ?? '',
      ]
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(term)) return false
    }
    return true
  })
}
