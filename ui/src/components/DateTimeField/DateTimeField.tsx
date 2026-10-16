import { useState } from 'react'
import { Box, FormHelperText, IconButton, InputAdornment } from '@mui/material'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import { Input } from '../Input'
import { isCompleteTime, sanitiseTimeText, stepTime, STEP_MINUTES } from '../../utils/timeInput'

export interface DateTimeFieldProps {
  label: string
  // 'YYYY-MM-DDTHH:mm' in local time (the same string a datetime-local input holds), or ''.
  value: string
  onChange: (value: string) => void
  error?: boolean
  helperText?: string
  disabled?: boolean
  required?: boolean
  // 'YYYY-MM-DDTHH:mm' or 'YYYY-MM-DD'; only the date part reaches the date input.
  min?: string
  max?: string
  'data-testid'?: string
}

function splitValue(value: string): { date: string; time: string } {
  const [date = '', time = ''] = value.split('T')
  return { date, time: time.slice(0, 5) }
}

function compose(date: string, time: string): string {
  return date && isCompleteTime(time) ? `${date}T${time}` : ''
}

// Replaces the browser's datetime-local picker, whose hour and minute columns are hard to use.
// Holds the same value string, so saved data and the server are unchanged. The date and time are
// kept as a draft here so a time typed before the date is not lost while the value stays ''.
export function DateTimeField({
  label,
  value,
  onChange,
  error = false,
  helperText,
  disabled = false,
  required = false,
  min,
  max,
  'data-testid': testId,
}: DateTimeFieldProps) {
  const [draft, setDraft] = useState(() => splitValue(value))
  const [seenValue, setSeenValue] = useState(value)
  // A value changed from outside (a default recomputed, a form reset) replaces the draft; a value
  // that is just our own latest emit does not.
  if (value !== seenValue) {
    setSeenValue(value)
    if (value !== compose(draft.date, draft.time)) setDraft(splitValue(value))
  }

  const update = (next: { date: string; time: string }) => {
    setDraft(next)
    const composed = compose(next.date, next.time)
    if (composed !== value) {
      setSeenValue(composed)
      onChange(composed)
    }
  }

  const step = (direction: 1 | -1) => update({ ...draft, time: stepTime(draft.time, direction) })
  // Small stacked arrows, 18 px each; the 44 px touch target is kept by extending the hit area sideways (as GuessChip does).
  const arrowSx = {
    position: 'relative',
    width: 28,
    height: 18,
    p: 0,
    borderRadius: 0.5,
    '&::after': { content: '""', position: 'absolute', top: 0, bottom: 0, left: -8, right: -8 },
  } as const

  const helperId = helperText ? `${testId ?? label.replace(/\W+/g, '-')}-helper` : undefined
  // Both boxes keep the standard Input height so the pair lines up with the neighbouring fields; the labels float on the border.
  const shrink = { shrink: true }

  return (
    <Box role="group" aria-label={label} aria-describedby={helperId} data-testid={testId}>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 9rem', gap: 1 }}>
        <Input
          label={label}
          type="date"
          InputLabelProps={shrink}
          value={draft.date}
          onChange={(event) => update({ ...draft, date: event.target.value })}
          error={error}
          disabled={disabled}
          required={required}
          inputProps={{ 'aria-label': `${label} (date)`, min: min?.slice(0, 10), max: max?.slice(0, 10) }}
        />
        <Input
          label="Time"
          InputLabelProps={shrink}
          value={draft.time}
          onChange={(event) => update({ ...draft, time: sanitiseTimeText(event.target.value) })}
          error={error}
          disabled={disabled}
          required={required}
          placeholder="HH:MM"
          onKeyDown={(event) => {
            if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
              event.preventDefault()
              step(event.key === 'ArrowUp' ? 1 : -1)
            }
          }}
          inputProps={{ 'aria-label': `${label} (time)`, inputMode: 'numeric', maxLength: 5, autoComplete: 'off' }}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end" sx={{ ml: 0, mr: -0.5 }}>
                <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                  <IconButton size="small" tabIndex={-1} aria-label={`${label}: ${STEP_MINUTES} minutes later`} disabled={disabled} onClick={() => step(1)} sx={arrowSx}>
                    <KeyboardArrowUpIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" tabIndex={-1} aria-label={`${label}: ${STEP_MINUTES} minutes earlier`} disabled={disabled} onClick={() => step(-1)} sx={arrowSx}>
                    <KeyboardArrowDownIcon fontSize="small" />
                  </IconButton>
                </Box>
              </InputAdornment>
            ),
          }}
        />
      </Box>
      {helperText && (
        <FormHelperText id={helperId} error={error} sx={{ mx: '14px' }}>
          {helperText}
        </FormHelperText>
      )}
    </Box>
  )
}
