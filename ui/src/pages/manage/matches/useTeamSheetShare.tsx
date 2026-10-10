import { useState } from 'react'
import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { TeamSheetCommunicationDialog } from '../../../components/TeamSheetCommunicationDialog'
import type { TeamSheetPrintScope } from '../../../components/TeamSheetCommunicationDialog'
import type { Match } from '../../../api/matchApi'
import type { Team } from '../../../api/teamApi'
import type { League } from '../../../api/leagueApi'
import type { Season } from '../../../api/seasonApi'
import { listMatchSides } from '../../../api/matchSideApi'
import { listSquad } from '../../../api/teamSquadApi'
import { matchFields } from '../../../utils/matchRecordFields'
import { generateTeamSheetPdf } from '../../../utils/teamSheetPdf'
import type { TeamSheetSide } from '../../../utils/teamSheetPdf'
import { sideName } from './matchCardHelpers'

// A lightweight stand-in Team for a free-text opponent side (no real Team record exists) — only
// `logoUrl`/`name` are ever read from a TeamSheetSide's `team` by teamSheetPdf.ts/
// TeamSheetCommunicationDialog, both of which prefer `teamName` for display anyway.
function placeholderTeam(clubId: string, name: string): Team {
  return {
    id: '',
    clubId,
    sectionId: '',
    name,
    logoUrl: null,
    abbreviation: null,
    groundName: null,
    socialLinks: [],
    active: true,
    createdAt: '',
    updatedAt: '',
    updatedBy: null,
  }
}

export interface UseTeamSheetShareArgs {
  clubId: string
  match: Match
  teamsById: Map<string, Team>
  leaguesById: Map<string, League>
  seasonsById: Map<string, Season>
  // Start the dialog on one side (the Team selection pages share a single announced side).
  initialScope?: TeamSheetPrintScope
}

export interface TeamSheetShare {
  openShare: () => void
  shareDialog: ReactNode
}

// docs/specs/030-team-sheet-communication.md, extracted by docs/specs/075-match-view-and-edit.md:
// the Team Sheet data-fetching and dialog wiring shared by the match card and the Match View page.
// The data-fetching lives in the host (the codebase's presentational-dialog convention). Every
// query is `enabled: dialogOpen` so nothing fires until the admin actually opens the dialog; the
// keys are the ones the card and view page already use, so an already-cached entry is reused.
export function useTeamSheetShare({
  clubId,
  match,
  teamsById,
  leaguesById,
  seasonsById,
  initialScope,
}: UseTeamSheetShareArgs): TeamSheetShare {
  const [dialogOpen, setDialogOpen] = useState(false)

  const homeTeamName = sideName(match.homeTeamId, match.homeTeamName, teamsById)
  const awayTeamName = sideName(match.awayTeamId, match.awayTeamName, teamsById)

  const sidesQuery = useQuery({
    queryKey: ['managed-club', clubId, 'matches', match.id, 'sides'],
    queryFn: () => listMatchSides(clubId, match.id),
    enabled: dialogOpen,
  })

  // Same query-key shape as MatchFormPage.tsx's MatchSideTab, so both share one cache entry per
  // team/season squad rather than each maintaining its own copy.
  const homeSquadQuery = useQuery({
    queryKey: ['managed-club', clubId, 'teams', match.homeTeamId as string, 'seasons', match.seasonId, 'squad'],
    queryFn: () => listSquad(clubId, match.homeTeamId as string, match.seasonId),
    enabled: dialogOpen && Boolean(match.homeTeamId),
  })

  const awaySquadQuery = useQuery({
    queryKey: ['managed-club', clubId, 'teams', match.awayTeamId as string, 'seasons', match.seasonId, 'squad'],
    queryFn: () => listSquad(clubId, match.awayTeamId as string, match.seasonId),
    enabled: dialogOpen && Boolean(match.awayTeamId),
  })

  const sidesLoading =
    dialogOpen &&
    (sidesQuery.isLoading ||
      (Boolean(match.homeTeamId) && homeSquadQuery.isLoading) ||
      (Boolean(match.awayTeamId) && awaySquadQuery.isLoading))

  // A fixed 2-tuple (home, then away) — TeamSheetCommunicationDialog's own prop type relies on
  // this exact order/length, per its "index 0 is home, index 1 is away" invariant.
  const teamSheetSides: [TeamSheetSide, TeamSheetSide] = [
    {
      team: (match.homeTeamId && teamsById.get(match.homeTeamId)) || placeholderTeam(clubId, homeTeamName),
      teamName: homeTeamName,
      side: sidesQuery.data?.find((side) => side.teamId === match.homeTeamId),
      squad: homeSquadQuery.data ?? [],
    },
    {
      team: (match.awayTeamId && teamsById.get(match.awayTeamId)) || placeholderTeam(clubId, awayTeamName),
      teamName: awayTeamName,
      side: sidesQuery.data?.find((side) => side.teamId === match.awayTeamId),
      squad: awaySquadQuery.data ?? [],
    },
  ]

  const subtitle = matchFields(match, leaguesById, seasonsById)
    .map((field) => String(field.value))
    .join(' · ')

  const handlePrint = async (scope: TeamSheetPrintScope) => {
    const filteredSides =
      scope === 'both' ? teamSheetSides : scope === 'home' ? [teamSheetSides[0]] : [teamSheetSides[1]]
    const url = await generateTeamSheetPdf(match, filteredSides, subtitle)
    window.open(url, '_blank')
  }

  const shareDialog = (
    <TeamSheetCommunicationDialog
      open={dialogOpen}
      onClose={() => setDialogOpen(false)}
      match={match}
      sides={teamSheetSides}
      sidesLoading={Boolean(sidesLoading)}
      onPrint={handlePrint}
      subtitle={subtitle}
      initialScope={initialScope}
    />
  )

  return { openShare: () => setDialogOpen(true), shareDialog }
}
