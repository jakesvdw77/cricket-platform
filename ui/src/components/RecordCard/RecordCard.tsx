import type { ReactNode } from 'react'
import { Card as MuiCard, CardActions, CardContent, Chip, Stack, Typography, Button as MuiButton } from '@mui/material'
import { alpha } from '@mui/material/styles'
import { Link as RouterLink } from 'react-router-dom'
import { Button } from '../Button'

export type RecordCardBadgeTone = 'positive' | 'neutral'

export interface RecordCardBadge {
  label: string
  tone: RecordCardBadgeTone
}

export interface RecordCardField {
  label: string
  value: ReactNode
}

export interface RecordCardProps {
  title: string
  badge?: RecordCardBadge
  description?: string | null
  fields?: RecordCardField[]
  chips?: string[]
  editLabel: string
  onEdit?: () => void
  editTo?: string
}

// The grid unit for any record list (ProductList today, future Subscriptions/Discounts/
// Invoicing/System Settings screens — docs/specs/008-product-catalog.md's UI Requirements).
// Fixed slot order regardless of which screen uses it: title + status badge, a 2-line-clamped
// description, a row of key fields, an optional row of attribute chips, then an Edit footer.
// Built directly from MUI Card/CardContent/CardActions rather than the shared Card component —
// this slot structure is more specific than Card's generic title/children/footer shape.
export function RecordCard({ title, badge, description, fields, chips, editLabel, onEdit, editTo }: RecordCardProps) {
  return (
    <MuiCard variant="outlined">
      <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
          <Typography variant="subtitle1" component="h3" fontWeight={600}>
            {title}
          </Typography>
          {badge && (
            <Chip
              size="small"
              label={badge.label}
              variant={badge.tone === 'positive' ? 'filled' : 'outlined'}
              sx={
                badge.tone === 'positive'
                  ? {
                      bgcolor: (theme) => alpha(theme.palette.primary.main, 0.12),
                      color: 'primary.dark',
                      fontWeight: 600,
                    }
                  : undefined
              }
            />
          )}
        </Stack>

        {description && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {description}
          </Typography>
        )}

        {fields && fields.length > 0 && (
          <Stack direction="row" spacing={3} flexWrap="wrap" useFlexGap>
            {fields.map((field) => (
              <Stack key={field.label} spacing={0.25}>
                <Typography variant="caption" color="text.secondary">
                  {field.label}
                </Typography>
                <Typography variant="body2" fontWeight={600}>
                  {field.value}
                </Typography>
              </Stack>
            ))}
          </Stack>
        )}

        {chips && chips.length > 0 && (
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {chips.map((chip) => (
              <Chip key={chip} size="small" variant="outlined" label={chip} />
            ))}
          </Stack>
        )}
      </CardContent>

      <CardActions sx={{ justifyContent: 'flex-end', px: 2, pb: 2, pt: 0 }}>
        {editTo ? (
          <MuiButton component={RouterLink} to={editTo} variant="text" color="inherit" size="small">
            {editLabel}
          </MuiButton>
        ) : (
          <Button variant="ghost" size="sm" onClick={onEdit}>
            {editLabel}
          </Button>
        )}
      </CardActions>
    </MuiCard>
  )
}
