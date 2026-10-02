import type { ReactNode } from 'react'
import { Box, Stack, Typography } from '@mui/material'
import { STATUS_COLOR, STATUS_LABEL } from '../../utils/availabilityStatus'

export interface SlotSummaryCounts {
  available: number
  unsure: number
  unavailable: number
  noResponse: number
}

export interface SlotSummaryProps {
  heading: string
  counts: SlotSummaryCounts
  // Prefix of each bar segment's data-testid (`${testIdPrefix}-bar-AVAILABLE` ...); omitted = none.
  testIdPrefix?: string
  // The poll-card variant: a smaller heading (an h4, since the card's own title is the h3), a
  // thinner bar and a tighter legend. The default is the full Summary view of the responses page.
  compact?: boolean
  // Optional content rendered between the heading and the bar (the responses page lists the
  // slot's matches there).
  children?: ReactNode
}

// docs/specs/065 "Summary" and docs/specs/066: one time slot drawn as a heading, a proportional
// stacked bar (Available / Unsure / Unavailable / No response), a text legend carrying the four
// counts (so status is never colour alone) and 'N of M answered'. Shared by the group poll
// Responses page's Summary view and the unified poll card.
export function SlotSummary({ heading, counts, testIdPrefix, compact = false, children }: SlotSummaryProps) {
  const segments = [
    { key: 'AVAILABLE', label: STATUS_LABEL.AVAILABLE, count: counts.available, color: `${STATUS_COLOR.AVAILABLE}.main` },
    { key: 'UNSURE', label: STATUS_LABEL.UNSURE, count: counts.unsure, color: `${STATUS_COLOR.UNSURE}.main` },
    { key: 'UNAVAILABLE', label: STATUS_LABEL.UNAVAILABLE, count: counts.unavailable, color: `${STATUS_COLOR.UNAVAILABLE}.main` },
    { key: 'NONE', label: 'No response', count: counts.noResponse, color: 'grey.400' },
  ]
  const total = segments.reduce((sum, segment) => sum + segment.count, 0)
  const answered = total - counts.noResponse

  return (
    <Stack spacing={compact ? 0.75 : 1.5}>
      <Typography
        variant={compact ? 'subtitle2' : 'subtitle1'}
        component={compact ? 'h4' : 'h3'}
        fontWeight={700}
      >
        {heading}
      </Typography>
      {children}
      <Box sx={{ display: 'flex', height: compact ? 8 : 12, borderRadius: 6, overflow: 'hidden', bgcolor: 'divider' }} aria-hidden>
        {segments.map((segment) => (
          <Box
            key={segment.key}
            data-testid={testIdPrefix ? `${testIdPrefix}-bar-${segment.key}` : undefined}
            sx={{ width: total ? `${(segment.count / total) * 100}%` : 0, bgcolor: segment.color }}
          />
        ))}
      </Box>
      <Stack direction="row" columnGap={compact ? 1.5 : 2} rowGap={0.25} flexWrap="wrap">
        {segments.map((segment) => (
          <Stack key={segment.key} direction="row" spacing={compact ? 0.5 : 0.75} alignItems="center">
            <Box sx={{ width: compact ? 8 : 10, height: compact ? 8 : 10, borderRadius: '50%', bgcolor: segment.color, flexShrink: 0 }} aria-hidden />
            <Typography variant={compact ? 'caption' : 'body2'}>
              {segment.label} {segment.count}
            </Typography>
          </Stack>
        ))}
      </Stack>
      <Typography variant={compact ? 'caption' : 'body2'} color="text.secondary">
        {answered} of {total} answered
      </Typography>
    </Stack>
  )
}
