import { Button as MuiButton } from '@mui/material'
import type { ButtonProps as MuiButtonProps } from '@mui/material'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md'

export interface ButtonProps extends Omit<MuiButtonProps, 'variant' | 'color' | 'size'> {
  variant?: ButtonVariant
  size?: ButtonSize
}

const variantMap: Record<ButtonVariant, Pick<MuiButtonProps, 'variant' | 'color'>> = {
  primary: { variant: 'contained', color: 'primary' },
  secondary: { variant: 'outlined', color: 'primary' },
  ghost: { variant: 'text', color: 'inherit' },
  danger: { variant: 'contained', color: 'error' },
}

const sizeMap: Record<ButtonSize, MuiButtonProps['size']> = {
  sm: 'small',
  md: 'medium',
}

export function Button({ variant = 'primary', size = 'md', ...props }: ButtonProps) {
  const { variant: muiVariant, color } = variantMap[variant]
  return <MuiButton variant={muiVariant} color={color} size={sizeMap[size]} {...props} />
}
