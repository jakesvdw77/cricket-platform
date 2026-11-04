import type { ReactNode } from 'react'
import { Stack, Typography } from '@mui/material'

export interface DetailLineProps {
  // docs/specs/141: optional; Details-style rows without icons (Results, Players) omit it.
  icon?: ReactNode
  label: string
  value: ReactNode
  // Width of the label column; the default 56 is the Match card's. The league card passes 78.
  labelWidth?: number
  // Secondary-colour, regular-weight value for a placeholder such as "Not scheduled yet".
  muted?: boolean
  // docs/specs/137: a control at the right end of the row (the venue's Get Directions button); lifted above a card's stretched link by its own styles.
  trailing?: ReactNode
  // docs/specs/138: 'center' lines the icon and label up with a value that carries a button (the Review card's Not recorded + Add). Default 'start'.
  align?: 'start' | 'center'
}

// docs/specs/071-league-card-redesign.md: one stacked detail line - a small icon, a label and the
// value - extracted from MatchCard (069). The card body is not lifted above the title's stretched
// link, so a value should be plain text (a non-interactive badge is fine).
export function DetailLine({ icon, label, value, labelWidth = 56, muted = false, trailing, align = 'start' }: DetailLineProps) {
  return (
    <Stack direction="row" spacing={1.25} alignItems={align === 'center' ? 'center' : 'flex-start'}>
      {icon && (
        <Stack sx={{ color: 'text.secondary', pt: '1px', flexShrink: 0 }} aria-hidden>
          {icon}
        </Stack>
      )}
      <Typography variant="body2" color="text.secondary" sx={{ width: labelWidth, flexShrink: 0 }}>
        {label}
      </Typography>
      <Typography
        variant="body2"
        component="div"
        fontWeight={muted ? 400 : 600}
        color={muted ? 'text.secondary' : undefined}
        sx={{ minWidth: 0, overflowWrap: 'anywhere' }}
      >
        {value}
      </Typography>
      {trailing && <Stack sx={{ ml: 'auto !important', flexShrink: 0, alignSelf: 'center' }}>{trailing}</Stack>}
    </Stack>
  )
}
