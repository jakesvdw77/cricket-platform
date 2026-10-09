import { useMemo } from 'react'
import { Box, Button as MuiButton, Chip, Typography } from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'
import { badgeSx } from '../../../components/RecordCard'
import { SelectionGauge } from '../../../components/SelectionGauge'
import type { TeamSelectionMatch, TeamSelectionSide } from '../../../api/teamSelectionApi'
import { dateHeading, groupGames, kickoffText, slotLabel } from '../playerAvailability/gridHelpers'
import { MatchesFrame } from './MatchesFrame'
import { PickedName } from './PickedName'
import { selectTeamPath } from './selectionLinks'
import { STATUS_LABELS, STATUS_TONES } from './selectionStatus'
import { sortedPicks } from './sortedPicks'

function SideCard({ match, side }: { match: TeamSelectionMatch; side: TeamSelectionSide }) {
  const title = side.home ? `${side.teamName} v ${side.opponentName}` : `${side.opponentName} v ${side.teamName}`
  const picks = sortedPicks(side.picks)
  const max = side.limits.maxSelected
  return (
    <Box
      component="section"
      aria-label={`${title}, ${kickoffText(match.matchDate)}`}
      data-testid={`slot-card-${match.matchId}-${side.teamId}`}
      sx={{ border: 1, borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper', boxShadow: 2, p: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" fontWeight={600} sx={{ overflowWrap: 'anywhere' }}>
            {title}
          </Typography>
          <Typography variant="caption" color="text.secondary" component="div">
            {kickoffText(match.matchDate)}
            {match.leagueName ? ` · ${match.leagueName}` : ''}
          </Typography>
        </Box>
        {side.announced && (
          <Chip size="small" label={STATUS_LABELS.ANNOUNCED} sx={{ ...badgeSx(STATUS_TONES.ANNOUNCED), height: 22, fontSize: '0.75rem' }} />
        )}
      </Box>

      <SelectionGauge
        picked={side.pickedCount}
        size={max}
        ariaLabel={`${side.teamName} selection, ${side.pickedCount} of ${max} picked`}
        testIdPrefix={`slot-gauge-${match.matchId}-${side.teamId}`}
      />

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

      <MuiButton
        size="small"
        variant={side.announced ? 'outlined' : 'contained'}
        component={RouterLink}
        to={selectTeamPath(match.matchId, side.sideId, side.home)}
        sx={{ alignSelf: 'flex-start', whiteSpace: 'nowrap' }}
      >
        Select players
      </MuiButton>
    </Box>
  )
}

// docs/specs/093-team-selection-hub.md (Time slots view): a block per day and slot, one card per club side listing the
// picks in batting order with C / WK markers, the 12th man labelled, the gauge and the announced chip.
export default function SlotsView() {
  return (
    <MatchesFrame>
      {(matches) => <SlotBlocks matches={matches} />}
    </MatchesFrame>
  )
}

function SlotBlocks({ matches }: { matches: TeamSelectionMatch[] }) {
  const groups = useMemo(() => groupGames(matches), [matches])
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {groups.map((group) =>
        group.slots.map((slot) => (
          <Box key={`${group.dateKey}-${slot.dayPart}`} component="section" aria-label={`${dateHeading(group.date)} ${slotLabel(slot.dayPart)}`} sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Typography variant="subtitle2" component="h2" sx={{ fontWeight: 600 }}>
              {dateHeading(group.date)} <Box component="span" sx={{ color: 'text.secondary', fontWeight: 500 }}>{slotLabel(slot.dayPart)}</Box>
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(auto-fill, minmax(280px, 1fr))' }, gap: 1.5 }}>
              {slot.games.flatMap((match) => match.sides.map((side) => <SideCard key={`${match.matchId}:${side.teamId}`} match={match} side={side} />))}
            </Box>
          </Box>
        )),
      )}
    </Box>
  )
}
