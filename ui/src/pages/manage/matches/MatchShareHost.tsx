import { useEffect } from 'react'
import type { Match } from '../../../api/matchApi'
import type { Team } from '../../../api/teamApi'
import type { League } from '../../../api/leagueApi'
import type { Season } from '../../../api/seasonApi'
import { useTeamSheetShare } from './useTeamSheetShare'

export interface MatchShareHostProps {
  clubId: string
  match: Match
  teamsById: Map<string, Team>
  leaguesById: Map<string, League>
  seasonsById: Map<string, Season>
}

// docs/specs/131: mounts already open, for a page that has a match in hand but not a hook per row (the league Schedule table).
// Each Share click renders a fresh host (keyed by the click) so it opens afresh and re-reads the current sides.
export function MatchShareHost({ clubId, match, teamsById, leaguesById, seasonsById }: MatchShareHostProps) {
  const { openShare, shareDialog } = useTeamSheetShare({ clubId, match, teamsById, leaguesById, seasonsById })
  useEffect(() => {
    openShare()
    // Once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return <>{shareDialog}</>
}
