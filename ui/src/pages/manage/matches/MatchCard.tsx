import { Box, IconButton, Stack } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import SportsCricketOutlinedIcon from '@mui/icons-material/SportsCricketOutlined'
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined'
import EventOutlinedIcon from '@mui/icons-material/EventOutlined'
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined'
import EmojiEventsOutlinedIcon from '@mui/icons-material/EmojiEventsOutlined'
import ScoreboardOutlinedIcon from '@mui/icons-material/ScoreboardOutlined'
import LiveTvOutlinedIcon from '@mui/icons-material/LiveTvOutlined'
import { DetailLine } from '../../../components/DetailLine'
import { RecordCard } from '../../../components/RecordCard'
import type { RecordCardBadge } from '../../../components/RecordCard'
import type { Match } from '../../../api/matchApi'
import type { Team } from '../../../api/teamApi'
import type { League } from '../../../api/leagueApi'
import type { Season } from '../../../api/seasonApi'
import { formatMatchDateTime } from '../availability/pollHelpers'
import { SelectionBlock } from './SelectionBlock'
import { useAvailabilityNavigation } from './useAvailabilityNavigation'
import { useTeamSheetShare } from './useTeamSheetShare'
import {
  announcedBadges,
  badgeFor,
  matchLeagueValue,
  NO_CLUB_TEAM_REASON,
  pollBadgeFor,
  pollDestination,
  selectionRows,
  sideName,
  withPlayingXiTab,
} from './matchCardHelpers'

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
// card - icon-over-caption footer (Edit / Select / Availability / Share), colour-coded badges, stacked
// details and a Selection block. Deactivate/Reactivate lives on the edit screen (038).
// docs/specs/075: the Poll button is now Availability (a derby's two polls open a small menu), and
// the scoring/streaming links show as an icon row.
export function MatchCard({ clubId, match, teamsById, leaguesById, seasonsById, editTo, viewTo }: MatchCardProps) {
  const navigate = useNavigate()

  const homeTeamName = sideName(match.homeTeamId, match.homeTeamName, teamsById)
  const awayTeamName = sideName(match.awayTeamId, match.awayTeamName, teamsById)
  const title = `${homeTeamName} vs ${awayTeamName}`

  const { openShare, shareDialog } = useTeamSheetShare({ clubId, match, teamsById, leaguesById, seasonsById })
  const { openAvailability, menu } = useAvailabilityNavigation(pollDestination(match, teamsById))

  // docs/specs/037-match-improvements.md item 2: a match with no club team side has no
  // Playing XI to pick, poll or share (029) — those footer buttons are disabled with an explanation.
  // Same definition of "club team" as the Selection block: a side whose picked count is non-null.
  const hasClubSide = selectionRows(match, teamsById).length > 0
  const disabledProps = hasClubSide ? {} : { disabled: true, title: NO_CLUB_TEAM_REASON }

  const leagueValue = matchLeagueValue(match, leaguesById, seasonsById)

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
        headerActions={
          match.scoringUrl || match.streamingUrl ? (
            <Box data-testid="match-links-row" sx={{ display: 'flex', gap: 0.25 }}>
              {match.scoringUrl && (
                <IconButton
                  component="a"
                  href={match.scoringUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  size="small"
                  aria-label="Scoring"
                  title="Scoring"
                  sx={{ color: 'primary.dark' }}
                >
                  <ScoreboardOutlinedIcon fontSize="small" />
                </IconButton>
              )}
              {match.streamingUrl && (
                <IconButton
                  component="a"
                  href={match.streamingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  size="small"
                  aria-label="Watch live"
                  title="Watch live"
                  sx={{ color: 'primary.dark' }}
                >
                  <LiveTvOutlinedIcon fontSize="small" />
                </IconButton>
              )}
            </Box>
          ) : undefined
        }
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
            label: 'Availability',
            icon: <EventAvailableOutlinedIcon fontSize="small" />,
            onClick: openAvailability,
            ...disabledProps,
          },
          {
            label: 'Share',
            icon: <ShareOutlinedIcon fontSize="small" />,
            onClick: openShare,
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
      {menu}
      {shareDialog}
    </>
  )
}
