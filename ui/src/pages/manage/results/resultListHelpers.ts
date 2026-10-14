import type { Match } from '../../../api/matchApi'
import type { MatchResult, ResultSide } from '../../../api/matchResultApi'
import type { Team } from '../../../api/teamApi'
import type { OwnSides, ResultPerspective } from '../../../utils/resultLine'
import { sideName } from '../matches/matchCardHelpers'
import type { SideLogo } from '../matches/teamLogoHelpers'
import { logoFor } from '../matches/teamLogoHelpers'

// docs/specs/100-match-results-core.md: small pure helpers shared by the Results card and list view.

// Where a result opens. The result page and the capture wizard arrive in later slices; every link is built here so the
// route is changed in one place.
export const resultViewTo = (matchId: string) => `/manage/results/${matchId}`
export const resultEditTo = (matchId: string) => `/manage/results/${matchId}`

export const UNPUBLISH_TO_EDIT_REASON = 'Unpublish to edit'

// A side is the club's own when it is one of the club's teams (the Teams list holds only the club's teams).
export function ownSidesOf(match: Pick<Match, 'homeTeamId' | 'awayTeamId'>, teamsById: Map<string, Team>): OwnSides {
  return {
    home: Boolean(match.homeTeamId && teamsById.has(match.homeTeamId)),
    away: Boolean(match.awayTeamId && teamsById.has(match.awayTeamId)),
  }
}

export interface ResultSideInfo {
  side: ResultSide
  name: string
  logo: SideLogo
}

export function resultSides(match: Match, teamsById: Map<string, Team>): [ResultSideInfo, ResultSideInfo] {
  const home = sideName(match.homeTeamId, match.homeTeamName, teamsById)
  const away = sideName(match.awayTeamId, match.awayTeamName, teamsById)
  return [
    { side: 'HOME', name: home, logo: logoFor(match.homeTeamId, match.homeTeamLogoUrl, home, teamsById) },
    { side: 'AWAY', name: away, logo: logoFor(match.awayTeamId, match.awayTeamLogoUrl, away, teamsById) },
  ]
}

// "Irene Villagers 1 won the toss and chose to bat", or null when no toss is recorded.
export function tossLine(
  result: Pick<MatchResult, 'tossWonBy' | 'tossDecision'>,
  names: { home: string; away: string },
): string | null {
  if (!result.tossWonBy) return null
  const team = result.tossWonBy === 'HOME' ? names.home : names.away
  if (!result.tossDecision) return `${team} won the toss`
  return `${team} won the toss and chose to ${result.tossDecision === 'BAT' ? 'bat' : 'bowl'}`
}

// The result line's colour from the club team's point of view: won green, lost red, anything else plain text.
export const PERSPECTIVE_COLOR: Record<ResultPerspective, string> = {
  won: 'success.main',
  lost: 'error.main',
  neutral: 'text.primary',
}
