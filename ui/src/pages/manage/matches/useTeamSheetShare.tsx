import { useState } from 'react'
import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Backdrop, CircularProgress, Typography } from '@mui/material'
import { ShareMatchDialog } from '../../../components/ShareMatchDialog'
import { ShareResultDialog } from '../../../components/ShareResultDialog'
import { getMatchResult, resultKeys } from '../../../api/matchResultApi'
import type { MatchContent } from '../../../utils/share/matchShareFormats'
import type { Match } from '../../../api/matchApi'
import type { Team } from '../../../api/teamApi'
import type { League } from '../../../api/leagueApi'
import type { Season } from '../../../api/seasonApi'
import { listMatchSides } from '../../../api/matchSideApi'
import { listSquad } from '../../../api/teamSquadApi'
import type { TeamSheetSide } from '../../../utils/teamSheetSide'
import { sideName } from './matchCardHelpers'

// A lightweight stand-in Team for a free-text opponent side (no real Team record exists) — only
// `logoUrl`/`name` are ever read from a TeamSheetSide's `team` by the retired team sheet PDF/
// the share model, which prefers `teamName` for display anyway.
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

// A match page or card side: the home or the away team of the match.
export type TeamSheetScope = 'home' | 'away'

export interface ShareOpenOptions {
  content?: MatchContent
  // The side a team panel or Team selection row is about; mapped to Our Side or Opposition.
  scope?: TeamSheetScope
}

export interface UseTeamSheetShareArgs {
  clubId: string
  match: Match
  teamsById: Map<string, Team>
  leaguesById: Map<string, League>
  seasonsById: Map<string, Season>
  // Start the dialog on one side (the Team selection pages share a single announced side).
  initialScope?: TeamSheetScope
  // Start the dialog on one content (Team Sheet from a team panel).
  initialContent?: MatchContent
}

export interface TeamSheetShare {
  // Opens the Share Match dialog with the hook's own initial content and side (safe as an onClick handler).
  openShare: () => void
  // Opens it with a content and side chosen at the click (a team panel's Team Sheet button).
  openShareFor: (options: ShareOpenOptions) => void
  shareDialog: ReactNode
}

// docs/specs/131-match-sharing.md: renders ShareMatchDialog (it replaced TeamSheetCommunicationDialog, docs/specs/030 and 039); a match with
// a published result hands over to ShareResultDialog. Extracted by docs/specs/075-match-view-and-edit.md:
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
  initialContent,
}: UseTeamSheetShareArgs): TeamSheetShare {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [options, setOptions] = useState<ShareOpenOptions>({ content: initialContent, scope: initialScope })
  const published = match.resultStatus === 'PUBLISHED'

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

  const resultQuery = useQuery({
    queryKey: resultKeys.detail(clubId, match.id),
    queryFn: () => getMatchResult(clubId, match.id),
    enabled: dialogOpen && published,
    retry: false,
  })

  const leagueName = match.leagueId ? (leaguesById.get(match.leagueId)?.name ?? null) : null
  const seasonLabel = seasonsById.get(match.seasonId)?.label ?? null

  const open = (next: ShareOpenOptions) => {
    setOptions(next)
    setDialogOpen(true)
  }

  const shareDialog = published ? (
    dialogOpen && resultQuery.data ? (
      <ShareResultDialog open onClose={() => setDialogOpen(false)} clubId={clubId} match={match} result={resultQuery.data} teamsById={teamsById} />
    ) : (
      <Backdrop open={dialogOpen && !resultQuery.isError} sx={{ zIndex: (theme) => theme.zIndex.modal, flexDirection: 'column', gap: 1.5, color: 'common.white' }} onClick={() => setDialogOpen(false)}>
        <CircularProgress color="inherit" size={28} />
        <Typography role="status">Opening the result share</Typography>
      </Backdrop>
    )
  ) : (
    <ShareMatchDialog
      open={dialogOpen}
      onClose={() => setDialogOpen(false)}
      clubId={clubId}
      match={match}
      teamsById={teamsById}
      sides={teamSheetSides}
      sidesLoading={Boolean(sidesLoading)}
      leagueName={leagueName}
      seasonLabel={seasonLabel}
      initialContent={options.content}
      initialScope={options.scope}
    />
  )

  return { openShare: () => open({ content: initialContent, scope: initialScope }), openShareFor: open, shareDialog }
}
