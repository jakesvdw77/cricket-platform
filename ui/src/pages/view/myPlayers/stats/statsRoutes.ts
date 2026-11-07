import type { DrillTarget } from '../../../../components/StatsCards'
import type { MyResultScope } from '../../../../api/meResultsApi'
import { hubPath } from '../hubNav'
import { resultPath } from '../resultsFormat'

// docs/specs/147: the addresses of the My stats page, its match drill and the Hub Result page opened from it. The stats origin and the
// scope live in the address, so the footer Back (hubBack) returns to the same page and scope. No React.

export const STATS_ORIGIN = 'stats'
export const TEAM_STATS_ORIGIN = 'team-stats'

// The scope as a query string without the "?". Season is written even when it is All (as `all`), because an absent season would mean the
// current season on the page the link returns to.
export function statsScopeQuery(scope: MyResultScope): string {
  const query = new URLSearchParams()
  query.set('season', scope.seasonId ?? 'all')
  if (scope.teamId) query.set('team', scope.teamId)
  if (scope.leagueId) query.set('league', scope.leagueId)
  if (scope.competition) query.set('competition', scope.competition)
  return query.toString()
}

export const myStatsPath = (playerKey: string, scope?: string): string => `${hubPath(playerKey, 'stats', 'mine')}${scope ? `?${scope}` : ''}`

// A match page opened from My stats: Back says "Back to My Stats" and restores the scope.
export const statsResultPath = (playerKey: string, matchId: string, scope: string): string => resultPath(playerKey, matchId, `${scope}&origin=${STATS_ORIGIN}`)

export const teamStatsPath = (playerKey: string, scope?: string): string => `${hubPath(playerKey, 'stats', 'teams')}${scope ? `?${scope}` : ''}`

// A match page opened from Team stats: Back says "Back to Team Stats" and restores the scope.
export const teamStatsResultPath = (playerKey: string, matchId: string, scope: string): string => resultPath(playerKey, matchId, `${scope}&origin=${TEAM_STATS_ORIGIN}`)

// The drill sub-view for a tile, band or slice (stats/mine/innings): the server's kind and filter tokens plus the scope.
export function statsDrillPath(playerKey: string, target: DrillTarget, scope: string): string {
  const query = new URLSearchParams(scope)
  query.set('kind', target.kind)
  if (target.filter) query.set('filter', target.filter)
  return `${hubPath(playerKey, 'stats', 'mine')}/innings?${query.toString()}`
}

// The drill's own scope, read back from the address (an absent or `all` season is All Seasons).
export function scopeFromSearch(search: URLSearchParams): MyResultScope {
  const season = search.get('season')
  const competition = search.get('competition')
  return {
    seasonId: season && season !== 'all' ? season : null,
    teamId: search.get('team') || null,
    leagueId: search.get('league') || null,
    competition: competition === 'FRIENDLY' || competition === 'LEAGUE' ? competition : null,
  }
}
