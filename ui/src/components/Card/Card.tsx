import { Card as MuiCard, CardContent, CardHeader, CardActions } from '@mui/material'
import type { CardProps as MuiCardProps } from '@mui/material'
import type { ReactNode } from 'react'

export interface CardProps extends MuiCardProps {
  title?: string
  footer?: ReactNode
}

export function Card({ title, footer, children, ...props }: CardProps) {
  return (
    <MuiCard variant="outlined" {...props}>
      {title && <CardHeader title={title} titleTypographyProps={{ variant: 'subtitle1', component: 'h3' }} />}
      <CardContent>{children}</CardContent>
      {footer && <CardActions>{footer}</CardActions>}
    </MuiCard>
  )
}
