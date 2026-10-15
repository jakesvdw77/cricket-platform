import { Box, IconButton } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import RemoveIcon from '@mui/icons-material/Remove'
import { IntegerField } from '../IntegerField'

export interface GridNumberInputProps {
  // Null while empty.
  value: number | null
  onChange: (value: number | null) => void
  // The cell's accessible name, "Runs, A. Smith": every cell has one.
  ariaLabel: string
  // The grid column the cell belongs to; ArrowUp / ArrowDown move within it.
  column: string
  disabled?: boolean
  // The largest value accepted while typing (a count of balls, for instance); omitted, no limit.
  max?: number
  // Phone cards: a minus and a plus button either side of the field (44 px) on top of the numeric keypad.
  stepper?: boolean
  // A soft warning: an amber border and tint (never blocks).
  warn?: boolean
  width?: number
  // The input's id, so a visible <label htmlFor> can point at it.
  id?: string
}

// The number cell of the scorecard grids: a real, labelled input (not a custom widget) that selects its content on focus
// and asks a phone for the numeric keypad. `data-grid-cell` and `data-grid-col` are what ScorecardGrid's keyboard
// handling finds it by, so the same cell works in the batting, bowling and extras rows.
export function GridNumberInput({ value, onChange, ariaLabel, column, disabled = false, max, stepper = false, warn = false, width = 52, id }: GridNumberInputProps) {
  const set = (next: number | null) => onChange(next === null ? null : max != null ? Math.min(next, max) : next)

  // The cell itself is the shared IntegerField (digits only, capped at `max`); this component adds the stepper pill.
  const field = (
    <IntegerField variant="cell" value={value} onChange={(next) => set(next)} ariaLabel={ariaLabel} column={column} disabled={disabled} max={max} warn={warn} bare={stepper} width={width} id={id} />
  )

  if (!stepper) return field
  return (
    // docs/specs/101 mockup: one bordered pill holding "– 2 +", green minus and plus, the value centred.
    <Box sx={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'space-between', border: 1, borderColor: 'divider', borderRadius: '8px', height: 44, bgcolor: 'background.paper', px: 0.25 }}>
      <IconButton
        aria-label={`Decrease ${ariaLabel}`}
        size="small"
        disabled={disabled || (value ?? 0) <= 0}
        onClick={() => set(Math.max(0, (value ?? 0) - 1))}
        sx={{ width: 40, height: 40, color: 'primary.main' }}
      >
        <RemoveIcon fontSize="small" />
      </IconButton>
      {field}
      <IconButton
        aria-label={`Increase ${ariaLabel}`}
        size="small"
        disabled={disabled}
        onClick={() => set((value ?? 0) + 1)}
        sx={{ width: 40, height: 40, color: 'primary.main' }}
      >
        <AddIcon fontSize="small" />
      </IconButton>
    </Box>
  )
}
