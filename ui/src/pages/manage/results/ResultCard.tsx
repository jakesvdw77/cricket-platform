import { Box } from '@mui/material'
import { useLocation } from 'react-router-dom'
import EmojiEventsOutlinedIcon from '@mui/icons-material/EmojiEventsOutlined'
import EventOutlinedIcon from '@mui/icons-material/EventOutlined'
import SportsCricketOutlinedIcon from '@mui/icons-material/SportsCricketOutlined'
import { BrandIcon } from '../../../components/BrandIcon'
import { Button } from '../../../components/Button'
import { CardTimeStrip } from '../../../components/CardTimeStrip'
import { CardVenueLine } from '../../../components/CardVenueLine'
import { DetailLine } from '../../../components/DetailLine'
import { RecordCard } from '../../../components/RecordCard'
import type { RecordCardBadge } from '../../../components/RecordCard'
import { ResultSummary } from '../../../components/ResultSummary'
import type { ResultListItem } from '../../../api/matchResultApi'
import type { Team } from '../../../api/teamApi'
import type { League } from '../../../api/leagueApi'
import type { Season } from '../../../api/seasonApi'
import { formatMatchDateTime } from '../../../utils/matchDateTime'
import { currentOrigin, withReturnTo } from '../../../utils/returnTo'
import { inningsFor, resultLine, resultPerspective } from '../../../utils/resultLine'
import { badgeFor, matchLeagueValue } from '../matches/matchCardHelpers'
import { TeamLogo } from '../matches/TeamLogo'
import { TeamNameLink } from '../teamSelection/TeamNameLink'
import { ResultRowMenu } from './ResultRowMenu'
import {
  ownSidesOf,
  PERSPECTIVE_COLOR,
  resultSides,
  resultViewTo,
  tossLine,
} from './resultListHelpers'

export interface ResultCardProps {
  item: ResultListItem
  teamsById: Map<string, Team>
  leaguesById: Map<string, League>
  seasonsById: Map<string, Season>
  // Publishes the draft (validation and warnings are the caller's job); only drafts show the button.
  onPublish: (item: ResultListItem) => void
  // docs/specs/114: opens the Share dialog for this result; Share is offered on a published result only.
  onShare: (item: ResultListItem) => void
}

// docs/specs/100-match-results-core.md: one RecordCard per result - both teams with logos and a score line each, the
// result line coloured from the club team's side, the toss, the date and the field, an amber Draft chip while
// unpublished and a green Published chip once published (so the cards line up), and View / Edit / Publish / Share in the footer (Publish on a draft only; Edit is off while published; Share is off on a draft).
export function ResultCard({ item, teamsById, leaguesById, seasonsById, onPublish, onShare }: ResultCardProps) {
  const location = useLocation()
  const { match, result } = item
  const sides = resultSides(match, teamsById)
  const names = { home: sides[0].name, away: sides[1].name }
  const draft = result.status === 'DRAFT'
  const perspective = resultPerspective(result, ownSidesOf(match, teamsById))
  const toss = tossLine(result, names)
  const field = result.playingAreaName ?? match.playingAreaName ?? match.venue
  const leagueValue = matchLeagueValue(match, leaguesById, seasonsById)
  const inactive = badgeFor(match)
  // A club team's name is a link to its page (docs/specs/138); an external opponent has no page.
  const ownTeamLink = (sideKey: 'HOME' | 'AWAY') => {
    const teamId = sideKey === 'HOME' ? match.homeTeamId : match.awayTeamId
    const team = teamId ? teamsById.get(teamId) : undefined
    const name = sideKey === 'HOME' ? names.home : names.away
    return team ? <TeamNameLink sectionId={team.sectionId} teamId={team.id} name={name} originLabel="Results" /> : undefined
  }
  // Every card carries a status chip in the same place, so a draft and a published result line up in the grid.
  const statusBadge: RecordCardBadge = draft ? { label: 'Draft', tone: 'warning' } : { label: 'Published', tone: 'positive' }
  const badges: RecordCardBadge[] = [statusBadge, ...(result.visibleToPlayers ? [{ label: 'In Player Hub', tone: 'positive' as const }] : []), ...(inactive ? [inactive] : [])]

  return (
    <RecordCard
      title={`${names.home} vs ${names.away}`}
      titleWrap
      titleLines={3}
      badgesBelow
      description={leagueValue || undefined}
      avatar={{ element: <BrandIcon name="nav/result-scorecard" size={48} padding={4} /> }}
      badges={badges}
      viewTo={withReturnTo(resultViewTo(match.id), currentOrigin(location), 'Results')}
      // No footer bar (page-anatomy section 6): the kebab in the corner holds every action.
      footerActions={null}
      headerActions={<ResultRowMenu item={item} title={`${names.home} vs ${names.away}`} onPublish={onPublish} onShare={onShare} />}
      descriptionExtra={field ? <CardVenueLine>{field}</CardVenueLine> : undefined}
      flat
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
          nameLink: ownTeamLink(side.side),
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
      {item.playerOfTheMatch && (
        <DetailLine
          icon={<EmojiEventsOutlinedIcon fontSize="small" />}
          label="Player of the match"
          value={item.playerOfTheMatch}
          labelWidth={130}
        />
      )}
      {/* A draft's one frequent action stays one click away, as Announce Team does in Team Selection. */}
      {draft && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button size="compact" onClick={() => onPublish(item)}>
            Publish Result
          </Button>
        </Box>
      )}
      </ResultSummary>
    </RecordCard>
  )
}
