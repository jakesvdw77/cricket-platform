import { Chip, alpha } from '@mui/material'
import type { Theme } from '@mui/material'
import { useCountdown } from './useCountdown'

export interface CountdownProps {
  // The ISO time being counted down to.
  target: string
  // 'left' reads '3 days 4 h left' (and 'Closing now' at the end), 'to go' reads '3 days 4 h to go'
  // (and 'Starting now').
  phrase: 'left' | 'to go'
  // Hours before the target at which the chip turns amber; 0 never. Default 24.
  warnWithinHours?: number
  // Start of the accessible name, e.g. 'Closes in' -> 'Closes in 5 hours 12 minutes'. Defaults to
  // 'Closes in' for 'left' and 'Starts in' for 'to go'.
  ariaPrefix?: string
}

// docs/specs/082-poll-card-improvements.md: a small live countdown chip, shared so the poll card
// (closing) and later the match card (starting) use one component. role="timer" with a full-sentence
// name and no aria-live, so a screen reader is never interrupted by the ticking. Re-renders come from
// useCountdown's one shared ticker.
export function Countdown({ target, phrase, warnWithinHours = 24, ariaPrefix }: CountdownProps) {
  const state = useCountdown(target, warnWithinHours)
  if (state.stage === 'none') {
    return null
  }
  const prefix = ariaPrefix ?? (phrase === 'left' ? 'Closes in' : 'Starts in')
  const nowText = phrase === 'left' ? 'Closing now' : 'Starting now'
  const expired = state.stage === 'expired'
  const label = expired ? nowText : `${state.text} ${phrase}`
  const accessibleName = expired ? nowText : `${prefix} ${state.spoken}`

  return (
    <Chip
      role="timer"
      size="small"
      label={label}
      aria-label={accessibleName}
      data-warn={state.warn ? 'true' : 'false'}
      sx={{
        position: 'relative',
        height: 24,
        fontWeight: 700,
        fontVariantNumeric: 'tabular-nums',
        border: 1,
        bgcolor: (theme: Theme) => alpha(state.warn ? theme.palette.warning.main : theme.palette.primary.main, 0.14),
        borderColor: (theme: Theme) => alpha(state.warn ? theme.palette.warning.main : theme.palette.primary.main, 0.5),
        color: state.warn ? 'warning.dark' : 'primary.dark',
      }}
    />
  )
}
