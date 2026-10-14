import { useId } from 'react'
import { Box, Typography } from '@mui/material'
import type { Innings } from '../../api/matchResultApi'
import { extrasTotal } from '../../utils/battingTotals'
import type { ExtrasBreakdown } from '../../utils/battingTotals'
import { GridNumberInput } from '../ScorecardGrid'

export interface ExtrasFieldsProps {
  value: ExtrasBreakdown
  // The part that changed; the parent keeps the rest.
  onChange: (patch: Partial<Pick<Innings, 'wides' | 'noBalls' | 'byes' | 'legByes' | 'penaltyRuns'>>) => void
  disabled?: boolean
  // Whose extras these are, for the accessible names ("Wides, Riverside 1st XI").
  owner?: string
  // The sum is shown beside the fields ("Extras 14"); hide it where the parent shows its own total.
  hideTotal?: boolean
  // A small note under one field ("Edited. Calculated: 12" with a Reset), for figures derived elsewhere.
  fieldNote?: (key: (typeof FIELDS)[number]['key']) => React.ReactNode
}

const FIELDS = [
  { key: 'wides', label: 'Wides' },
  { key: 'noBalls', label: 'No-balls' },
  { key: 'byes', label: 'Byes' },
  { key: 'legByes', label: 'Leg byes' },
  { key: 'penaltyRuns', label: 'Penalty' },
] as const

// docs/specs/101-match-results-our-side-scorecard.md: the extras row under the batting grid (our extras) and the bowling
// panel (the opposition's): Wides, No-balls, Byes, Leg byes, Penalty and their sum, which the server stores as the
// innings' `extras`. The number cells join the grid's keyboard flow (Enter moves on). Wides and no-balls are charged to
// bowlers; byes, leg byes and penalty runs are not.
export function ExtrasFields({ value, onChange, disabled = false, owner, hideTotal = false, fieldNote }: ExtrasFieldsProps) {
  const prefix = useId()
  const total = extrasTotal(value)
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1.5, flexWrap: 'wrap' }} role="group" aria-label={owner ? `Extras, ${owner}` : 'Extras'}>
      {FIELDS.map(({ key, label }) => {
        const id = `${prefix}-${key}`
        return (
          <Box key={key} sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Typography component="label" htmlFor={id} variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
              {label}
            </Typography>
            <GridNumberInput
              id={id}
              value={value[key] ?? null}
              onChange={(next) => onChange({ [key]: next })}
              ariaLabel={owner ? `${label}, ${owner}` : label}
              column={`extras-${key}`}
              disabled={disabled}
              width={72}
            />
            {fieldNote?.(key)}
          </Box>
        )
      })}
      {!hideTotal && (
        <Typography variant="body2" sx={{ fontWeight: 700, ml: { sm: 'auto' }, pb: 0.75, fontVariantNumeric: 'tabular-nums' }}>
          {`Extras ${total}`}
        </Typography>
      )}
    </Box>
  )
}
