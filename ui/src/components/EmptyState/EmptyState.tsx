import { Box, Typography } from '@mui/material'
import type { ReactNode } from 'react'

export interface EmptyStateProps {
  title: string
  description?: string
  action?: ReactNode
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
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
        bgcolor: 'action.hover',
        p: 4,
        textAlign: 'center',
      }}
    >
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
