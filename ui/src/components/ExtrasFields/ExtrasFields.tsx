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
  // A field tinted amber (its typed figure differs from what the bowlers add up to).
  flagged?: (key: (typeof FIELDS)[number]['key']) => boolean
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
export function ExtrasFields({ value, onChange, disabled = false, owner, hideTotal = false, fieldNote, flagged }: ExtrasFieldsProps) {
  const prefix = useId()
  const total = extrasTotal(value)
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, flexWrap: 'wrap' }} role="group" aria-label={owner ? `Extras, ${owner}` : 'Extras'}>
      {/* Compact fixed-width cells (three to a row on a phone); every field has one fixed caption line so nothing shifts. */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', columnGap: 1.5, rowGap: 0.5, maxWidth: { xs: 276, sm: 'none' } }}>
      {FIELDS.map(({ key, label }) => {
        const id = `${prefix}-${key}`
        return (
          <Box key={key} sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: 84 }}>
            <Typography component="label" htmlFor={id} variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '0.6875rem' }}>
              {label}
            </Typography>
            <GridNumberInput
              id={id}
              value={value[key] ?? null}
              onChange={(next) => onChange({ [key]: next })}
              ariaLabel={owner ? `${label}, ${owner}` : label}
              column={`extras-${key}`}
              disabled={disabled}
              warn={flagged?.(key) ?? false}
              width={72}
            />
            <Box sx={{ minHeight: { xs: 32, sm: 18 }, display: 'flex', alignItems: 'center' }}>{fieldNote?.(key)}</Box>
          </Box>
        )
      })}
      </Box>
      {!hideTotal && (
        <Typography variant="body2" sx={{ fontWeight: 700, ml: { sm: 'auto' }, pt: 2.5, fontVariantNumeric: 'tabular-nums' }}>
          {`Extras ${total}`}
        </Typography>
      )}
    </Box>
  )
}
