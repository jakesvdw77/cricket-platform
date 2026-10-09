import type { ReactNode } from 'react'
import { Box, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'

export interface KeyFigureTileProps {
  // A 20 px MUI outlined icon, drawn on the tinted tile.
  icon: ReactNode
  value: ReactNode
  label: ReactNode
  // 'warning' tints the icon tile amber (a time that is close); anything else is the primary tint.
  tone?: 'neutral' | 'warning'
  // A long text value (a league name) at a smaller size than a number.
  textValue?: boolean
  testId?: string
}

// docs/specs/088 (Player page) and docs/specs/089 (match page): one non-clickable tile of a key-figure strip - a tinted
// icon tile, a large value and a caption. The strip itself (a 4-up / 2-up grid) belongs to the page.
export function KeyFigureTile({ icon, value, label, tone = 'neutral', textValue = false, testId }: KeyFigureTileProps) {
  const warn = tone === 'warning'
  return (
    <Box
      data-testid={testId}
      data-tone={warn ? 'warning' : 'neutral'}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: { xs: 1.25, md: 1.75 },
        minWidth: 0,
        bgcolor: 'background.paper',
        borderRadius: 1,
        boxShadow: 1,
        px: { xs: 1.5, md: 2 },
        py: { xs: 1.25, md: 1.75 },
      }}
    >
      <Box
        aria-hidden
        sx={(theme) => ({
          width: { xs: 36, md: 44 },
          height: { xs: 36, md: 44 },
          flex: 'none',
          borderRadius: { xs: 1, md: 1.25 },
          bgcolor: alpha(warn ? theme.palette.warning.main : theme.palette.primary.main, warn ? 0.18 : 0.12),
          color: warn ? 'warning.dark' : 'primary.dark',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        })}
      >
        {icon}
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Typography
          component="b"
          data-testid={testId ? `${testId}-value` : undefined}
          sx={{
            fontSize: textValue ? { xs: '0.95rem', md: '1.05rem' } : { xs: '1.3rem', md: '1.6rem' },
            lineHeight: 1.15,
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
            overflowWrap: 'anywhere',
          }}
        >
          {value}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.75rem', md: '0.8125rem' } }}>
          {label}
        </Typography>
      </Box>
    </Box>
  )
}
