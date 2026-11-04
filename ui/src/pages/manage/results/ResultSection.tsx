import { useId, useState } from 'react'
import type { ReactNode } from 'react'
import { Box, Collapse, IconButton, Typography } from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'

// The bordered card every block of the result page sits in (docs/specs/100-match-results-core.md, Result page).
// `action` sits at the right of the title line. `collapsible` (docs/specs/138, owner 2026-11-05: the two innings cards) adds a chevron on the
// title line that hides the body; the card starts open unless `defaultOpen` is false.
export function ResultSection({
  title,
  children,
  testId,
  action,
  collapsible = false,
  defaultOpen = true,
}: {
  title: string
  children: ReactNode
  testId?: string
  action?: ReactNode
  collapsible?: boolean
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const bodyId = useId()
  return (
    <Box
      component="section"
      data-testid={testId}
      sx={{ bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 2, p: { xs: 1.5, md: 2 }, boxShadow: 0 }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5, mb: !collapsible || open ? 1.5 : 0, flexWrap: 'wrap' }}>
        <Typography variant="subtitle1" component="h2" fontWeight={700}>
          {title}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {action}
          {collapsible && (
            <IconButton
              size="small"
              onClick={() => setOpen((value) => !value)}
              aria-expanded={open}
              aria-controls={bodyId}
              aria-label={`${open ? 'Collapse' : 'Expand'} ${title}`}
              sx={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 150ms', minWidth: 44, minHeight: 44, my: -0.75 }}
            >
              <ExpandMoreIcon />
            </IconButton>
          )}
        </Box>
      </Box>
      {collapsible ? <Collapse in={open} id={bodyId}>{children}</Collapse> : children}
    </Box>
  )
}
