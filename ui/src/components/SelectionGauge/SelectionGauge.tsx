import { Box, Typography } from '@mui/material'

export interface SelectionGaugeProps {
  picked: number
  // The playing XI size (a league match's limit).
  size: number
  ariaLabel: string
  // Prefix of the data-testids (`${testIdPrefix}-fill`, `-picked`, `-togo`).
  testIdPrefix?: string
  // docs/specs/091: the League card reuses the gauge as "Played / To go"; the defaults are the match page's wording.
  pickedLabel?: string
  toGoLabel?: string
  completeLabel?: string
}

function Key({ color, count, label, testId }: { color: string; count: number; label: string; testId: string }) {
  return (
    <Box component="span" data-testid={testId} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, fontSize: '0.8125rem' }}>
      <Box component="span" aria-hidden sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: color, display: 'inline-block' }} />
      <b>{count}</b> {label}
    </Box>
  )
}

// docs/specs/089 (A, revised): the selection of a team on the match page, drawn like the poll response gauge - a 10 px bar
// and a colour-keyed count legend underneath ("● 10 Picked  ● 2 To go", "Squad complete" once full).
export function SelectionGauge({
  picked,
  size,
  ariaLabel,
  testIdPrefix = 'selection',
  pickedLabel = 'Picked',
  toGoLabel = 'To go',
  completeLabel = 'Squad complete',
}: SelectionGaugeProps) {
  const clamped = Math.max(0, Math.min(picked, size))
  const percent = size > 0 ? Math.min(100, (clamped / size) * 100) : 0
  const complete = size > 0 && picked >= size
  return (
    <Box>
      <Box
        role="progressbar"
        aria-label={ariaLabel}
        aria-valuemin={0}
        aria-valuemax={size}
        aria-valuenow={clamped}
        aria-valuetext={`${picked} of ${size} ${pickedLabel.toLowerCase()}`}
        sx={{ height: 10, borderRadius: 6, overflow: 'hidden', bgcolor: 'grey.300' }}
      >
        <Box data-testid={`${testIdPrefix}-fill`} sx={{ width: `${percent}%`, height: '100%', bgcolor: 'primary.main' }} />
      </Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 1 }}>
        <Key color="primary.main" count={picked} label={pickedLabel} testId={`${testIdPrefix}-picked`} />
        {complete ? (
          <Typography component="span" variant="caption" color="text.secondary" data-testid={`${testIdPrefix}-complete`}>
            {completeLabel}
          </Typography>
        ) : (
          <Key color="grey.400" count={Math.max(0, size - picked)} label={toGoLabel} testId={`${testIdPrefix}-togo`} />
        )}
      </Box>
    </Box>
  )
}
