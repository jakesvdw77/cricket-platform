import { Button as MuiButton } from '@mui/material'
import type { ButtonProps as MuiButtonProps } from '@mui/material'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
// 'compact' is the in-card action button (docs/standards/design-system.md, Button sizing): about 32 px high, 6px/12px padding, 13px
// text in sentence case, a smaller icon. Below md a transparent area extends the touch target to 44 px without enlarging the look.
export type ButtonSize = 'sm' | 'md' | 'compact'

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
  compact: 'small',
}

export const compactButtonSx = {
  minHeight: 32,
  minWidth: 0,
  px: '12px',
  py: '6px',
  fontSize: '0.8125rem',
  lineHeight: 1.2,
  textTransform: 'none',
  fontWeight: 600,
  position: 'relative',
  '& .MuiButton-startIcon': { mr: 0.5, ml: 0, '& > *:nth-of-type(1)': { fontSize: 16 } },
  '& .MuiButton-endIcon': { ml: 0.5, mr: 0, '& > *:nth-of-type(1)': { fontSize: 16 } },
  '&::after': { content: '""', position: 'absolute', left: 0, right: 0, top: -6, bottom: -6, display: { xs: 'block', md: 'none' } },
} as const

export function Button({ variant = 'primary', size = 'md', ...props }: ButtonProps) {
  const { variant: muiVariant, color } = variantMap[variant]
  const { sx, ...rest } = props
  return <MuiButton variant={muiVariant} color={color} size={sizeMap[size]} sx={size === 'compact' ? ([compactButtonSx, ...(Array.isArray(sx) ? sx : [sx])] as MuiButtonProps['sx']) : sx} {...rest} />
}
