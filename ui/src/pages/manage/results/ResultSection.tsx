import type { ReactNode } from 'react'
import { Box, Typography } from '@mui/material'

// The bordered card every block of the result page sits in (docs/specs/100-match-results-core.md, Result page).
export function ResultSection({ title, children, testId }: { title: string; children: ReactNode; testId?: string }) {
  return (
    <Box
      component="section"
      data-testid={testId}
      sx={{ bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 2, p: { xs: 1.5, md: 2 }, boxShadow: 1 }}
    >
      <Typography variant="subtitle1" component="h2" fontWeight={700} sx={{ mb: 1.5 }}>
        {title}
      </Typography>
      {children}
    </Box>
  )
}
