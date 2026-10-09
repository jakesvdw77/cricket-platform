import type { ReactNode } from 'react'
import { useState } from 'react'
import { Box, Link, ListItemIcon, Menu, MenuItem, Typography, useMediaQuery } from '@mui/material'
import CheckIcon from '@mui/icons-material/Check'
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

export interface SortMenuOption {
  value: string
  // The menu item, e.g. "Games this season, most first".
  label: string
  // The short wording on the link itself, e.g. "most games".
  linkLabel: string
}

export interface SortMenuProps {
  value: string
  options: SortMenuOption[]
  onChange: (value: string) => void
}

// docs/specs/088-players-polls-alignment.md: the quiet sort link for a list that sorts by more than one thing. Reads like
// SortLink ("A to Z ↕") but opens a small menu of every order, the current one ticked, instead of just reversing.
export function SortMenu({ value, options, onChange }: SortMenuProps) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const current = options.find((option) => option.value === value) ?? options[0]
  return (
    <>
      <Link
        component="button"
        type="button"
        underline="hover"
        aria-haspopup="menu"
        aria-expanded={Boolean(anchor)}
        title="Change the sort order"
        onClick={(event) => setAnchor(event.currentTarget)}
        sx={{ fontWeight: 700, fontSize: 'inherit', verticalAlign: 'baseline' }}
      >
        {current.linkLabel} <span aria-hidden>↕</span>
      </Link>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)} MenuListProps={{ 'aria-label': 'Sort order' }}>
        {options.map((option) => (
          <MenuItem
            key={option.value}
            selected={option.value === current.value}
            onClick={() => {
              setAnchor(null)
              onChange(option.value)
            }}
            sx={{ minHeight: 44 }}
          >
            <ListItemIcon sx={{ minWidth: 28 }}>{option.value === current.value ? <CheckIcon fontSize="small" /> : null}</ListItemIcon>
            {option.label}
          </MenuItem>
        ))}
      </Menu>
    </>
  )
}

