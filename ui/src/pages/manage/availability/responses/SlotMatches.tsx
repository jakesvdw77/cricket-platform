import { Stack, Typography } from '@mui/material'
import type { SectionAvailabilityRoundMatch } from '../../../../api/sectionAvailabilityApi'
import { formatMatchDateTime } from '../pollHelpers'

// docs/specs/065: a slot's matches (team v opponent, time, league), shared by the By time slot
// blocks and the Summary cards.
export function SlotMatches({ matches }: { matches: SectionAvailabilityRoundMatch[] }) {
  if (matches.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No matches in this slot.
      </Typography>
    )
  }
  return (
    <Stack spacing={0.5}>
      {matches.map((match) => (
        <Typography key={`${match.matchId}-${match.teamId}`} variant="body2" color="text.secondary">
          <Typography component="span" variant="body2" color="text.primary" fontWeight={600}>
            {match.teamName} v {match.opponentLabel}
          </Typography>
          {` · ${formatMatchDateTime(match.matchDate)}`}
          {match.leagueName ? ` · ${match.leagueName}` : ''}
        </Typography>
      ))}
    </Stack>
  )
}
