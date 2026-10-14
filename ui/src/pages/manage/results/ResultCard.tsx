import { Box, Typography } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import EventOutlinedIcon from '@mui/icons-material/EventOutlined'
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined'
import SportsCricketOutlinedIcon from '@mui/icons-material/SportsCricketOutlined'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import { BrandIcon } from '../../../components/BrandIcon'
import { CardTimeStrip } from '../../../components/CardTimeStrip'
import { DetailLine } from '../../../components/DetailLine'
import { RecordCard } from '../../../components/RecordCard'
import type { RecordCardBadge, RecordCardFooterButton } from '../../../components/RecordCard'
import { ResultScoreLine } from '../../../components/ResultScoreLine'
import type { ResultListItem } from '../../../api/matchResultApi'
import type { Team } from '../../../api/teamApi'
import type { League } from '../../../api/leagueApi'
import type { Season } from '../../../api/seasonApi'
import { formatMatchDateTime } from '../../../utils/matchDateTime'
import { inningsFor, resultLine, resultPerspective } from '../../../utils/resultLine'
import { badgeFor, matchLeagueValue } from '../matches/matchCardHelpers'
import { TeamLogo } from '../matches/TeamLogo'
import {
  ownSidesOf,
  PERSPECTIVE_COLOR,
  resultEditTo,
  resultSides,
  resultViewTo,
  tossLine,
  UNPUBLISH_TO_EDIT_REASON,
} from './resultListHelpers'

export interface ResultCardProps {
  item: ResultListItem
  teamsById: Map<string, Team>
  leaguesById: Map<string, League>
  seasonsById: Map<string, Season>
  // Publishes the draft (validation and warnings are the caller's job); only drafts show the button.
  onPublish: (item: ResultListItem) => void
}

// docs/specs/100-match-results-core.md: one RecordCard per result - both teams with logos and a score line each, the
// result line coloured from the club team's side, the toss, the date and the field, an amber Draft chip while
// unpublished, and View / Edit / Publish in the footer (Publish on a draft only; Edit is off while published).
export function ResultCard({ item, teamsById, leaguesById, seasonsById, onPublish }: ResultCardProps) {
  const navigate = useNavigate()
  const { match, result } = item
  const sides = resultSides(match, teamsById)
  const names = { home: sides[0].name, away: sides[1].name }
  const draft = result.status === 'DRAFT'
  const perspective = resultPerspective(result, ownSidesOf(match, teamsById))
  const toss = tossLine(result, names)
  const field = result.playingAreaName ?? match.playingAreaName ?? match.venue
  const leagueValue = matchLeagueValue(match, leaguesById, seasonsById)
  const inactive = badgeFor(match)
  const badges: RecordCardBadge[] = [...(draft ? [{ label: 'Draft', tone: 'warning' as const }] : []), ...(inactive ? [inactive] : [])]

  const footerButtons: RecordCardFooterButton[] = [
    { label: 'View', icon: <VisibilityOutlinedIcon fontSize="small" />, onClick: () => navigate(resultViewTo(match.id)) },
    {
      label: 'Edit',
      icon: <EditOutlinedIcon fontSize="small" />,
      onClick: () => navigate(resultEditTo(match.id)),
      disabled: !draft,
      title: draft ? undefined : UNPUBLISH_TO_EDIT_REASON,
    },
    ...(draft
      ? [{ label: 'Publish', icon: <CloudUploadOutlinedIcon fontSize="small" />, onClick: () => onPublish(item) }]
      : []),
  ]

  return (
    <RecordCard
      title={`${names.home} vs ${names.away}`}
      titleWrap
      titleLines={3}
      badgesBelow
      description={leagueValue || undefined}
      avatar={{ element: <BrandIcon name="nav/result-scorecard" size={48} padding={4} /> }}
      badges={badges}
      viewTo={resultViewTo(match.id)}
      footerButtons={footerButtons}
    >
      <CardTimeStrip
        testId="result-time-strip"
        icon={<EventOutlinedIcon fontSize="small" />}
        label="Played"
        value={formatMatchDateTime(match.matchDate)}
      />
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }} data-testid="result-sides">
        {sides.map((side) => {
          const winner = result.winningSide === side.side && result.outcomeType === 'WON'
          return (
            <Box key={side.side} sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
              <TeamLogo logo={side.logo} testId={`result-logo-${side.side.toLowerCase()}`} />
              <Typography variant="body2" fontWeight={winner ? 700 : 500} noWrap sx={{ flex: 1, minWidth: 0 }}>
                {side.name}
              </Typography>
              <ResultScoreLine
                innings={inningsFor(result.innings, side.side)}
                ballsPerOver={result.ballsPerOver}
                winner={winner}
              />
            </Box>
          )
        })}
      </Box>
      <Typography
        variant="body2"
        fontWeight={700}
        data-testid="result-line"
        data-perspective={perspective}
        sx={{ color: PERSPECTIVE_COLOR[perspective] }}
      >
        {resultLine(result, names)}
      </Typography>
      <DetailLine
        icon={<SportsCricketOutlinedIcon fontSize="small" />}
        label="Toss"
        value={toss ?? 'Not recorded'}
        muted={!toss}
      />
      <DetailLine
        icon={<PlaceOutlinedIcon fontSize="small" />}
        label="Field"
        value={field ?? 'Not recorded'}
        muted={!field}
      />
    </RecordCard>
  )
}
