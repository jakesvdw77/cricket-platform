import { Stack, Typography } from '@mui/material'
import { Button } from '../Button'

export interface PageNavProps {
  // Zero-based current page, as the backend's `number`.
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}

// Previous / "Page N of M" / Next under a paged list. Renders nothing for a single page.
export function PageNav({ page, totalPages, onPageChange }: PageNavProps) {
  if (totalPages <= 1) return null
  return (
    <Stack direction="row" spacing={2} justifyContent="center" alignItems="center">
      <Button variant="secondary" size="sm" disabled={page === 0} onClick={() => onPageChange(page - 1)}>
        Previous
      </Button>
      <Typography variant="body2" color="text.secondary">
        Page {page + 1} of {totalPages}
      </Typography>
      <Button variant="secondary" size="sm" disabled={page + 1 >= totalPages} onClick={() => onPageChange(page + 1)}>
        Next
      </Button>
    </Stack>
  )
}
