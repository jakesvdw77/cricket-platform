import type { ReactNode } from 'react'
import { Box, Button as MuiButton, Typography } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { Link as RouterLink } from 'react-router-dom'

export interface RecordFormScreenProps {
  title: string
  backTo: string
  backLabel: string
  actions: ReactNode
  children: ReactNode
}

// The shape every create/edit screen uses (ProductFormPage today, future Subscriptions/
// Discounts/Invoicing/System Settings forms — docs/specs/008-product-catalog.md's UI
// Requirements): a "Back to <List>" action above the title, a responsive field grid (single
// column at xs, two columns from md — consuming forms wrap single-value fields one-per-cell
// and full-width fields, e.g. description, in a Box with gridColumn: '1 / -1'), then an
// actions bar below a divider for Save/Cancel/Retire-style buttons.
export function RecordFormScreen({ title, backTo, backLabel, actions, children }: RecordFormScreenProps) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box>
        <MuiButton
          component={RouterLink}
          to={backTo}
          variant="text"
          color="inherit"
          size="small"
          startIcon={<ArrowBackIcon fontSize="small" />}
          sx={{ mb: 1, ml: -1, color: 'text.secondary' }}
        >
          {backLabel}
        </MuiButton>
        <Typography variant="h6" component="h1">
          {title}
        </Typography>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
          gap: 3,
        }}
      >
        {children}
      </Box>

      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'flex-end',
          gap: 2,
          pt: 3,
          borderTop: 1,
          borderColor: 'divider',
        }}
      >
        {actions}
      </Box>
    </Box>
  )
}
