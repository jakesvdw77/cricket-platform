import { Box, Stack, Typography } from '@mui/material'
import { Card } from '../../../../components/Card'
import { STATUS_COLOR, STATUS_LABEL } from '../../../../utils/availabilityStatus'
import { SlotMatches } from './SlotMatches'
import { slotHeading } from './responseHelpers'
import type { SlotGroup } from './responseHelpers'

// docs/specs/065 "Summary": per slot, a proportional stacked bar plus a text legend with the four
// counts (never colour alone). Counts come from the payload's bracket totals, so a player search
// never changes them.
export function ResponsesSummary({ slots }: { slots: SlotGroup[] }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, gap: 2 }}>
      {slots.map(({ bracket, matches }) => {
        const segments = [
          { key: 'AVAILABLE', label: STATUS_LABEL.AVAILABLE, count: bracket.availableCount, color: `${STATUS_COLOR.AVAILABLE}.main` },
          { key: 'UNSURE', label: STATUS_LABEL.UNSURE, count: bracket.unsureCount, color: `${STATUS_COLOR.UNSURE}.main` },
          { key: 'UNAVAILABLE', label: STATUS_LABEL.UNAVAILABLE, count: bracket.unavailableCount, color: `${STATUS_COLOR.UNAVAILABLE}.main` },
          { key: 'NONE', label: 'No response', count: bracket.noResponseCount, color: 'grey.400' },
        ]
        const total = segments.reduce((sum, segment) => sum + segment.count, 0)
        const answered = total - bracket.noResponseCount
        const heading = slotHeading(bracket)
        return (
          <Card key={bracket.windowId} aria-label={`${heading} summary`}>
            <Stack spacing={1.5}>
              <Typography variant="subtitle1" component="h3" fontWeight={700}>
                {heading}
              </Typography>
              <SlotMatches matches={matches} />
              <Box sx={{ display: 'flex', height: 12, borderRadius: 6, overflow: 'hidden', bgcolor: 'divider' }} aria-hidden>
                {segments.map((segment) => (
                  <Box
                    key={segment.key}
                    data-testid={`${bracket.windowId}-bar-${segment.key}`}
                    sx={{ width: total ? `${(segment.count / total) * 100}%` : 0, bgcolor: segment.color }}
                  />
                ))}
              </Box>
              <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                {segments.map((segment) => (
                  <Stack key={segment.key} direction="row" spacing={0.75} alignItems="center">
                    <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: segment.color }} aria-hidden />
                    <Typography variant="body2">
                      {segment.label} {segment.count}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
              <Typography variant="body2" color="text.secondary">
                {answered} of {total} answered
              </Typography>
            </Stack>
          </Card>
        )
      })}
    </Box>
  )
}
