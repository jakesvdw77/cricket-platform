import { useState } from 'react'
import type { MouseEvent, ReactNode } from 'react'
import { Menu, MenuItem } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import type { PollDestination } from './matchCardHelpers'

export interface AvailabilityNavigation {
  openAvailability: (event: MouseEvent<HTMLElement>) => void
  menu: ReactNode
}

// docs/specs/075-match-view-and-edit.md section 3: the one place the Availability button's
// destination rule is acted on. A `link` destination navigates on click; a `menu` destination opens
// an MUI Menu anchored to the clicked button with one item per poll (each navigates and closes).
// The card, the Match View page and the Edit page header each render `menu` once and call
// `openAvailability` from their own button.
export function useAvailabilityNavigation(destination: PollDestination): AvailabilityNavigation {
  const navigate = useNavigate()
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)

  const openAvailability = (event: MouseEvent<HTMLElement>) => {
    if (destination.kind === 'link') {
      navigate(destination.to)
      return
    }
    setAnchorEl(event.currentTarget)
  }

  // Leaving the menu destination drops the anchor (adjust state during render, per React docs).
  const [prevKind, setPrevKind] = useState(destination.kind)
  if (prevKind !== destination.kind) {
    setPrevKind(destination.kind)
    setAnchorEl(null)
  }

  // Open is derived from the destination being a menu, so a stale anchor can never auto-open it later.
  const menu =
    destination.kind === 'menu' ? (
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        MenuListProps={{ 'aria-label': 'Availability polls' }}
      >
        {destination.options.map((option) => (
          <MenuItem
            key={option.to}
            onClick={() => {
              setAnchorEl(null)
              navigate(option.to)
            }}
          >
            {option.label}
          </MenuItem>
        ))}
      </Menu>
    ) : null

  return { openAvailability, menu }
}
