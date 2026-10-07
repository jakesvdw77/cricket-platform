import type { ReactNode } from 'react'
import { Box, Link, Typography, useMediaQuery } from '@mui/material'
import { useTheme } from '@mui/material/styles'

export interface ContentControlsLineProps {
  // The "Showing ..." text on the left.
  scope: ReactNode
  // A quiet text link (SortLink) shown inside the scope text on desktop.
  sortAction?: ReactNode
  // The view's toggles, right-aligned on desktop. On a phone they live in the FilterBar sheet instead.
  controls?: ReactNode
  // Controls kept on every screen size (e.g. Jump to today).
  pinned?: ReactNode
}

// docs/specs/083-availability-filters-and-toolbars.md: the line directly above a view's content -
// scope text on the left, the view's own toggles on the right - so the toolbar card holds only the
// shared filters and search. Below sm only the scope text and pinned controls remain.
export function ContentControlsLine({ scope, sortAction, controls, pinned }: ContentControlsLineProps) {
  const theme = useTheme()
  const isPhone = useMediaQuery(theme.breakpoints.down('sm'), { noSsr: true })
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', columnGap: 1.5, rowGap: 0.5 }}>
      <Typography variant="body2" color="text.secondary" component="div">
        {scope}
        {!isPhone && sortAction && <> · {sortAction}</>}
      </Typography>
      {((!isPhone && controls) || pinned) && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 2, ml: 'auto' }}>
          {!isPhone && controls}
          {pinned}
        </Box>
      )}
    </Box>
  )
}

export interface SortLinkProps {
  // The current order in words, e.g. "soonest first".
  label: string
  onToggle: () => void
}

// A quiet text link that reverses the sort ("soonest first ↕"), replacing the old round icon button.
export function SortLink({ label, onToggle }: SortLinkProps) {
  return (
    <Link component="button" type="button" underline="hover" onClick={onToggle} title="Click to reverse" sx={{ fontWeight: 700, fontSize: 'inherit', verticalAlign: 'baseline' }}>
      {label} <span aria-hidden>↕</span>
    </Link>
  )
}
