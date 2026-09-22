import type { ReactNode } from 'react'
import { Box } from '@mui/material'
import { headerBandShadow } from '../../theme'

export interface PageHeaderBandProps {
  children: ReactNode
}

// The shared header treatment for RecordDetailScreen/RecordFormScreen/ManageScreenHeader —
// docs/specs/046-header-body-elevation-standard.md: a flat white band, a bottom divider border, a
// soft downward separation shadow, and a 3px primary.main accent bar along its own top edge, bled
// full-width to the top of whichever shell's <main> renders it. No other props — the band's
// bleed/colour/border/shadow/accent values are fixed by definition, not per-caller variance.
export function PageHeaderBand({ children }: PageHeaderBandProps) {
  return (
    <Box
      sx={{
        mx: { xs: -2, md: -3 },
        mt: { xs: -2, md: -3 },
        mb: 0,
        px: { xs: 2, md: 3 },
        pt: { xs: 2, md: 3 },
        pb: 3,
        bgcolor: 'background.paper',
        borderBottom: 1,
        borderColor: 'divider',
        boxShadow: (theme) => headerBandShadow(theme),
        borderTop: (theme) => `3px solid ${theme.palette.primary.main}`,
        borderBottomLeftRadius: (theme) => theme.shape.borderRadius * 2,
        borderBottomRightRadius: (theme) => theme.shape.borderRadius * 2,
      }}
    >
      {children}
    </Box>
  )
}
