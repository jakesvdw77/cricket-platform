import type { ReactNode } from 'react'
import { Box } from '@mui/material'
import type { SxProps, Theme } from '@mui/material/styles'

export interface ContentCardProps {
  children: ReactNode
  sx?: SxProps<Theme>
}

// The shared body-content surface for RecordDetailScreen's per-section content and
// RecordFormScreen's field grid + actions bar — docs/specs/046-header-body-elevation-standard.md.
// Reuses RecordCard.tsx's own existing bgcolor: 'background.paper' / boxShadow: 2 card convention
// directly rather than inventing a new shadow recipe, so populated content reads as a surface
// floating above the page wash, matching what ListToolbar/RecordCard already do on list screens.
export function ContentCard({ children, sx }: ContentCardProps) {
  return (
    <Box sx={{ bgcolor: 'background.paper', boxShadow: 2, borderRadius: 1, p: 3, ...sx }}>
      {children}
    </Box>
  )
}
