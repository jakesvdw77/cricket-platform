import { useOutletContext } from 'react-router-dom'
import type { League } from '../../../api/leagueApi'
import type { Season } from '../../../api/seasonApi'
import type { Team } from '../../../api/teamApi'
import type { LeagueAffiliation } from '../../../api/leagueAffiliationApi'
import type { LeagueTeam } from '../../../api/leagueTeamApi'

// docs/specs/072-league-view-pages.md section 2: what LeagueViewLayout owns and hands to the three
// views through its <Outlet context>. `clubId` is forwarded because a nested Outlet context
// replaces ManagerHome's own.
export interface LeagueViewContext {
  clubId: string
  leagueId: string
  league: League
  seasons: Season[]
  selectedSeasonId: string
  seasonLabel: string
  teamsById: Map<string, Team>
  affiliationsForSeason: LeagueAffiliation[]
  activeLeagueTeams: LeagueTeam[]
  // True while the affiliations, club teams or league teams are still loading, so a view does not
  // show an empty state for data that has not arrived.
  isLoadingTeams: boolean
}

export function useLeagueView(): LeagueViewContext {
  return useOutletContext<LeagueViewContext>()
}
