import { ToggleButton, ToggleButtonGroup } from '@mui/material'
import type { ReactNode } from 'react'
import { toolbarSegmentedSx } from './toolbarControlSx'

export interface ToolbarMultiToggleOption {
  value: string
  label: string
  icon: ReactNode
}

export interface ToolbarMultiToggleProps {
  ariaLabel: string
  options: ToolbarMultiToggleOption[]
  // The options that are on. The last one left on cannot be switched off (it is disabled), so a list is never filtered to nothing.
  selected: string[]
  onChange: (selected: string[]) => void
}

// page-anatomy section 3: the same segmented look as the Cards | List toggle (small icon plus label), but each part is its own on/off
// choice (Group Polls and Squad Polls can both be on). Used where the old toggle chips stood for a set of kinds.
export function ToolbarMultiToggle({ ariaLabel, options, selected, onChange }: ToolbarMultiToggleProps) {
  return (
    <ToggleButtonGroup
      size="small"
      aria-label={ariaLabel}
      value={selected}
      onChange={(_event, next: string[]) => {
        if (next.length > 0) onChange(next)
      }}
      sx={toolbarSegmentedSx}
    >
      {options.map((option) => (
        <ToggleButton key={option.value} value={option.value} aria-label={option.label} disabled={selected.length === 1 && selected[0] === option.value}>
          {option.icon}
          {option.label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  )
}
