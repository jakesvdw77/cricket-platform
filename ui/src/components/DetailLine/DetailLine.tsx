import type { ReactNode } from 'react'
import { Stack, Typography } from '@mui/material'

export interface DetailLineProps {
  icon: ReactNode
  label: string
  value: ReactNode
  // Width of the label column; the default 56 is the Match card's. The league card passes 78.
  labelWidth?: number
  // Secondary-colour, regular-weight value for a placeholder such as "Not scheduled yet".
  muted?: boolean
}

// docs/specs/071-league-card-redesign.md: one stacked detail line - a small icon, a label and the
// value - extracted from MatchCard (069). The card body is not lifted above the title's stretched
// link, so a value should be plain text (a non-interactive badge is fine).
export function DetailLine({ icon, label, value, labelWidth = 56, muted = false }: DetailLineProps) {
  return (
    <Stack direction="row" spacing={1.25} alignItems="flex-start">
      <Stack sx={{ color: 'text.secondary', pt: '1px', flexShrink: 0 }} aria-hidden>
        {icon}
      </Stack>
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
    </Stack>
  )
}
