import { InputBase } from '@mui/material'
import { alpha } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import { sanitizeInteger } from '../../utils/numericInput'
import { Input } from '../Input'

export interface IntegerFieldProps {
  // Null while empty.
  value: number | null
  onChange: (value: number | null) => void
  // The accessible name ("Runs, A. Smith").
  ariaLabel: string
  // 'field': a labelled form field (the Scores and Innings card inputs). 'cell': the compact borderless-label cell of a
  // scorecard grid, found by the grid's keyboard handling through `column`.
  variant?: 'field' | 'cell'
  label?: string
  // The largest value accepted; a keystroke that would pass it is ignored.
  max?: number
  maxLength?: number
  disabled?: boolean
  // Only for a genuinely invalid committed value: what the characters filter cannot catch (never for blocked keystrokes).
  error?: boolean
  helperText?: string
  // 'cell' only.
  column?: string
  width?: number
  // 'cell' inside a stepper pill: no border of its own.
  bare?: boolean
  // 'cell': a soft amber warning (the value is valid but looks wrong).
  warn?: boolean
  id?: string
}

// docs/specs/101 (input hardening): the ONE integer field. Digits only: a minus, a point, 'e', letters or a pasted "1,234 runs" are
// filtered as they are typed or pasted (utils/numericInput), so an invalid figure cannot be entered. The value is the parent's
// number (or null while empty); the text shown is derived from it, so there is nothing to get out of step. The numeric keypad
// on a phone, no spinner, select on focus.
export function IntegerField({ value, onChange, ariaLabel, variant = 'field', label, max, maxLength, disabled = false, error = false, helperText, column, width = 52, bare = false, warn = false, id }: IntegerFieldProps) {
  const text = value === null ? '' : String(value)
  const handle = (raw: string) => {
    const next = sanitizeInteger(raw, { max, maxLength }, text)
    // A keystroke that was filtered away completely (a letter typed over a selected figure) changes nothing.
    if (next === text || (raw !== '' && next === '')) return
    onChange(next === '' ? null : Number(next))
  }
  const inputProps = {
    id,
    inputMode: 'numeric' as const,
    pattern: '[0-9]*',
    enterKeyHint: 'next' as const,
    autoComplete: 'off',
    'aria-label': ariaLabel,
  }

  if (variant === 'field') {
    return (
      <Input
        label={label ?? ariaLabel}
        value={text}
        disabled={disabled}
        error={error}
        helperText={helperText}
        onChange={(event) => handle(event.target.value)}
        inputProps={{ ...inputProps, onFocus: (event: React.FocusEvent<HTMLInputElement>) => event.target.select() }}
        sx={{ '& input': { fontVariantNumeric: 'tabular-nums' } }}
      />
    )
  }

  return (
    <InputBase
      value={text}
      disabled={disabled}
      error={error}
      onChange={(event) => handle(event.target.value)}
      onFocus={(event) => event.target.select()}
      inputProps={{ ...inputProps, 'data-grid-cell': '', 'data-grid-col': column }}
      sx={{
        width: bare ? 40 : width,
        height: bare ? 42 : 30,
        border: bare ? 0 : 1,
        borderColor: error ? 'error.main' : warn ? 'warning.main' : 'divider',
        borderRadius: bare ? 0 : 1.5,
        bgcolor: bare ? 'transparent' : warn ? (theme: Theme) => alpha(theme.palette.warning.main, 0.12) : 'background.paper',
        fontWeight: 600,
        fontSize: bare ? undefined : 12,
        fontVariantNumeric: 'tabular-nums',
        '& input': { textAlign: bare ? 'center' : 'right', px: 1, height: '100%', boxSizing: 'border-box' },
        '&.Mui-focused': { outline: 2, outlineStyle: 'solid', outlineColor: 'primary.main', outlineOffset: bare ? -2 : 1, borderColor: 'primary.main' },
        '&.Mui-disabled': { bgcolor: 'action.disabledBackground' },
      }}
    />
  )
}

type DomainFieldProps = Omit<IntegerFieldProps, 'max' | 'maxLength'> & { max?: number }

// Runs: up to five digits.
export const RunsField = (props: DomainFieldProps) => <IntegerField maxLength={5} {...props} />

// Wickets: 0 to 10 by default (0 to 2 in a super over: pass max={2}).
export const WicketsField = ({ max = 10, ...props }: DomainFieldProps) => <IntegerField max={max} {...props} />

// Any other count (balls, maidens, dot balls, wides, no-balls, byes, leg byes, penalty runs, a margin, a DLS target): up to four digits.
export const CountField = (props: DomainFieldProps) => <IntegerField maxLength={4} {...props} />
