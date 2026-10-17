import { Typography } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import EmojiEventsOutlinedIcon from '@mui/icons-material/EmojiEventsOutlined'
import EventOutlinedIcon from '@mui/icons-material/EventOutlined'
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined'
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined'
import SportsCricketOutlinedIcon from '@mui/icons-material/SportsCricketOutlined'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import { BrandIcon } from '../../../components/BrandIcon'
import { CardTimeStrip } from '../../../components/CardTimeStrip'
import { DetailLine } from '../../../components/DetailLine'
import { RecordCard } from '../../../components/RecordCard'
import type { RecordCardBadge, RecordCardFooterButton } from '../../../components/RecordCard'
import { ResultSummary } from '../../../components/ResultSummary'
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
  PUBLISH_TO_SHARE_REASON,
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
  // docs/specs/114: opens the Share dialog for this result; Share is off on a draft.
  onShare: (item: ResultListItem) => void
}

// docs/specs/100-match-results-core.md: one RecordCard per result - both teams with logos and a score line each, the
// result line coloured from the club team's side, the toss, the date and the field, an amber Draft chip while
// unpublished and a green Published chip once published (so the cards line up), and View / Edit / Publish / Share in the footer (Publish on a draft only; Edit is off while published; Share is off on a draft).
export function ResultCard({ item, teamsById, leaguesById, seasonsById, onPublish, onShare }: ResultCardProps) {
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
  // Every card carries a status chip in the same place, so a draft and a published result line up in the grid.
  const statusBadge: RecordCardBadge = draft ? { label: 'Draft', tone: 'warning' } : { label: 'Published', tone: 'positive' }
  const badges: RecordCardBadge[] = [statusBadge, ...(inactive ? [inactive] : [])]

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
    {
      label: 'Share',
      icon: <ShareOutlinedIcon fontSize="small" />,
      onClick: () => onShare(item),
      disabled: draft,
      title: draft ? PUBLISH_TO_SHARE_REASON : undefined,
    },
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
      <ResultSummary
        sides={sides.map((side) => ({
          key: side.side,
          name: side.name,
          logo: <TeamLogo logo={side.logo} testId={`result-logo-${side.side.toLowerCase()}`} />,
          innings: inningsFor(result.innings, side.side),
          winner: result.winningSide === side.side && result.outcomeType === 'WON',
        }))}
        ballsPerOver={result.ballsPerOver}
        resultLine={resultLine(result, names)}
        resultColor={PERSPECTIVE_COLOR[perspective]}
        perspective={perspective}
      >
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
      {item.playerOfTheMatch && (
        <DetailLine
          icon={<EmojiEventsOutlinedIcon fontSize="small" />}
          label="Player of the match"
          value={item.playerOfTheMatch}
          labelWidth={130}
        />
      )}
      {!draft && (
        <Typography variant="caption" color="text.secondary">
          {UNPUBLISH_TO_EDIT_REASON}
        </Typography>
      )}
      </ResultSummary>
    </RecordCard>
  )
}
