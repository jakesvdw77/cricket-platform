import { Box, Typography } from '@mui/material'
import type { SectionAvailabilityRoundMatch } from '../../../../api/sectionAvailabilityApi'
import { formatMatchDateTime } from '../pollHelpers'

// docs/specs/065 + 085 (C3): a slot's matches as aligned columns - match (Team v Opponent, bold), date and time,
// league. One CSS grid per list, each match a `display: contents` row, so the columns (and their separators) line up
// across all the lines of the slot. On a phone each match stacks (match, date and time, league). An empty league
// leaves the third cell empty.
export function SlotMatches({ matches }: { matches: SectionAvailabilityRoundMatch[] }) {
  if (matches.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No matches in this slot.
      </Typography>
    )
  }
  // The '·' is generated content with an empty alternative text, so screen readers skip it.
  const separator = { '&::before': { content: '"·" / ""', mr: 1.5, display: { xs: 'none', sm: 'inline' } } }
  return (
    <Box
      data-testid="slot-matches"
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'max-content max-content minmax(0, 1fr)' },
        columnGap: 1.5,
        rowGap: { xs: 1.5, sm: 0.5 },
        alignItems: 'baseline',
      }}
    >
      {matches.map((match) => (
        <Box key={`${match.matchId}-${match.teamId}`} data-testid="slot-match" sx={{ display: { xs: 'grid', sm: 'contents' }, rowGap: 0.25 }}>
          <Typography variant="body2" color="text.primary" fontWeight={600}>
            {match.teamName} v {match.opponentLabel}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={separator}>
            {formatMatchDateTime(match.matchDate)}
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={match.leagueName ? separator : { display: { xs: 'none', sm: 'block' } }}
          >
            {match.leagueName ?? ''}
          </Typography>
        </Box>
      ))}
    </Box>
  )
}
