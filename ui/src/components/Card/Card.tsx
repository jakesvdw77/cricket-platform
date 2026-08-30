import { Card as MuiCard, CardContent, CardHeader, CardActions } from '@mui/material'
import type { CardProps as MuiCardProps, SxProps, Theme } from '@mui/material'
import type { ReactNode } from 'react'

export interface CardProps extends MuiCardProps {
  title?: string
  footer?: ReactNode
  // Optional sx passed through to the inner CardContent rather than the outer MuiCard root —
  // needed by any caller that wants its content to flex-fill the card (e.g. height: '100%' +
  // display: 'flex' on the root alone doesn't help unless CardContent itself grows to fill it).
  // Every existing call site omits this and is unaffected.
  contentSx?: SxProps<Theme>
}

export function Card({ title, footer, children, contentSx, ...props }: CardProps) {
  return (
    <MuiCard variant="outlined" {...props}>
      {title && <CardHeader title={title} titleTypographyProps={{ variant: 'subtitle1', component: 'h3' }} />}
      <CardContent sx={contentSx}>{children}</CardContent>
      {footer && <CardActions>{footer}</CardActions>}
    </MuiCard>
  )
}
