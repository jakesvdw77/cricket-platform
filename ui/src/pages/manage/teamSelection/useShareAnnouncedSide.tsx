import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Alert } from '@mui/material'
import { getMatch } from '../../../api/matchApi'
import type { Match } from '../../../api/matchApi'
import { listTeamsForClub } from '../../../api/teamApi'
import type { Team } from '../../../api/teamApi'
import { listLeagues } from '../../../api/leagueApi'
import type { League } from '../../../api/leagueApi'
import { listSeasons } from '../../../api/seasonApi'
import type { Season } from '../../../api/seasonApi'
import type { TeamSheetPrintScope } from '../../../components/TeamSheetCommunicationDialog'
import { useTeamSheetShare } from '../matches/useTeamSheetShare'

interface ShareTarget {
  matchId: string
  scope: TeamSheetPrintScope
  // Bumped on every click so the host remounts and opens afresh, re-reading the current sides.
  nonce: number
}

interface HostProps {
  clubId: string
  match: Match
  scope: TeamSheetPrintScope
  teams: Team[]
  leagues: League[]
  seasons: Season[]
}

// Mounts already open: useTeamSheetShare needs a full Match and the lookup maps up front, so the host is only rendered
// once they are loaded. The hook's own queries are enabled on open and refetch (stale by default) on each new mount,
// so the dialog reads the current sides after a reorder or un-announce.
function ShareHost({ clubId, match, scope, teams, leagues, seasons }: HostProps) {
  const teamsById = useMemo(() => new Map(teams.map((team): [string, Team] => [team.id, team])), [teams])
  const leaguesById = useMemo(() => new Map(leagues.map((league): [string, League] => [league.id, league])), [leagues])
  const seasonsById = useMemo(() => new Map(seasons.map((season): [string, Season] => [season.id, season])), [seasons])
  const { openShare, shareDialog } = useTeamSheetShare({ clubId, match, teamsById, leaguesById, seasonsById, initialScope: scope })
  useEffect(() => {
    openShare()
    // Once, on mount: each Share click mounts a fresh host (keyed by the click).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return <>{shareDialog}</>
}

export interface ShareAnnouncedSide {
  // Opens the team sheet dialog for one announced side of a match (home = the match's home side).
  share: (matchId: string, home: boolean) => void
  // The match whose Share is loading its data, to disable that button meanwhile.
  loadingMatchId: string | null
  // Render once in the page: the dialog and any load error.
  dialog: ReactNode
}

// docs/specs/030-team-sheet-communication.md, used by docs/specs/093-team-selection-hub.md: Share for an announced side on
// the Team selection pages. The hub's overview rows are not a Match, so the Match is fetched by id when Share is clicked
// (the Select team page already holds it under the same key), together with the club's teams, leagues and seasons.
// Nothing is fetched until then.
export function useShareAnnouncedSide(clubId: string): ShareAnnouncedSide {
  const [target, setTarget] = useState<ShareTarget | null>(null)
  const enabled = target !== null
  const matchQuery = useQuery({
    queryKey: ['managed-club', clubId, 'matches', target?.matchId],
    queryFn: () => getMatch(clubId, target?.matchId as string),
    enabled,
  })
  const teamsQuery = useQuery({ queryKey: ['managed-club', clubId, 'teams'], queryFn: () => listTeamsForClub(clubId), enabled })
  const leaguesQuery = useQuery({ queryKey: ['managed-club', clubId, 'leagues'], queryFn: () => listLeagues(clubId), enabled })
  const seasonsQuery = useQuery({ queryKey: ['managed-club', clubId, 'seasons'], queryFn: () => listSeasons(clubId), enabled })

  const queries = [matchQuery, teamsQuery, leaguesQuery, seasonsQuery]
  const failed = enabled && queries.some((query) => query.isError)
  const ready = enabled && queries.every((query) => query.data !== undefined)

  return {
    share: (matchId, home) => setTarget((previous) => ({ matchId, scope: home ? 'home' : 'away', nonce: (previous?.nonce ?? 0) + 1 })),
    loadingMatchId: target && !ready && !failed ? target.matchId : null,
    dialog: (
      <>
        {failed && <Alert severity="error">Couldn't load the team sheet. Please try again.</Alert>}
        {ready && target && matchQuery.data && (
          <ShareHost
            key={target.nonce}
            clubId={clubId}
            match={matchQuery.data}
            scope={target.scope}
            teams={teamsQuery.data ?? []}
            leagues={leaguesQuery.data ?? []}
            seasons={seasonsQuery.data ?? []}
          />
        )}
      </>
    ),
  }
}
