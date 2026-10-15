import { useState } from 'react'
import { alpha } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import { Input } from '../Input'
import { sanitizeOvers } from '../../utils/numericInput'
import { ballsToOvers, DEFAULT_BALLS_PER_OVER, parseOvers } from '../../utils/oversFormat'

export interface OversInputProps {
  label: string
  // Balls (what the API carries); null while empty or not a valid overs figure.
  value: number | null
  onChange: (balls: number | null) => void
  ballsPerOver?: number
  disabled?: boolean
  // Optional hint under the field while it is valid.
  helperText?: string
  required?: boolean
  // docs/specs/101: set inside a ScorecardGrid. The field is then a compact cell (no visible label, the label is its
  // accessible name) that the grid's keyboard handling finds by this column.
  gridColumn?: string
  // The accessible name when it should say more than the visible label ("Overs, A. Smith").
  ariaLabel?: string
  // A soft amber warning on the field (the value is missing or looks wrong; never blocks).
  warn?: boolean
}

// docs/specs/100-match-results-core.md: the overs field, hardened (docs/specs/101, input hardening). The manager types "36.4" as on
// the scorecard; the parent holds balls (220). Only digits and one point are accepted, one digit after the point, and a ball
// digit at or above balls per over is simply ignored (typing "9.7" leaves "9."), on typing and on paste (utils/numericInput).
// So nothing invalid can be typed and there is no error state. The parent receives balls as soon as the text is a figure
// ("36" or "36.4"), or null when emptied. The text is local so a half-typed "36." is never rewritten under the cursor; on blur
// (or Enter) it settles to the committed figure ("36.0"), or to empty when cleared.
export function OversInput({ label, value, onChange, ballsPerOver = DEFAULT_BALLS_PER_OVER, disabled = false, helperText, required = false, gridColumn, ariaLabel, warn = false }: OversInputProps) {
  const [text, setText] = useState(() => ballsToOvers(value, ballsPerOver))
  const [seenValue, setSeenValue] = useState(value)

  // The value changed from outside (a reload, a swap of sides): show it, unless the text already means that value.
  if (value !== seenValue) {
    setSeenValue(value)
    const parsed = parseOvers(text, ballsPerOver)
    const textMeansValue = parsed.ok ? parsed.balls === value : value === null
    if (!textMeansValue) setText(ballsToOvers(value, ballsPerOver))
  }

  const settle = () => setText(ballsToOvers(value, ballsPerOver))

  return (
    <Input
      label={gridColumn ? '' : label}
      hiddenLabel={Boolean(gridColumn)}
      required={required}
      disabled={disabled}
      value={text}
      helperText={gridColumn ? undefined : helperText}
      fullWidth={!gridColumn}
      FormHelperTextProps={{ sx: { whiteSpace: 'normal', overflowWrap: 'anywhere', mx: 0 } }}
      onChange={(event) => {
        const next = sanitizeOvers(event.target.value, ballsPerOver, {}, text)
        if (next === text || (event.target.value !== '' && next === '')) return
        setText(next)
        const result = next === '' ? null : parseOvers(next, ballsPerOver)
        const balls = result && result.ok ? result.balls : null
        setSeenValue(balls)
        onChange(balls)
      }}
      onBlur={settle}
      onKeyDown={(event) => {
        if (event.key === 'Enter') settle()
      }}
      inputProps={{
        inputMode: 'decimal',
        pattern: '[0-9]*[.]?[0-9]?',
        enterKeyHint: 'next',
        autoComplete: 'off',
        'aria-label': ariaLabel ?? label,
        onFocus: (event) => event.target.select(),
        ...(gridColumn ? { 'data-grid-cell': '', 'data-grid-col': gridColumn } : {}),
      }}
      sx={{
        '& input': { fontVariantNumeric: 'tabular-nums', ...(gridColumn ? { textAlign: 'right', py: 0, height: 30, fontSize: 12, boxSizing: 'border-box', px: 1, fontWeight: 600 } : {}) },
        ...(gridColumn ? { width: 64, '& .MuiOutlinedInput-root': { borderRadius: 1.5 } } : {}),
        ...(warn ? { '& .MuiOutlinedInput-root': { ...(gridColumn ? { borderRadius: 1.5 } : {}), bgcolor: (theme: Theme) => alpha(theme.palette.warning.main, 0.12) }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'warning.main' } } : {}),
      }}
    />
  )
}

// The overs field under the name of the input family (IntegerField, OversField): the same component.
export { OversInput as OversField }
