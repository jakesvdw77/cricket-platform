import { useState } from 'react'
import type { MouseEvent, ReactNode } from 'react'
import { ListSubheader, Menu, MenuItem } from '@mui/material'
import type { AvailabilityStatus } from '../../../../api/matchAvailabilityApi'
import { STATUS_LABEL } from '../../../../utils/availabilityStatus'
import { STATUS_ORDER } from './responseHelpers'

export interface StatusOverrideTriggerProps {
  onClick: (event: MouseEvent<HTMLElement>) => void
  // aria-disabled, not `disabled`, so the trigger keeps keyboard focus while an override is saving.
  'aria-disabled': boolean
  'aria-label': string
  'aria-haspopup': 'menu'
  'aria-expanded': boolean
}

// docs/specs/065: the admin-override entry point, extracted from the old group card's
// BracketStatusChip. Wraps whatever the caller renders as the trigger (a player row or a status
// chip) with the status Menu: Available / Unsure / Unavailable, the current answer selected.
// Disabled only while that one answer is being saved (managers can also correct a closed poll).
export function StatusOverrideMenu({
  playerName,
  slotLabel,
  status,
  disabled,
  onSelect,
  title,
  extraItem,
  triggerLabel,
  children,
}: {
  playerName: string
  slotLabel: string
  status: AvailabilityStatus | null
  disabled: boolean
  onSelect: (status: AvailabilityStatus) => void
  // docs/specs/085 (F): an optional non-interactive heading (e.g. the player and game), an optional last entry after the
  // three answers (e.g. "Open poll"), and the trigger's accessible name when the caller's own label should stand.
  title?: string
  extraItem?: { label: string; onSelect: () => void }
  triggerLabel?: string
  children: (trigger: StatusOverrideTriggerProps) => ReactNode
}) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)

  return (
    <>
      {children({
        onClick: (event) => {
          if (!disabled) setAnchorEl(event.currentTarget)
        },
        'aria-disabled': disabled,
        'aria-label': triggerLabel ?? `Set ${playerName}'s ${slotLabel.toLowerCase()} availability`,
        'aria-haspopup': 'menu',
        'aria-expanded': Boolean(anchorEl),
      })}
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        {title && (
          <ListSubheader component="div" sx={{ lineHeight: 1.5, py: 0.75, bgcolor: 'background.paper' }}>
            {title}
          </ListSubheader>
        )}
        {STATUS_ORDER.map((option) => (
          <MenuItem
            key={option}
            selected={option === status}
            onClick={() => {
              setAnchorEl(null)
              onSelect(option)
            }}
          >
            {STATUS_LABEL[option]}
          </MenuItem>
        ))}
        {extraItem && (
          <MenuItem
            divider={false}
            sx={{ borderTop: 1, borderColor: 'divider', mt: 0.5 }}
            onClick={() => {
              setAnchorEl(null)
              extraItem.onSelect()
            }}
          >
            {extraItem.label}
          </MenuItem>
        )}
      </Menu>
    </>
  )
}
