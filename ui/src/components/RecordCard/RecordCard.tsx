import type { ReactNode } from 'react'
import { Avatar, Card as MuiCard, CardActions, CardContent, Chip, Stack, Typography, Button as MuiButton } from '@mui/material'
import { alpha } from '@mui/material/styles'
import { Link as RouterLink } from 'react-router-dom'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import { Button } from '../Button'

export type RecordCardBadgeTone = 'positive' | 'neutral' | 'muted'

export interface RecordCardBadge {
  label: string
  tone: RecordCardBadgeTone
}

export interface RecordCardField {
  label: string
  value: ReactNode
}

// The leading visual in a card's header — a photo/logo when the record has one, MUI Avatar's own
// built-in fallback (its `children`) otherwise. `shape` follows the record's own nature: 'circular'
// for a person (a Contact, a Player), 'rounded' for an organisation/named-thing a logo actually
// belongs to (a Team, a Sponsor, a Club). Real user feedback: every card in /manage read as a bland
// white rectangle, indistinguishable from its neighbours at a glance — this is the fix.
export interface RecordCardAvatar {
  imageUrl?: string | null
  // Rendered when there's no imageUrl (or it fails to load — MUI's Avatar already falls back to
  // children on a broken/missing src, no extra logic needed here). Typically `initialsFromName(name)`
  // for a record with no fixed icon, or a plain MUI icon element for one that never has a photo at
  // all (e.g. a Product, a Subscription).
  fallback: ReactNode
  shape?: 'circular' | 'rounded'
}

// Generic second footer action, e.g. a per-card async action like "Resend welcome email"
// (docs/specs/019-resend-subscription-welcome-email.md) — not Subscription-specific, so any
// future card needing a second footer action with inline pending/outcome feedback reuses this
// rather than a bespoke variant.
export interface RecordCardSecondaryAction {
  label: string
  pendingLabel: string
  onClick: () => void
  pending: boolean
  // Optional — every current call site passes one (a real user-facing ask: footer actions should
  // draw the eye, not just read as text), but this stays optional so a future secondary action
  // with no obvious icon isn't forced to invent one.
  icon?: ReactNode
}

// Generic inline outcome message for a card-level action (e.g. secondaryAction's result) — the
// same "coloured Typography for the outcome" pattern already used in EmailSettings.tsx, not a
// new Alert/Snackbar component.
export interface RecordCardFeedback {
  message: string
  tone: 'success' | 'error'
}

export interface RecordCardProps {
  title: string
  avatar?: RecordCardAvatar
  badge?: RecordCardBadge
  description?: string | null
  fields?: RecordCardField[]
  chips?: string[]
  editLabel: string
  onEdit?: () => void
  editTo?: string
  secondaryAction?: RecordCardSecondaryAction
  feedback?: RecordCardFeedback | null
}

// The grid unit for any record list (ProductList today, future Subscriptions/Discounts/
// Invoicing/System Settings screens — docs/specs/008-product-catalog.md's UI Requirements).
// Fixed slot order regardless of which screen uses it: avatar + title + status badge, a
// 2-line-clamped description, a row of key fields, an optional row of attribute chips, then an
// Edit footer. A light primary-tinted background (not plain white, not a solid fill — see
// docs/standards/design-system.md) keeps the card visible against the page without competing with
// badge/chip colour, and re-tints automatically per club since it's derived from
// theme.palette.primary rather than a hard-coded colour. Built directly from MUI Card/CardContent/
// CardActions rather than the shared Card component — this slot structure is more specific than
// Card's generic title/children/footer shape.
export function RecordCard({
  title,
  avatar,
  badge,
  description,
  fields,
  chips,
  editLabel,
  onEdit,
  editTo,
  secondaryAction,
  feedback,
}: RecordCardProps) {
  return (
    <MuiCard variant="outlined" sx={{ bgcolor: (theme) => alpha(theme.palette.primary.main, 0.05) }}>
      <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ minWidth: 0 }}>
            {avatar && (
              <Avatar
                src={avatar.imageUrl ?? undefined}
                variant={avatar.shape === 'rounded' ? 'rounded' : 'circular'}
                sx={{
                  width: 40,
                  height: 40,
                  flex: 'none',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  bgcolor: (theme) => alpha(theme.palette.primary.main, 0.14),
                  color: 'primary.dark',
                }}
              >
                {avatar.fallback}
              </Avatar>
            )}
            <Typography variant="subtitle1" component="h3" fontWeight={600} noWrap>
              {title}
            </Typography>
          </Stack>
          {badge && (
            <Chip
              size="small"
              label={badge.label}
              variant={badge.tone === 'neutral' ? 'outlined' : 'filled'}
              sx={
                badge.tone === 'positive'
                  ? {
                      bgcolor: (theme) => alpha(theme.palette.primary.main, 0.12),
                      color: 'primary.dark',
                      fontWeight: 600,
                    }
                  : badge.tone === 'muted'
                    ? {
                        // Visually distinct from both 'positive' (solid primary-tinted) and
                        // 'neutral' (bordered, full-opacity) — a faded grey fill with reduced
                        // overall opacity, reading as "inactive/archived" at a glance (e.g.
                        // RETIRED vs DRAFT's 'neutral' outline).
                        bgcolor: (theme) => alpha(theme.palette.text.secondary, 0.12),
                        color: 'text.secondary',
                        opacity: 0.7,
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

        {feedback && (
          <Typography variant="body2" color={feedback.tone === 'success' ? 'success.main' : 'error.main'}>
            {feedback.message}
          </Typography>
        )}
      </CardContent>

      <CardActions sx={{ justifyContent: 'flex-end', px: 2, pb: 2, pt: 0 }}>
        {secondaryAction && (
          <Button
            variant="ghost"
            size="sm"
            disabled={secondaryAction.pending}
            onClick={secondaryAction.onClick}
            startIcon={secondaryAction.icon}
          >
            {secondaryAction.pending ? secondaryAction.pendingLabel : secondaryAction.label}
          </Button>
        )}
        {editTo ? (
          <MuiButton
            component={RouterLink}
            to={editTo}
            variant="text"
            color="inherit"
            size="small"
            startIcon={<EditOutlinedIcon fontSize="small" />}
          >
            {editLabel}
          </MuiButton>
        ) : (
          <Button variant="ghost" size="sm" onClick={onEdit} startIcon={<EditOutlinedIcon fontSize="small" />}>
            {editLabel}
          </Button>
        )}
      </CardActions>
    </MuiCard>
  )
}
