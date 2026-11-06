import { Box, Chip, Link as MuiLink } from '@mui/material'
import { Link as RouterLink, useLocation } from 'react-router-dom'
import EventOutlinedIcon from '@mui/icons-material/EventOutlined'
import { BrandIcon } from '../../../components/BrandIcon'
import { CardTimeStrip } from '../../../components/CardTimeStrip'
import { Countdown, useCountdown } from '../../../components/Countdown'
import { CardForecastStrip } from '../../../components/CardForecastStrip'
import { CardVenueLine } from '../../../components/CardVenueLine'
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined'
import { useMatchDirections, useMatchFieldWeather } from '../../../hooks/useMatchWeather'
import { VenueDirectionsButton } from '../../../components/VenueDirectionsButton'
import { badgeSx, chipLinkSx, RecordCard } from '../../../components/RecordCard'
import type { RecordCardBadge } from '../../../components/RecordCard'
import type { Match } from '../../../api/matchApi'
import type { Team } from '../../../api/teamApi'
import type { League } from '../../../api/leagueApi'
import type { Season } from '../../../api/seasonApi'
import { currentOrigin, withReturnTo } from '../../../utils/returnTo'
import { formatMatchDateTime } from '../availability/pollHelpers'
import { matchStatusFor } from './matchResultHelpers'
import { useAvailabilityNavigation } from './useAvailabilityNavigation'
import { MatchRowMenu } from './MatchRowMenu'
import { SelectionBlock } from './SelectionBlock'
import type { PollDestination } from './matchCardHelpers'
import {
  announcedBadges,
  matchLeagueValue,
  ownSides,
  pollBadgeFor,
  pollDestination,
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
  // docs/specs/131 (Weather): the forecast within 7 days at a field with a usable place; nothing otherwise.
  const directions = useMatchDirections(clubId, match)
  const weather = useMatchFieldWeather(clubId, match, undefined, match.leagueId ? leaguesById.get(match.leagueId)?.format : null)
  const location = useLocation()
  const homeTeamName = sideName(match.homeTeamId, match.homeTeamName, teamsById)
  const awayTeamName = sideName(match.awayTeamId, match.awayTeamName, teamsById)
  const title = `${homeTeamName} vs ${awayTeamName}`

  const leagueValue = matchLeagueValue(match, leaguesById, seasonsById)
  // The strip reads the kickoff: a countdown and the amber tone before it, "Played" (neutral, no countdown) after.
  const kickoff = useCountdown(match.matchDate)
  // docs/specs/127: every destination returns to the list the card is on.
  const leaveTo = (destination: string) => withReturnTo(destination, currentOrigin(location), 'Matches')
  const status = matchStatusFor(match, `${homeTeamName} v ${awayTeamName}`)
  const upcoming = status.kind === 'upcoming'
  const started = kickoff.stage === 'expired'

  const pollDest = pollDestination(match, teamsById)
  const mappedDest: PollDestination =
    pollDest.kind === 'link' ? { kind: 'link', to: leaveTo(pollDest.to) } : { kind: 'menu', options: pollDest.options.map((option) => ({ ...option, to: leaveTo(option.to) })) }
  const { openAvailability, menu: pollMenu } = useAvailabilityNavigation(mappedDest)
  const canOpenPoll = ownSides(match).length > 0
  const matchName = `${homeTeamName} v ${awayTeamName}`
  const pollBadge: RecordCardBadge = {
    ...pollBadgeFor(match.polls),
    ...(canOpenPoll
      ? mappedDest.kind === 'link'
        ? { to: mappedDest.to, ariaLabel: `Open availability for ${matchName}` }
        : { onClick: openAvailability, ariaLabel: `Choose availability poll for ${matchName}` }
      : {}),
  }
  const badges: RecordCardBadge[] = [
    ...announcedBadges(match, teamsById),
    { label: status.label, tone: status.tone, to: status.to ? leaveTo(status.to) : undefined, ariaLabel: status.ariaLabel, pulse: status.kind === 'live' },
    pollBadge,
  ]

  const venue = (
    match.venue ? (
          <CardVenueLine trailing={<VenueDirectionsButton target={directions} venue={match.venue} />}>
            <>
                {match.playingAreaId ? (
                  <MuiLink component={RouterLink} to={leaveTo(`/manage/fixtures/fields/${match.playingAreaId}`)} color="inherit" underline="hover" aria-label={`View field ${match.venue}`} sx={{ ...chipLinkSx, borderRadius: 0.5 }}>
                    {match.venue}
                  </MuiLink>
                ) : (
                  match.venue
                )}
                {/* docs/specs/099: a small amber flag until an administrator verifies the field (red if it was rejected);
                    a match with only the old venue text shows none. */}
                {match.playingAreaVerificationStatus === 'UNVERIFIED' && (
                  <Chip size="small" label="Unverified field" data-testid="match-field-flag" sx={{ ...badgeSx('warning'), height: 20, fontSize: '0.6875rem', ml: 0.75 }} />
                )}
                {match.playingAreaVerificationStatus === 'REJECTED' && (
                  <Chip size="small" label="Field rejected" data-testid="match-field-flag" sx={{ ...badgeSx('closed'), height: 20, fontSize: '0.6875rem', ml: 0.75 }} />
                )}
            </>
          </CardVenueLine>
        ) : undefined
  )

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
          tone={upcoming && kickoff.warn ? 'warning' : 'neutral'}
          icon={<EventOutlinedIcon fontSize="small" />}
          label={started ? 'Started' : 'Starts'}
          value={formatMatchDateTime(match.matchDate)}
          trailing={!upcoming ? undefined : <Countdown target={match.matchDate} phrase="to go" ariaPrefix="Starts in" />}
        />
        {/* docs/specs/137: the forecast is its own strip card (like the Starts strip) and the Team Manager is a placeholder card until a team can
            have a manager (roadmap: full spec required). */}
        <CardForecastStrip testId="match-card-weather" weather={weather} matchDate={match.matchDate} venue={venue} />
        <CardTimeStrip testId="match-card-manager" icon={<PersonOutlineOutlinedIcon fontSize="small" />} label="Team Manager" value={<Box component="span" sx={{ color: 'text.secondary' }}>–</Box>} />
        <SelectionBlock rows={selectionRows(match, teamsById)} />
        {pollMenu}
    </RecordCard>
  )
}
