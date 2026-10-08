import { Box, Typography } from '@mui/material'
import { STATUS_COLOR, STATUS_LABEL } from '../../utils/availabilityStatus'

export interface PollCoverageCounts {
  // Players who answered every slot / some slots / none.
  all: number
  some: number
  none: number
}

export interface StatusCounts {
  available: number
  unsure: number
  unavailable: number
  noResponse: number
}

export type ResponseGaugeProps = (
  | { mode: 'poll'; coverage: PollCoverageCounts }
  | { mode: 'status'; counts: StatusCounts }
) & {
  // 'header' (default): the bar with its counts underneath, for the page header. 'thin': the bar alone, for a slot card.
  variant?: 'header' | 'thin'
  // Prefix of the segment data-testids (`${testIdPrefix}-bar-${key}`).
  testIdPrefix?: string
}

interface Segment {
  key: string
  label: string
  count: number
  color: string
}

// docs/specs/085 (C6): a slim stacked bar with counts, in two modes - 'poll' (answered all / some / none, for a poll
// with several slots) and 'status' (Available / Unsure / Unavailable / No response with "N of M answered", for a
// single slot or a squad poll). Status is never colour alone: every segment has a word and a count in the legend,
// and the thin bar carries them in its accessible name.
export function ResponseGauge(props: ResponseGaugeProps) {
  const { variant = 'header', testIdPrefix = 'response-gauge' } = props
  const segments: Segment[] =
    props.mode === 'poll'
      ? [
          { key: 'all', label: 'answered all', count: props.coverage.all, color: 'success.main' },
          { key: 'some', label: 'some', count: props.coverage.some, color: 'success.light' },
          { key: 'none', label: 'none', count: props.coverage.none, color: 'grey.400' },
        ]
      : [
          { key: 'AVAILABLE', label: STATUS_LABEL.AVAILABLE, count: props.counts.available, color: `${STATUS_COLOR.AVAILABLE}.main` },
          { key: 'UNSURE', label: STATUS_LABEL.UNSURE, count: props.counts.unsure, color: `${STATUS_COLOR.UNSURE}.main` },
          { key: 'UNAVAILABLE', label: STATUS_LABEL.UNAVAILABLE, count: props.counts.unavailable, color: `${STATUS_COLOR.UNAVAILABLE}.main` },
          { key: 'NONE', label: 'No response', count: props.counts.noResponse, color: 'grey.400' },
        ]
  const total = segments.reduce((sum, segment) => sum + segment.count, 0)
  const answered = props.mode === 'status' ? total - props.counts.noResponse : 0
  const summary = segments.map((segment) => `${segment.count} ${segment.label}`).join(', ')

  const bar = (height: number) => (
    <Box sx={{ display: 'flex', height, borderRadius: 6, overflow: 'hidden', bgcolor: 'grey.400' }} aria-hidden={variant === 'header'}>
      {segments.map((segment) => (
        <Box
          key={segment.key}
          data-testid={`${testIdPrefix}-bar-${segment.key}`}
          sx={{ width: total ? `${(segment.count / total) * 100}%` : 0, bgcolor: segment.color }}
        />
      ))}
    </Box>
  )

  if (variant === 'thin') {
    return (
      <Box role="img" aria-label={summary} data-testid={`${testIdPrefix}-thin`}>
        {bar(6)}
      </Box>
    )
  }

  return (
    <Box
      role="group"
      aria-label="Response summary"
      data-testid={testIdPrefix}
      sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: { xs: '100%', sm: 360 }, maxWidth: '100%', minWidth: 0 }}
    >
      {props.mode === 'status' && (
        <Typography variant="caption" fontWeight={700} color="text.primary" sx={{ alignSelf: 'flex-end' }}>
          {answered} of {total} answered
        </Typography>
      )}
      {bar(8)}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', columnGap: 1.5, rowGap: 0.25 }}>
        {segments.map((segment) => (
          <Typography
            key={segment.key}
            variant="caption"
            color="text.secondary"
            data-legend={`${segment.label} ${segment.count}`}
            sx={{ display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap' }}
          >
            <Box component="span" aria-hidden sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: segment.color, mr: 0.5, flex: '0 0 auto' }} />
            <Box component="b" sx={{ color: 'text.primary', fontVariantNumeric: 'tabular-nums', mr: 0.5 }}>
              {segment.count}
            </Box>
            {segment.label}
          </Typography>
        ))}
      </Box>
    </Box>
  )
}
