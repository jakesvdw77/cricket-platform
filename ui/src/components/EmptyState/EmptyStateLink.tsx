import { Link } from '@mui/material'
import type { ReactNode } from 'react'

export interface EmptyStateLinkProps {
  children: ReactNode
  onClick: () => void
}

// page-anatomy section 5 (2026-11-04, owner): the one action of an empty state ("Create New Season", "Create New Poll") is an underlined text link, not a
// button. It is a native button element (Tab, Enter and Space work) drawn as a link. Pass it as EmptyState's `action`.
export function EmptyStateLink({ children, onClick }: EmptyStateLinkProps) {
  return (
    <Link component="button" type="button" variant="body2" underline="always" onClick={onClick} sx={{ fontWeight: 600, minHeight: 32 }}>
      {children}
    </Link>
  )
}
