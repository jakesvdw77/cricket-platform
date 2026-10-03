import { useState } from 'react'
import type { ReactNode } from 'react'
import { Stack, Typography } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import SportsCricketOutlinedIcon from '@mui/icons-material/SportsCricketOutlined'
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined'
import EventOutlinedIcon from '@mui/icons-material/EventOutlined'
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined'
import EmojiEventsOutlinedIcon from '@mui/icons-material/EmojiEventsOutlined'
import { RecordCard } from '../../../components/RecordCard'
import type { RecordCardBadge } from '../../../components/RecordCard'
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
import { formatMatchDateTime } from '../availability/pollHelpers'
import { SelectionBlock } from './SelectionBlock'
import {
  announcedBadges,
  badgeFor,
  pollBadgeFor,
  pollDestination,
  selectionRows,
  sideName,
  withPlayingXiTab,
} from './matchCardHelpers'

const NO_CLUB_TEAM_REASON = 'None of your teams is playing in this match'

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

// One stacked detail line: a small icon, a label and the value. Plain text only - the card body is
// not lifted above the title's stretched link, so nothing interactive belongs here.
function DetailLine({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <Stack direction="row" spacing={1.25} alignItems="flex-start">
      <Stack sx={{ color: 'text.secondary', pt: '1px', flexShrink: 0 }} aria-hidden>
        {icon}
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ width: 56, flexShrink: 0 }}>
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={600} sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
        {value}
      </Typography>
    </Stack>
  )
}

export interface MatchCardProps {
  clubId: string
  match: Match
  teamsById: Map<string, Team>
  leaguesById: Map<string, League>
  seasonsById: Map<string, Season>
  editTo: string
  // docs/specs/036: when present the whole card links to the match view. SquadPicker.tsx
  // deliberately passes `undefined` (via MatchList's own `viewTo={null}`).
  viewTo?: string
}

// docs/specs/069-match-card-redesign.md: one RecordCard per match, built like the availability poll
// card - icon-over-caption footer (Edit / Select / Poll / Share), colour-coded badges, stacked
// details and a Selection block. Deactivate/Reactivate lives on the edit screen (038).
export function MatchCard({ clubId, match, teamsById, leaguesById, seasonsById, editTo, viewTo }: MatchCardProps) {
  const navigate = useNavigate()
  const [dialogOpen, setDialogOpen] = useState(false)

  const homeTeamName = sideName(match.homeTeamId, match.homeTeamName, teamsById)
  const awayTeamName = sideName(match.awayTeamId, match.awayTeamName, teamsById)
  const title = `${homeTeamName} vs ${awayTeamName}`

  // docs/specs/030-team-sheet-communication.md — the Team Sheet data-fetching lives here (the host),
  // matching the codebase's presentational-dialog convention. Every query is `enabled: dialogOpen`
  // so nothing fires until the admin actually opens the dialog.
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

  // docs/specs/037-match-improvements.md item 2: a match with no club team side has no
  // Playing XI to pick, poll or share (029) — those footer buttons are disabled with an explanation.
  // Same definition of "club team" as the Selection block: a side whose picked count is non-null.
  const hasClubSide = selectionRows(match, teamsById).length > 0
  const disabledProps = hasClubSide ? {} : { disabled: true, title: NO_CLUB_TEAM_REASON }

  const handlePrint = async (scope: TeamSheetPrintScope) => {
    const filteredSides =
      scope === 'both' ? teamSheetSides : scope === 'home' ? [teamSheetSides[0]] : [teamSheetSides[1]]
    const url = await generateTeamSheetPdf(match, filteredSides, subtitle)
    window.open(url, '_blank')
  }

  const league = match.leagueId ? leaguesById.get(match.leagueId)?.name : undefined
  const season = seasonsById.get(match.seasonId)?.label
  const leagueValue = [league, season].filter(Boolean).join(' · ')

  const inactive = badgeFor(match)
  const badges: RecordCardBadge[] = [
    ...announcedBadges(match, teamsById),
    ...(inactive ? [inactive] : []),
    pollBadgeFor(match.polls),
  ]

  return (
    <>
      <RecordCard
        title={title}
        titleWrap
        badgesAbove
        avatar={{ fallback: <SportsCricketOutlinedIcon fontSize="small" />, shape: 'rounded' }}
        badges={badges}
        viewTo={viewTo}
        footerButtons={[
          {
            label: 'Edit',
            icon: <EditOutlinedIcon fontSize="small" />,
            onClick: () => navigate(editTo),
          },
          {
            label: 'Select',
            icon: <GroupsOutlinedIcon fontSize="small" />,
            onClick: () => navigate(withPlayingXiTab(editTo)),
            ...disabledProps,
          },
          {
            label: 'Poll',
            icon: <EventAvailableOutlinedIcon fontSize="small" />,
            onClick: () => navigate(pollDestination(match, teamsById, editTo)),
            ...disabledProps,
          },
          {
            label: 'Share',
            icon: <ShareOutlinedIcon fontSize="small" />,
            onClick: () => setDialogOpen(true),
            ...disabledProps,
          },
        ]}
      >
        <Stack spacing={1.25} sx={{ py: 0.5 }}>
          <DetailLine icon={<EventOutlinedIcon fontSize="small" />} label="When" value={formatMatchDateTime(match.matchDate)} />
          {match.venue && <DetailLine icon={<PlaceOutlinedIcon fontSize="small" />} label="Venue" value={match.venue} />}
          {leagueValue && (
            <DetailLine icon={<EmojiEventsOutlinedIcon fontSize="small" />} label="League" value={leagueValue} />
          )}
        </Stack>
        <SelectionBlock rows={selectionRows(match, teamsById)} />
      </RecordCard>
      <TeamSheetCommunicationDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        match={match}
        sides={teamSheetSides}
        sidesLoading={Boolean(sidesLoading)}
        onPrint={handlePrint}
        subtitle={subtitle}
      />
    </>
  )
}
