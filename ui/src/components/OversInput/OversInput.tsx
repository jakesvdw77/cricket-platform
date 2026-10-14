import { useState } from 'react'
import { Input } from '../Input'
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
}

// docs/specs/100-match-results-core.md: the overs field. The manager types "36.4" as on the scorecard; the parent holds
// balls (220). A ball digit at or above balls per over is refused in plain English ("36.7"), and the parent receives null
// until the text is valid. The text is local so a half-typed figure is never rewritten under the cursor.
export function OversInput({ label, value, onChange, ballsPerOver = DEFAULT_BALLS_PER_OVER, disabled = false, helperText, required = false, gridColumn }: OversInputProps) {
  const [text, setText] = useState(() => ballsToOvers(value, ballsPerOver))
  const [seenValue, setSeenValue] = useState(value)

  // The value changed from outside (a reload, a swap of sides): show it, unless the text already means that value.
  if (value !== seenValue) {
    setSeenValue(value)
    const parsed = parseOvers(text, ballsPerOver)
    const textMeansValue = parsed.ok ? parsed.balls === value : value === null
    if (!textMeansValue) setText(ballsToOvers(value, ballsPerOver))
  }

  const trimmed = text.trim()
  const parsed = trimmed === '' ? null : parseOvers(trimmed, ballsPerOver)
  const error = parsed && parsed.ok === false ? parsed.error : null

  return (
    <Input
      label={gridColumn ? '' : label}
      hiddenLabel={Boolean(gridColumn)}
      required={required}
      disabled={disabled}
      value={text}
      error={Boolean(error)}
      helperText={gridColumn ? undefined : (error ?? helperText)}
      title={gridColumn ? (error ?? undefined) : undefined}
      fullWidth={!gridColumn}
      FormHelperTextProps={{ sx: { whiteSpace: 'normal', overflowWrap: 'anywhere', mx: 0 } }}
      onChange={(event) => {
        const next = event.target.value
        setText(next)
        const result = next.trim() === '' ? null : parseOvers(next, ballsPerOver)
        const balls = result && result.ok ? result.balls : null
        setSeenValue(balls)
        onChange(balls)
      }}
      inputProps={{
        inputMode: 'decimal',
        'aria-label': label,
        ...(gridColumn ? { 'data-grid-cell': '', 'data-grid-col': gridColumn, onFocus: (event) => event.target.select() } : {}),
      }}
      sx={{
        '& input': { fontVariantNumeric: 'tabular-nums', ...(gridColumn ? { textAlign: 'right', py: 0, height: 30, fontSize: 12, boxSizing: 'border-box', px: 1, fontWeight: 600 } : {}) },
        ...(gridColumn ? { width: 64, '& .MuiOutlinedInput-root': { borderRadius: 1.5 } } : {}),
      }}
    />
  )
}
