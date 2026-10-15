import type { ReactNode } from 'react'
import { Box, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import { CardProgressBar } from '../CardProgressBar'

export type ReconcileTone = 'ok' | 'warning' | 'neutral'

export interface ReconcileStripProps {
  // 'ok' a tick, 'warning' the amber state (a mismatch is a strip, never a block), 'neutral' nothing to compare yet.
  tone: ReconcileTone
  // The figures: "Total 148 = 135 off the bat + 13 extras", "Balls 238 of 240 · 2 left".
  title: ReactNode
  // The verdict in words, so the state is never colour alone: "matches the innings total", "1 more than the result says".
  status?: ReactNode
  // An optional meter under the text ("Out 4 of 6"); its fill turns amber in the warning tone.
  progress?: { value: number; max: number; ariaLabel: string; valueText: string }
  // A quieter second line (the note under a strip).
  detail?: ReactNode
}

const ICON = { ok: CheckCircleOutlineIcon, warning: WarningAmberIcon, neutral: InfoOutlinedIcon } as const

// docs/specs/101-match-results-our-side-scorecard.md: the strips beside the grids ("Total 148 = 135 + 13 ✓", "Out 4 of
// 6", "Bowled so far"). Conveniences, not rules: they never block, and the server's validation is authoritative. Wraps
// CardProgressBar for the meter variant.
export function ReconcileStrip({ tone, title, status, progress, detail }: ReconcileStripProps) {
  const Icon = ICON[tone]
  const warning = tone === 'warning'
  return (
    <Box
      role="status"
      sx={{
        border: 1,
        borderColor: warning ? 'warning.main' : 'divider',
        borderRadius: 2,
        bgcolor: (theme: Theme) => (warning ? alpha(theme.palette.warning.main, 0.1) : 'background.paper'),
        px: 1.5,
        py: 1,
        minWidth: 0,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Icon
          fontSize="small"
          aria-hidden
          sx={{ flex: 'none', color: tone === 'ok' ? 'success.main' : warning ? 'warning.dark' : 'text.secondary' }}
        />
        <Typography variant="body2" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', minWidth: 0, overflowWrap: 'anywhere' }}>
          {title}
        </Typography>
        {status && (
          <Typography
            variant="body2"
            sx={{ fontWeight: 600, color: tone === 'ok' ? 'success.dark' : warning ? 'warning.dark' : 'text.secondary', minWidth: 0 }}
          >
            {status}
          </Typography>
        )}
      </Box>
      {progress && (
        <Box sx={{ mt: 1 }}>
          <CardProgressBar {...progress} tone={warning ? 'warning' : 'primary'} />
        </Box>
      )}
      {detail && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
          {detail}
        </Typography>
      )}
    </Box>
  )
}
