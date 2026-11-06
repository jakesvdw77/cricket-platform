import { useState } from 'react'
import { Box, Collapse, Link, Typography } from '@mui/material'
import EventOutlinedIcon from '@mui/icons-material/EventOutlined'
import { BrandIcon } from '../../../components/BrandIcon'
import { Button } from '../../../components/Button'
import { CardTimeStrip } from '../../../components/CardTimeStrip'
import { Countdown, useCountdown } from '../../../components/Countdown'
import { ManageMenu } from '../../../components/ManageMenu'
import { RecordCard } from '../../../components/RecordCard'
import type { RecordCardBadge } from '../../../components/RecordCard'
import type { TeamSelectionMatch, TeamSelectionSide } from '../../../api/teamSelectionApi'
import { formatMatchDateTime } from '../availability/pollHelpers'
import { VenueDirectionsButton } from '../../../components/VenueDirectionsButton'
import { CardForecastStrip } from '../../../components/CardForecastStrip'
import { CardVenueLine } from '../../../components/CardVenueLine'
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined'
import { useMatchLocationItems } from '../../../hooks/useMatchLocationItems'
import { PickedName } from './PickedName'
import { useSelectionMatch } from './useSelectionMatch'
import { SelectionBlock } from '../matches/SelectionBlock'
import { selectTeamPath } from './selectionLinks'
import { STATUS_LABELS, STATUS_TONES } from './selectionStatus'
import { sideMenuItems } from './sideMenuItems'
import { sortedPicks } from './sortedPicks'
import { TeamNameLink } from './TeamNameLink'

export interface SelectionMatchCardProps {
  clubId: string
  // The league's format (T20, ...), which sets how many hours of the forecast the weather line covers.
  leagueFormat?: string | null
  match: TeamSelectionMatch
  side: TeamSelectionSide
  onAnnounce?: (match: TeamSelectionMatch, side: TeamSelectionSide) => void
  announcing?: boolean
  onShare?: (match: TeamSelectionMatch, side: TeamSelectionSide) => void
  sharing?: boolean
  // Time Slots: the picks in batting order under the Selection block (C and WK markers, the 12th man labelled).
  showPicks?: boolean
  testId?: string
}

