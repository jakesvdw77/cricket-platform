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
      {/* docs/specs/082: 'N of M answered' shares the heading's line, right-aligned and never broken
          inside; when the row is too tight it wraps onto its own line under the heading, left-aligned. */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'baseline', columnGap: 1.5, rowGap: 0.25 }}>
        <Typography
          variant={compact ? 'subtitle2' : 'subtitle1'}
          component={compact ? 'h4' : 'h3'}
          fontWeight={700}
          sx={{ flex: '1 1 auto', minWidth: 0 }}
        >
          {heading}
        </Typography>
        <Typography variant="body2" fontWeight={700} color="text.primary" sx={{ whiteSpace: 'nowrap' }}>
          {answered} of {total} answered
        </Typography>
      </Box>
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
      {/* docs/specs/082 Legend labels: ONE grid so the dots, words and counts form straight columns
          across both rows - [dot][word][count] x 2 pairs, the second pair set off by a wider gap, items
          in the order Available, Unsure / Unavailable, No response. Body-size words in the primary text
          colour, bold tabular counts, 10px dots; the word stays beside the dot (never colour alone). Each
          item wrapper is display: contents, so its cells are direct grid children; the cells read in
          order as 'Available 4'. Under ~300px of card width it falls back to one pair per row. */}
      <Box sx={{ containerType: 'inline-size' }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(6, auto)',
            justifyContent: 'start',
            columnGap: 1,
            rowGap: 0.5,
            alignItems: 'center',
            '& [data-pair="2"] > :first-of-type': { ml: 2 },
            '@container (max-width: 299px)': {
              gridTemplateColumns: 'repeat(3, auto)',
              '& [data-pair="2"] > :first-of-type': { ml: 0 },
            },
          }}
        >
          {segments.map((segment, index) => (
            <Box
              key={segment.key}
              data-legend={`${segment.label} ${segment.count}`}
              data-pair={index % 2 === 0 ? '1' : '2'}
              sx={{ display: 'contents' }}
            >
              <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: segment.color }} aria-hidden />
              <Typography variant="body2" component="span" color="text.primary">
                {segment.label}
              </Typography>
              <Typography
                variant="body2"
                component="span"
                color="text.primary"
                sx={{ fontSize: '1rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}
              >
                {segment.count}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>
    </Stack>
  )
}
