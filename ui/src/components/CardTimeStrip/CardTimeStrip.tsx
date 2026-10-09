import type { ReactNode } from 'react'
import { Box, Typography, alpha } from '@mui/material'
import type { Theme } from '@mui/material'

export interface CardTimeStripProps {
  // A 20 px MUI outlined icon (the poll card passes EventBusyOutlined, the match card EventOutlined).
  icon: ReactNode
  label: string
  value: ReactNode
  // 'warning' is the amber tone (within 24 hours); anything else is the neutral primary tint.
  tone?: 'neutral' | 'warning'
  // Small controls right after the value (the poll card's close-time pencil). Give an interactive one its own
  // position: relative so it stays above a stretched card link.
  action?: ReactNode
  // Right-aligned from sm up (a Countdown chip).
  trailing?: ReactNode
  testId?: string
}

// docs/specs/082 (poll card) and docs/specs/087 (match card): the tinted strip a card reads first - icon, a label
// ("Poll closes", "Starts", "Played"), the date and time in bold, optional controls and a countdown - neutral, or
// amber when the time is close. Extracted from PollCard so the two cards cannot drift.
export function CardTimeStrip({ icon, label, value, tone = 'neutral', action, trailing, testId }: CardTimeStripProps) {
  const warn = tone === 'warning'
  return (
    <Box
      data-testid={testId}
      data-tone={warn ? 'warning' : 'neutral'}
      sx={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        columnGap: 1,
        rowGap: 0.5,
        px: 1.5,
        py: 1,
        borderRadius: 1,
        border: 1,
        bgcolor: (theme: Theme) => (warn ? alpha(theme.palette.warning.main, 0.14) : alpha(theme.palette.primary.main, 0.08)),
        borderColor: (theme: Theme) => (warn ? alpha(theme.palette.warning.main, 0.5) : theme.palette.divider),
        color: warn ? 'warning.dark' : 'text.primary',
      }}
    >
      <Box component="span" aria-hidden sx={{ display: 'inline-flex', color: 'inherit' }}>
        {icon}
      </Box>
      <Typography variant="body2" component="span" sx={{ color: warn ? 'warning.dark' : 'text.secondary', fontWeight: 600 }}>
        {label}
      </Typography>
      <Typography variant="subtitle1" component="span" fontWeight={700} sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
        {value}
      </Typography>
      {action}
      {trailing && <Box sx={{ ml: { sm: 'auto' } }}>{trailing}</Box>}
    </Box>
  )
}
