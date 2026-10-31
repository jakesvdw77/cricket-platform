import { Chip } from '@mui/material'
import { useLocation } from 'react-router-dom'
import EventOutlinedIcon from '@mui/icons-material/EventOutlined'
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined'
import { BrandIcon } from '../../../components/BrandIcon'
import { CardTimeStrip } from '../../../components/CardTimeStrip'
import { Countdown, useCountdown } from '../../../components/Countdown'
import { DetailLine } from '../../../components/DetailLine'
import { badgeSx, RecordCard } from '../../../components/RecordCard'
import type { RecordCardBadge } from '../../../components/RecordCard'
import type { Match } from '../../../api/matchApi'
import type { Team } from '../../../api/teamApi'
import type { League } from '../../../api/leagueApi'
import type { Season } from '../../../api/seasonApi'
import { currentOrigin, withReturnTo } from '../../../utils/returnTo'
import { formatMatchDateTime } from '../availability/pollHelpers'
import { resultBadgeFor, resultStateOf } from './matchResultHelpers'
import { MatchRowMenu } from './MatchRowMenu'
import { SelectionBlock } from './SelectionBlock'
import {
  announcedBadges,
  badgeFor,
  matchLeagueValue,
  pollBadgeFor,
  selectionRows,
  sideName,
} from './matchCardHelpers'

export interface MatchCardProps {
  clubId: string
  match: Match
  teamsById: Map<string, Team>
  leaguesById: Map<string, League>
  seasonsById: Map<string, Season>
  // docs/specs/036: when present the whole card links to the match view (with the list as its origin, docs/specs/127).
  viewTo?: string
}

// docs/specs/069-match-card-redesign.md, revamped by docs/specs/130: one flat RecordCard per match, the brand match icon on its
// tile, colour-coded badges, "League · Season" as the subtitle, a "Starts" strip with a live countdown (amber within 24 hours
// of kickoff; "Played" once it has a published result), one Venue line and the Selection block. ONE Actions kebab in the corner
// holds every action (no footer bar, no icon cluster). Deactivate/Reactivate and Delete live on the edit screen (038, 109).
export function MatchCard({ clubId, match, teamsById, leaguesById, seasonsById, viewTo }: MatchCardProps) {
  const location = useLocation()
  const homeTeamName = sideName(match.homeTeamId, match.homeTeamName, teamsById)
  const awayTeamName = sideName(match.awayTeamId, match.awayTeamName, teamsById)
  const title = `${homeTeamName} vs ${awayTeamName}`

  const leagueValue = matchLeagueValue(match, leaguesById, seasonsById)
  // The strip reads the kickoff: a countdown and the amber tone before it, "Played" (neutral, no countdown) after.
  const kickoff = useCountdown(match.matchDate)
  // docs/specs/100: "played" is the real result state, not the date. A started match with no published result reads
  // "Awaiting result".
  const resultState = resultStateOf(match)
  const played = resultState === 'published'
  const started = kickoff.stage === 'expired'
  const resultBadge = resultBadgeFor(match)

  const inactive = badgeFor(match)
  const badges: RecordCardBadge[] = [
    ...announcedBadges(match, teamsById),
    ...(inactive ? [inactive] : []),
    ...(resultBadge ? [resultBadge] : []),
    pollBadgeFor(match.polls),
  ]

  return (
    <RecordCard
      flat
      title={title}
      titleWrap
      titleLines={3}
      badgesBelow
      description={leagueValue || undefined}
      headerActions={<MatchRowMenu clubId={clubId} match={match} teamsById={teamsById} leaguesById={leaguesById} seasonsById={seasonsById} testId="match-card-actions" />}
      // docs/specs/087: the brand match icon on its standard tile, like the poll card (48px icon + 4px padding on
      // each side is the 56px avatar box).
      avatar={{ element: <BrandIcon name="nav/upcoming-matches" size={48} padding={4} /> }}
      badges={badges}
      viewTo={viewTo ? withReturnTo(viewTo, currentOrigin(location), 'Matches') : undefined}
      // No footer action bar (page-anatomy section 6): the kebab in the corner holds every action.
      footerActions={null}
    >
        <CardTimeStrip
          testId="match-time-strip"
          tone={!started && !played && kickoff.warn ? 'warning' : 'neutral'}
          icon={<EventOutlinedIcon fontSize="small" />}
          label={played ? 'Played' : started ? 'Awaiting result' : 'Starts'}
          value={formatMatchDateTime(match.matchDate)}
          trailing={started || played ? undefined : <Countdown target={match.matchDate} phrase="to go" ariaPrefix="Starts in" />}
        />
        {match.venue && (
          <DetailLine
            icon={<PlaceOutlinedIcon fontSize="small" />}
            label="Venue"
            value={
              <>
                {match.venue}
                {/* docs/specs/099: a small amber flag until an administrator verifies the field (red if it was rejected);
                    a match with only the old venue text shows none. */}
                {match.playingAreaVerificationStatus === 'UNVERIFIED' && (
                  <Chip size="small" label="Unverified field" data-testid="match-field-flag" sx={{ ...badgeSx('warning'), height: 20, fontSize: '0.6875rem', ml: 0.75 }} />
                )}
                {match.playingAreaVerificationStatus === 'REJECTED' && (
                  <Chip size="small" label="Field rejected" data-testid="match-field-flag" sx={{ ...badgeSx('closed'), height: 20, fontSize: '0.6875rem', ml: 0.75 }} />
                )}
              </>
            }
          />
        )}
        <SelectionBlock rows={selectionRows(match, teamsById)} />
    </RecordCard>
  )
}
