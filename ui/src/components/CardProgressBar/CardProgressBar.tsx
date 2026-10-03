import { Box } from '@mui/material'

export interface CardProgressBarProps {
  value: number
  max: number
  ariaLabel: string
  valueText: string
}

// docs/specs/071-league-card-redesign.md: the rounded 10px track with a solid primary fill shared by
// the Match card's Selection block and the League card's progress block (mirrors SlotSummary's bar).
// `value` is clamped to 0..max for both the fill and aria-valuenow; with max 0 the bar is empty.
export function CardProgressBar({ value, max, ariaLabel, valueText }: CardProgressBarProps) {
  const clamped = Math.max(0, Math.min(value, max))
  const percent = max > 0 ? Math.min(100, (clamped / max) * 100) : 0
  return (
    <Box
      role="progressbar"
      aria-label={ariaLabel}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={clamped}
      aria-valuetext={valueText}
      sx={{ height: 10, borderRadius: 6, overflow: 'hidden', bgcolor: 'grey.400' }}
    >
      <Box data-testid="selection-bar-fill" sx={{ width: `${percent}%`, height: '100%', bgcolor: 'primary.main' }} />
    </Box>
  )
}
