import type { Team } from '../api/teamApi'
import type { TeamCardData } from '../hooks/useTeamCardData'

export type TeamFocus = 'active' | 'no-captain' | 'empty'

export interface TeamCounters {
  // Active teams among the shown ones.
  active: number
  // Sum of the squad sizes of the shown teams for the chosen season.
  players: number
  // Sum of the shown teams' matches from today to today + 7 days.
  matchesThisWeek: number
  // Active teams with no captain / an empty squad. An inactive (retired) team never needs attention.
  noCaptain: number
  emptySquads: number
  // False until every shown team's squad and the season's matches have loaded; the figures built from them are not
  // final before that.
  loaded: boolean
}

// docs/specs/092-teams-gold-standard.md (A): the Teams page's counters, computed client-side over the shown teams (after
// the Section filter and Show inactive, before search) from the data the cards already load (useTeamCardData). No endpoint.
export function teamCounters(teams: Team[], cardData: Record<string, TeamCardData>): TeamCounters {
  const counters: TeamCounters = { active: 0, players: 0, matchesThisWeek: 0, noCaptain: 0, emptySquads: 0, loaded: true }
  teams.forEach((team) => {
    const data = cardData[team.id]
    if (team.active) {
      counters.active += 1
    }
    if (!data?.loaded) {
      counters.loaded = false
      return
    }
    counters.players += data.playerCount
    counters.matchesThisWeek += data.matchesThisWeek
    if (team.active && data.captainName === null) {
      counters.noCaptain += 1
    }
    if (team.active && data.playerCount === 0) {
      counters.emptySquads += 1
    }
  })
  return counters
}

// Whether a team belongs to the list for a quick filter (the counters' cards). A team whose data has not loaded does not
// match the two attention filters.
export function matchesTeamFocus(team: Team, data: TeamCardData | undefined, focus: TeamFocus): boolean {
  switch (focus) {
    case 'active':
      return team.active
    case 'no-captain':
      return team.active && Boolean(data?.loaded) && data?.captainName === null
    case 'empty':
      return team.active && Boolean(data?.loaded) && data?.playerCount === 0
  }
}
