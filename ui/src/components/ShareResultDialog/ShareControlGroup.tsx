import type { ReactNode } from 'react'
import { Box, Typography } from '@mui/material'

// A labelled group of controls in a format's control strip ("Message style", "Include"). Internal to ShareResultDialog.
export function ShareControlGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box component="section" aria-label={label} sx={{ mb: 2 }}>
      <Typography variant="overline" component="h4" color="text.secondary" sx={{ display: 'block', lineHeight: 1.6, mb: 0.5 }}>
        {label}
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0.5 }}>{children}</Box>
    </Box>
  )
}
