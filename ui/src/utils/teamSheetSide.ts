import type { MatchSide } from '../api/matchSideApi'
import type { Team } from '../api/teamApi'
import type { SquadMember } from '../api/teamSquadApi'

// A resolved side ready to share, assembled by the host (useTeamSheetShare) from listMatchSides, listSquad and the club's teamsById
// map. `team` is always present, even for a free-text opponent side with no real Team record (the host passes a lightweight
// placeholder with a null logo); `teamName` is the single source of truth for the display name. Moved here from the retired
// teamSheetPdf.ts when docs/specs/131 replaced the team sheet dialog.
export interface TeamSheetSide {
  team: Team
  teamName: string
  side: MatchSide | undefined
  squad: SquadMember[]
}