// docs/specs/137: the ONE card of Team Selection, built from the same pieces as the Matches list card (`MatchCard`): a flat `RecordCard` with
// the brand match icon, the match in the display face, colour-coded badges, the league as the subtitle, a "Starts" strip with a live
// countdown, one Venue line and the shared `SelectionBlock` (the side's picked count against the playing XI). One card per club side (a derby
// has two), its ONE kebab in the corner (Select Players, Announce Team, Share Team last) and, on a ready side, a quick Announce Team button.
// The Matches tab's Cards view and the Time Slots tab both use it; Time Slots also lists the picks.
export function SelectionMatchCard({ clubId, leagueFormat = null, match, side, onAnnounce, announcing = false, onShare, sharing = false, showPicks = false, testId = 'selection-card' }: SelectionMatchCardProps) {
  const to = selectTeamPath(match.matchId, side.sideId, side.home)
  const title = side.home ? `${side.teamName} vs ${side.opponentName}` : `${side.opponentName} vs ${side.teamName}`
  const kickoff = useCountdown(match.matchDate)
  const started = kickoff.stage === 'expired'
  // Directions and the forecast need the match's field position, which the overview does not carry (docs/specs/137).
  const fullMatch = useSelectionMatch(clubId, match.matchId, Boolean(match.venue))
  const { items: locationItems, dialogs: locationDialogs, directions, weather } = useMatchLocationItems(clubId, fullMatch, { title, leagueFormat })
  const canAnnounce = side.status === 'READY_TO_ANNOUNCE' && side.sideId !== null && Boolean(onAnnounce)
  const items = sideMenuItems({
    side,
    selectTo: to,
    onAnnounce: onAnnounce ? () => onAnnounce(match, side) : undefined,
    announcing,
    onShare: onShare ? () => onShare(match, side) : undefined,
    sharing,
    locationItems,
  })
  const badges: RecordCardBadge[] = [{ label: STATUS_LABELS[side.status], tone: STATUS_TONES[side.status] }]
  const picks = sortedPicks(side.picks)
  // Time Slots: the list of picks can be folded so the card stays short (owner, 2026-11-05); hidden until the manager shows it (owner, 2026-11-06).
  const [teamShown, setTeamShown] = useState(false)

  return (
    <Box data-testid={`${testId}-${match.matchId}-${side.teamId}`} sx={{ display: 'flex', '& > *': { flex: 1, minWidth: 0 } }}>
    <RecordCard
      flat
      title={title}
      titleWrap
      titleLines={3}
      badgesBelow
      description={match.leagueName ?? undefined}
      descriptionExtra={match.venue ? <CardVenueLine trailing={<VenueDirectionsButton target={directions} venue={match.venue} />}>{match.venue}</CardVenueLine> : undefined}
      headerActions={<ManageMenu trigger="kebab" dense label={`Actions for ${title}`} testId={`${testId}-actions-${match.matchId}-${side.teamId}`} groups={[{ id: 'actions', heading: 'Actions', items }]} />}
      avatar={{ element: <BrandIcon name="nav/upcoming-matches" size={48} padding={4} /> }}
      badges={badges}
      viewTo={to}
      footerActions={null}
    >
      <CardTimeStrip
        testId="selection-time-strip"
        tone={match.upcoming && kickoff.warn ? 'warning' : 'neutral'}
        icon={<EventOutlinedIcon fontSize="small" />}
        label={started ? 'Started' : 'Starts'}
        value={formatMatchDateTime(match.matchDate)}
        trailing={!match.upcoming || started ? undefined : <Countdown target={match.matchDate} phrase="to go" ariaPrefix="Starts in" />}
      />
      {/* docs/specs/137: the forecast is its own strip card and the Team Manager a placeholder card until a team can have a manager. */}
      <CardForecastStrip testId="selection-card-weather" weather={weather} matchDate={match.matchDate} />
      <CardTimeStrip testId="selection-card-manager" icon={<PersonOutlineOutlinedIcon fontSize="small" />} label="Team Manager" value={<Box component="span" sx={{ color: 'text.secondary' }}>–</Box>} />
      <SelectionBlock rows={[{ teamName: side.teamName, picked: side.pickedCount, playingXiSize: side.limits.maxSelected }]} />
      {showPicks && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="subtitle2" component="h4" fontWeight={700}>
              Team
            </Typography>
            <Link
              component="button"
              type="button"
              variant="body2"
              underline="always"
              aria-expanded={teamShown}
              aria-controls={`team-${match.matchId}-${side.teamId}`}
              onClick={() => setTeamShown((value) => !value)}
              data-testid="toggle-team"
              sx={{ fontWeight: 600, position: 'relative', zIndex: 1 }}
            >
              {teamShown ? 'Hide Team' : 'Show Team'}
            </Link>
          </Box>
          <Collapse in={teamShown} unmountOnExit>
            <Box id={`team-${match.matchId}-${side.teamId}`}>
              {picks.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Nobody picked yet.
                </Typography>
              ) : (
                <Box component="ol" aria-label={`${side.teamName} batting order`} sx={{ m: 0, p: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  {picks.map((pick) => (
                    <Box key={pick.playerId} component="li" data-testid="slot-pick" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ width: 24, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                        {pick.battingOrder ?? ''}
                      </Typography>
                      <PickedName pick={pick} />
                      {pick.twelfthMan && (
                        <Typography variant="caption" color="text.secondary">
                          12th man
                        </Typography>
                      )}
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          </Collapse>
        </Box>
      )}
      <Typography variant="body2" color="text.secondary">
        <TeamNameLink sectionId={side.sectionId} teamId={side.teamId} name={side.teamName} /> · {side.home ? 'Home' : 'Away'}
      </Typography>
      {canAnnounce && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button size="compact" onClick={() => onAnnounce?.(match, side)} disabled={announcing}>
            {announcing ? 'Announcing…' : 'Announce Team'}
          </Button>
        </Box>
      )}
    </RecordCard>
    {locationDialogs}
    </Box>
  )
}
