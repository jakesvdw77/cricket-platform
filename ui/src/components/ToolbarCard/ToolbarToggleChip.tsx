import type { ReactNode } from 'react'
import { ButtonBase } from '@mui/material'
import CheckIcon from '@mui/icons-material/Check'
import { toolbarControlSx, toolbarSelectedBg } from './toolbarControlSx'

export interface ToolbarToggleChipProps {
  pressed: boolean
  onChange: (pressed: boolean) => void
  label: ReactNode
  // docs/specs/136: a chip that cannot be switched (e.g. the last of a set that cannot all be off): it keeps its state.
  disabled?: boolean
}

// docs/standards/page-anatomy.md section 3: an on/off choice in a toolbar card (Show inactive, Only our matches, View entire
// season) as a 36 px white outlined chip, `aria-pressed`; pressed it is tinted green with a check and a green edge.
export function ToolbarToggleChip({ pressed, onChange, label, disabled = false }: ToolbarToggleChipProps) {
  return (
    <ButtonBase
      type="button"
      aria-pressed={pressed}
      disabled={disabled}
      onClick={() => onChange(!pressed)}
      sx={[
        toolbarControlSx,
        (theme) => ({
          ...(pressed && { bgcolor: toolbarSelectedBg(theme), borderColor: 'primary.main', '&:hover': { bgcolor: toolbarSelectedBg(theme) } }),
          '&.Mui-disabled': { opacity: 0.6 },
          '&.Mui-focusVisible': { outline: 2, outlineStyle: 'solid', outlineColor: theme.palette.primary.main, outlineOffset: 1 },
        }),
      ]}
    >
      {pressed && <CheckIcon sx={{ fontSize: 16 }} aria-hidden />}
      {label}
    </ButtonBase>
  )
}
