import type { ReactNode } from 'react'
import { Box, Button as MuiButton, Typography } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { Link as RouterLink } from 'react-router-dom'
import { PageHeaderBand } from '../PageHeaderBand'
import { ContentCard } from '../ContentCard'

export interface RecordFormScreenProps {
  title: string
  backTo: string
  backLabel: string
  // Omitted, no footer is rendered at all (no divider, no padding): the edit pages whose tabs carry their own actions.
  actions?: ReactNode
  // docs/specs/095-league-edit-gold-standard.md: an optional tab strip on the page wash, between the header band and the card.
  tabs?: ReactNode
  // docs/specs/075-match-view-and-edit.md: optional control right-aligned on the title row (e.g. the
  // Match edit page's Availability button). Omitted, the markup is unchanged.
  headerAction?: ReactNode
  children: ReactNode
}

// The shape every create/edit screen uses (ProductFormPage today, future Subscriptions/
// Discounts/Invoicing/System Settings forms — docs/specs/008-product-catalog.md's UI
// Requirements): a "Back to <List>" action above the title, a responsive field grid (single
// column at xs, two columns from md — consuming forms wrap single-value fields one-per-cell
// and full-width fields, e.g. description, in a Box with gridColumn: '1 / -1'), then an
// actions bar below a divider for Save/Cancel/Retire-style buttons.
export function RecordFormScreen({ title, backTo, backLabel, actions, tabs, headerAction, children }: RecordFormScreenProps) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <PageHeaderBand>
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
        {headerAction ? (
          <Box
            data-testid="record-form-title-row"
            sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 1.5 }}
          >
            <Typography variant="h5" component="h1" sx={{ fontWeight: 700, minWidth: 0 }}>
              {title}
            </Typography>
            <Box sx={{ flex: 'none' }}>{headerAction}</Box>
          </Box>
        ) : (
          <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
            {title}
          </Typography>
        )}
      </PageHeaderBand>

      {tabs ? <Box sx={{ minWidth: 0 }}>{tabs}</Box> : null}

      <ContentCard>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
            gap: 3,
          }}
        >
          {children}
        </Box>

        {actions ? (
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
        ) : null}
      </ContentCard>
    </Box>
  )
}
