import { useState } from 'react'
import { Box, Button, FormHelperText, FormLabel } from '@mui/material'
import { Input } from '../Input'
import { isCompleteTime, sanitiseTimeText } from '../../utils/timeInput'

const DEFAULT_QUICK_TIMES = ['08:00', '09:00', '10:00', '12:00', '13:00', '14:00']

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
  // One-tap times shown under the time box (24-hour 'HH:MM').
  quickTimes?: string[]
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
  quickTimes = DEFAULT_QUICK_TIMES,
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

  const helperId = helperText ? `${testId ?? label.replace(/\W+/g, '-')}-helper` : undefined
  const fieldSx = { '& .MuiInputBase-root': { minHeight: 44 } }

  return (
    <Box role="group" aria-label={label} aria-describedby={helperId} data-testid={testId}>
      <FormLabel
        aria-hidden
        required={required}
        error={error}
        disabled={disabled}
        sx={{ display: 'block', mb: 0.75, fontSize: '0.8rem', color: error ? 'error.main' : 'text.secondary' }}
      >
        {label}
      </FormLabel>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 7.5rem', gap: 1 }}>
        <Input
          label=""
          type="date"
          value={draft.date}
          onChange={(event) => update({ ...draft, date: event.target.value })}
          error={error}
          disabled={disabled}
          required={required}
          inputProps={{ 'aria-label': `${label} (date)`, min: min?.slice(0, 10), max: max?.slice(0, 10) }}
          sx={fieldSx}
        />
        <Input
          label=""
          value={draft.time}
          onChange={(event) => update({ ...draft, time: sanitiseTimeText(event.target.value) })}
          error={error}
          disabled={disabled}
          required={required}
          placeholder="HH:MM"
          inputProps={{ 'aria-label': `${label} (time)`, inputMode: 'numeric', maxLength: 5, autoComplete: 'off' }}
          sx={fieldSx}
        />
      </Box>
      {quickTimes.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
          {quickTimes.map((time) => (
            <Button
              key={time}
              size="small"
              variant={draft.time === time ? 'contained' : 'outlined'}
              aria-pressed={draft.time === time}
              aria-label={`Set ${label} to ${time}`}
              disabled={disabled}
              onClick={() => update({ ...draft, time })}
              sx={{ minHeight: 44, minWidth: 64, fontVariantNumeric: 'tabular-nums' }}
            >
              {time}
            </Button>
          ))}
        </Box>
      )}
      {helperText && (
        <FormHelperText id={helperId} error={error} sx={{ mx: '14px' }}>
          {helperText}
        </FormHelperText>
      )}
    </Box>
  )
}
