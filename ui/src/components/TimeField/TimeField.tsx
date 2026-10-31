import { Box, IconButton, InputAdornment } from '@mui/material'
import type { SxProps, Theme } from '@mui/material'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import { Input } from '../Input'
import { sanitiseTimeText, stepTime, STEP_MINUTES } from '../../utils/timeInput'

export interface TimeFieldProps {
  // The visible (floating) label.
  label: string
  // The accessible name of the text input.
  ariaLabel: string
  // The prefix of the arrows' accessible names ("<prefix>: 15 minutes later"); defaults to the aria label.
  arrowLabel?: string
  // 'HH:MM' text while typing (it may be partial), or ''.
  value: string
  onChange: (value: string) => void
  error?: boolean
  disabled?: boolean
  required?: boolean
  autoFocus?: boolean
  sx?: SxProps<Theme>
}

// The 24-hour time box used by DateTimeField and the import row editor: digits only with the colon inserted, ArrowUp and ArrowDown
// (and the small stacked arrows) step by STEP_MINUTES. Replaces the browser's hour and minute column picker.
export function TimeField({ label, ariaLabel, arrowLabel, value, onChange, error = false, disabled = false, required = false, autoFocus = false, sx }: TimeFieldProps) {
  const step = (direction: 1 | -1) => onChange(stepTime(value, direction))
  // Small stacked arrows, 18 px tall each, so the pair fits the 40 px input. Their hit areas extend sideways only. The arrows are a
  // convenience: the accessible routes are typing the time and the ArrowUp / ArrowDown keys.
  const arrowSx = {
    position: 'relative',
    width: 28,
    height: 18,
    p: 0,
    borderRadius: 0.5,
    '&::after': { content: '""', position: 'absolute', top: 0, bottom: 0, left: -8, right: -8 },
  } as const
  const prefix = arrowLabel ?? ariaLabel
  return (
    <Input
      label={label}
      InputLabelProps={{ shrink: true }}
      value={value}
      onChange={(event) => onChange(sanitiseTimeText(event.target.value))}
      error={error}
      disabled={disabled}
      required={required}
      autoFocus={autoFocus}
      placeholder="HH:MM"
      sx={sx}
      onKeyDown={(event) => {
        if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
          event.preventDefault()
          step(event.key === 'ArrowUp' ? 1 : -1)
        }
      }}
      inputProps={{ 'aria-label': ariaLabel, inputMode: 'numeric', maxLength: 5, autoComplete: 'off' }}
      InputProps={{
        endAdornment: (
          <InputAdornment position="end" sx={{ ml: 0, mr: -0.5 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
              <IconButton size="small" tabIndex={-1} aria-label={`${prefix}: ${STEP_MINUTES} minutes later`} disabled={disabled} onClick={() => step(1)} sx={arrowSx}>
                <KeyboardArrowUpIcon fontSize="small" />
              </IconButton>
              <IconButton size="small" tabIndex={-1} aria-label={`${prefix}: ${STEP_MINUTES} minutes earlier`} disabled={disabled} onClick={() => step(-1)} sx={arrowSx}>
                <KeyboardArrowDownIcon fontSize="small" />
              </IconButton>
            </Box>
          </InputAdornment>
        ),
      }}
    />
  )
}
