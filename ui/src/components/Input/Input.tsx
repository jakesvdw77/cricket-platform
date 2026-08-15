import { TextField } from '@mui/material'
import type { TextFieldProps } from '@mui/material'

export interface InputProps extends Omit<TextFieldProps, 'variant'> {
  label: string
}

// TextField already wires label/error/helperText/aria-invalid/aria-describedby
// correctly out of the box — see docs/standards/frontend.md's accessibility rule.
export function Input({ fullWidth = true, size = 'small', ...props }: InputProps) {
  return <TextField variant="outlined" fullWidth={fullWidth} size={size} {...props} />
}
