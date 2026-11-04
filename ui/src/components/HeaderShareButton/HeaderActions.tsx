import type { ReactNode } from 'react'
import { Box } from '@mui/material'

export interface HeaderActionsProps {
  // The optional button beside the menu (Share, or Announce Team): left of it on a tablet or desktop, above it on a phone.
  beside?: ReactNode
  // The page's filled Manage menu.
  children: ReactNode
}

// docs/standards/page-anatomy.md (owner, 2026-11-05): the header's action area. ONE place owns how a Share (or Announce Team) button sits
// with the Manage menu, so the five pages that have one cannot drift: a row from sm up, stacked full width on a phone.
export function HeaderActions({ beside, children }: HeaderActionsProps) {
  return (
    <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'stretch', sm: 'center' }, gap: 1, width: { xs: '100%', sm: 'auto' } }}>
      {beside}
      {children}
    </Box>
  )
}
