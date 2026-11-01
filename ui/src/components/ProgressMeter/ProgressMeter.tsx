import { Box, Typography } from '@mui/material'

export interface ProgressMeterProps {
  value: number
  max: number
  // Accessible name of the bar, e.g. "Matches played".
  ariaLabel: string
  // The text above the bar; defaults to "3 of 4".
  label?: string
  // Shown (italic) above a dashed empty bar when max is 0, e.g. "No matches scheduled".
  emptyLabel?: string
  // Prefix of the data-testids (`${testId}-label`, `-fill`).
  testId?: string
  // The fill colour: primary (default) or the amber warning state.
  tone?: 'primary' | 'warning'
}

// The ONE x-of-y progress look (docs/standards/page-anatomy.md): the text above ("3 of 4"), a 6 px rounded bar
// below filling its cell. With max 0 it shows an italic caption over a dashed empty bar. `value` is clamped to 0..max.
export function ProgressMeter({ value, max, ariaLabel, label, emptyLabel = 'Nothing to track', testId = 'progress-meter', tone = 'primary' }: ProgressMeterProps) {
  if (max <= 0) {
    return (
      <Box data-testid={testId} sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, minWidth: 0 }}>
        <Typography variant="caption" color="text.secondary" data-testid={`${testId}-label`} sx={{ fontStyle: 'italic', whiteSpace: 'nowrap', lineHeight: 1.2 }}>
          {emptyLabel}
        </Typography>
        <Box aria-hidden sx={{ height: 6, borderRadius: 3, bgcolor: 'grey.200', border: 1, borderStyle: 'dashed', borderColor: 'divider' }} />
      </Box>
    )
  }
  const clamped = Math.max(0, Math.min(value, max))
  const text = label ?? `${clamped} of ${max}`
  return (
    <Box data-testid={testId} sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary" data-testid={`${testId}-label`} sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, whiteSpace: 'nowrap', lineHeight: 1.2 }}>
        {text}
      </Typography>
      <Box
        role="progressbar"
        aria-label={ariaLabel}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={clamped}
        aria-valuetext={text}
        sx={{ height: 6, borderRadius: 3, bgcolor: 'grey.300', overflow: 'hidden' }}
      >
        <Box
          data-testid={`${testId}-fill`}
          sx={{
            width: `${(clamped / max) * 100}%`,
            height: '100%',
            bgcolor: tone === 'warning' ? 'warning.main' : 'primary.main',
            transition: 'width 200ms ease',
            '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
          }}
        />
      </Box>
    </Box>
  )
}
