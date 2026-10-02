import { useState } from 'react'
import type { MouseEvent, ReactNode } from 'react'
import { Menu, MenuItem } from '@mui/material'
import type { AvailabilityStatus } from '../../../../api/matchAvailabilityApi'
import { STATUS_LABEL } from '../../../../utils/availabilityStatus'
import { STATUS_ORDER } from './responseHelpers'

export interface StatusOverrideTriggerProps {
  onClick: (event: MouseEvent<HTMLElement>) => void
  // aria-disabled, not `disabled`, so the trigger keeps keyboard focus while pending/closed.
  'aria-disabled': boolean
  'aria-label': string
}

// docs/specs/065: the admin-override entry point, extracted from GroupPollCard's old
// BracketStatusChip. Wraps whatever the caller renders as the trigger (a player row or a status
// chip) with the status Menu: Available / Unsure / Unavailable, the current answer selected.
// Disabled while the poll is closed, matching the backend's closed-round rule.
export function StatusOverrideMenu({
  playerName,
  slotLabel,
  status,
  disabled,
  onSelect,
  children,
}: {
  playerName: string
  slotLabel: string
  status: AvailabilityStatus | null
  disabled: boolean
  onSelect: (status: AvailabilityStatus) => void
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
        'aria-label': `Set ${playerName}'s ${slotLabel.toLowerCase()} availability`,
      })}
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
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
      </Menu>
    </>
  )
}
