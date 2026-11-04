import { useMemo } from 'react'
import { Box, Typography } from '@mui/material'
import type { TeamSelectionMatch } from '../../../api/teamSelectionApi'
import { dynamicCardGridSx } from '../../../utils/cardGrid'
import { dateHeading, groupGames, slotLabel } from '../playerAvailability/gridHelpers'
import { MatchesFrame } from './MatchesFrame'
import { useTeamSelectionHub } from './hubContext'
import { SelectionMatchCard } from './SelectionMatchCard'
import { useAnnounceSide } from './useAnnounceSide'
import { useShareAnnouncedSide } from './useShareAnnouncedSide'

// docs/specs/093-team-selection-hub.md (Time slots view), revamped by docs/specs/137: a block per day and slot, one `SelectionMatchCard` per
// club side (the same card as the Matches tab, with the picks in batting order, C / WK markers and the 12th man labelled).
export default function SlotsView() {
  return (
    <MatchesFrame sortable>
      {(matches) => <SlotBlocks matches={matches} />}
    </MatchesFrame>
  )
}

function SlotBlocks({ matches }: { matches: TeamSelectionMatch[] }) {
  const { clubId, sort, leagues } = useTeamSelectionHub()
  const shareSide = useShareAnnouncedSide(clubId as string)
  const announce = useAnnounceSide(clubId as string)
  const groups = useMemo(() => groupGames(matches), [matches])
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {groups.map((group) =>
        (sort === 'desc' ? [...group.slots].reverse() : group.slots).map((slot) => (
          <Box key={`${group.dateKey}-${slot.dayPart}`} component="section" aria-label={`${dateHeading(group.date)} ${slotLabel(slot.dayPart)}`} sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Typography variant="subtitle2" component="h2" sx={{ fontWeight: 600 }}>
              {dateHeading(group.date)} <Box component="span" sx={{ color: 'text.secondary', fontWeight: 500 }}>{slotLabel(slot.dayPart)}</Box>
            </Typography>
            {/* The shared card grid: never more than three cards in a row (page-anatomy section 6). */}
            <Box sx={dynamicCardGridSx}>
              {slot.games.flatMap((match) => match.sides.map((side) => (
                <SelectionMatchCard
                  key={`${match.matchId}:${side.teamId}`}
                  testId="slot-card"
                  clubId={clubId as string}
                  leagueFormat={leagues.find((league) => league.id === match.leagueId)?.format ?? null}
                  showPicks
                  match={match}
                  side={side}
                  onShare={(target, targetSide) => shareSide.share(target.matchId, targetSide.home)}
                  sharing={shareSide.loadingMatchId === match.matchId}
                  onAnnounce={announce.request}
                  announcing={side.sideId !== null && side.sideId === announce.announcingSideId}
                />
              )))}
            </Box>
          </Box>
        )),
      )}
      {announce.errorAlert}
      {announce.dialog}
      {shareSide.dialog}
    </Box>
  )
}
