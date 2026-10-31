import type { ReactNode } from 'react'
import { Box } from '@mui/material'

export interface ToolbarCardProps {
  // The toolbar (normally a FilterBar with `bare` and `inCard`).
  children: ReactNode
  // true: the toolbar is the top row of a table's card. The table owns the outer border and radius, so this renders only the
  // row and a hairline under it. false (default): the toolbar is a flat white card of its own above other content.
  fused?: boolean
  testId?: string
}

// docs/standards/page-anatomy.md section 3: the filter bar is the table's own toolbar. A flat white surface (hairline border,
// the table card's radius, no shadow) that hosts the filter row, either fused into a table's card (a hairline below it, then
// the column header) or standing alone above a card grid, panels or an empty state.
export function ToolbarCard({ children, fused = false, testId }: ToolbarCardProps) {
  return (
    <Box
      data-testid={testId ?? (fused ? 'toolbar-card-fused' : 'toolbar-card')}
      data-composition={fused ? 'fused' : 'standalone'}
      sx={{
        bgcolor: 'background.paper',
        boxShadow: 0,
        p: 1,
        ...(fused ? { borderBottom: 1, borderColor: 'divider' } : { border: 1, borderColor: 'divider', borderRadius: 1 }),
      }}
    >
      {children}
    </Box>
  )
}
