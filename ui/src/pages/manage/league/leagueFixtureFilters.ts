import type { Match } from '../../../api/matchApi'
import type { Team } from '../../../api/teamApi'
import { stageOf, tbcText } from '../../../utils/matchStages'

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
  // docs/specs/155: '' or absent = every stage, POOL_STAGE = pool matches only, otherwise that stage.
  stage?: string
}

export const POOL_STAGE = '__pool__'

// A real club team resolves its name by id; a free-text or league-team side uses the match's own name.
export function fixtureSideName(teamId: string | null, teamName: string | null, teamsById: Map<string, Team>): string {
  if (teamId) {
    return teamsById.get(teamId)?.name ?? 'Unknown team'
  }
  return teamName ?? 'TBC'
}

// docs/specs/155: a side as the schedule shows it. A TBC side reads "TBC: 3rd in the pool" and has no logo.
export function fixtureSide(
  match: Pick<Match, 'homeTeamId' | 'homeTeamName' | 'awayTeamId' | 'awayTeamName' | 'homePlaceholder' | 'awayPlaceholder'>,
  side: 'home' | 'away',
  teamsById: Map<string, Team>,
): { name: string; placeholder: boolean } {
  const placeholder = Boolean(side === 'home' ? match.homePlaceholder : match.awayPlaceholder)
  const teamId = side === 'home' ? match.homeTeamId : match.awayTeamId
  const teamName = side === 'home' ? match.homeTeamName : match.awayTeamName
  return placeholder ? { name: tbcText(teamName), placeholder: true } : { name: fixtureSideName(teamId, teamName, teamsById), placeholder: false }
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
    if (filters.stage) {
      const stage = stageOf(match)
      if (filters.stage === POOL_STAGE ? stage !== null : stage !== filters.stage) return false
    }
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
