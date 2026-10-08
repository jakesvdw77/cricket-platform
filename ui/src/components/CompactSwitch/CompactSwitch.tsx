import { FormControlLabel, Switch, Typography } from '@mui/material'
import type { ReactNode } from 'react'

export interface CompactSwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label: ReactNode
  disabled?: boolean
  // Keep the label on one line (the default: toggles sit in a wrapping row of controls).
  noWrap?: boolean
}

// docs/specs/085: the one small toggle of the Availability pages - a small Switch with a caption-size label.
// On a phone the label row is 44 px high (padding on the row, not a bigger switch) so the touch target is large enough.
export function CompactSwitch({ checked, onChange, label, disabled = false, noWrap = true }: CompactSwitchProps) {
  return (
    <FormControlLabel
      control={<Switch size="small" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />}
      label={
        <Typography component="span" sx={{ fontSize: '0.8rem', lineHeight: 1.3 }}>
          {label}
        </Typography>
      }
      sx={{ mr: 0, ml: 0, whiteSpace: noWrap ? 'nowrap' : 'normal', minHeight: { xs: 44, sm: 28 }, alignItems: 'center' }}
    />
  )
}
