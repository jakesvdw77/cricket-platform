import { Box, Typography } from '@mui/material'
import type { ReactNode } from 'react'

export interface EmptyStateProps {
  // Optional leading graphic (e.g. a BrandIcon) above the title.
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 1,
        border: 1,
        borderColor: 'divider',
        borderRadius: 2,
        // Opaque (owner, 2026-11-05): the translucent action.hover looked darker over the cream page than inside a white table card.
        bgcolor: 'grey.100',
        p: 4,
        textAlign: 'center',
      }}
    >
      {icon && <Box sx={{ display: 'flex' }}>{icon}</Box>}
      <Typography variant="body2" fontWeight={600}>
        {title}
      </Typography>
      {description && (
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
      )}
      {action && <Box sx={{ mt: 1 }}>{action}</Box>}
    </Box>
  )
}
