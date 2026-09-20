import type { ReactNode } from 'react'
import { Avatar, Card as MuiCard, CardActions, CardContent, Chip, Stack, Typography, Button as MuiButton } from '@mui/material'
import { alpha } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import { Link as RouterLink } from 'react-router-dom'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
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
  // docs/specs/040-announce-team.md: up to a few more badges coexisting with the single `badge`
  // slot above (e.g. one per real-Team side's own announced/not-announced state) — rendered in
  // the same top-right Stack, immediately after `badge` when both are present. `badge` itself is
  // unchanged, byte-for-byte, for every existing call site that only ever passes it.
  badges?: RecordCardBadge[]
  description?: string | null
  fields?: RecordCardField[]
  chips?: string[]
  // Optional — required historically, but a viewTo-only call site (docs/specs/
  // 036-view-first-record-detail-screens.md) has no use for it, since the footer's primary action
  // becomes "View" instead. Defaults to 'Edit' for every existing call site's own convenience.
  editLabel?: string
  onEdit?: () => void
  editTo?: string
  // docs/specs/036-view-first-record-detail-screens.md: when present, this becomes the footer's
  // primary action ("View", VisibilityOutlined). If `editTo` is ALSO passed, both render side by
  // side (View, then Edit) — `onEdit` stays suppressed either way, since it's the bare-callback
  // fallback for call sites with neither a real view nor edit route. Purely additive: any call
  // site not passing this keeps its existing Edit-only footer unchanged.
  viewTo?: string
  secondaryAction?: RecordCardSecondaryAction
  // Additional secondary actions beyond the single `secondaryAction` slot above — e.g. a match
  // card carrying both Deactivate/Reactivate (secondaryAction) and "Communicate Team Sheet"
  // (docs/specs/030-team-sheet-communication.md). Rendered after `secondaryAction` (if both are
  // present) and before Edit, using the exact same Button markup/pending behaviour. `secondaryAction`
  // itself stays byte-for-byte unchanged so every existing single-action call site keeps compiling.
  secondaryActions?: RecordCardSecondaryAction[]
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
// Shared by the singular `badge` and the plural `badges` below so both render identically —
// extracted rather than duplicated inline once a second call site needed the exact same
// tone-to-styling mapping (docs/specs/040-announce-team.md).
export function badgeSx(tone: RecordCardBadgeTone) {
  if (tone === 'positive') {
    return {
      bgcolor: (theme: Theme) => alpha(theme.palette.primary.main, 0.12),
      color: 'primary.dark',
      fontWeight: 600,
    }
  }
  if (tone === 'muted') {
    // Visually distinct from both 'positive' (solid primary-tinted) and 'neutral' (bordered,
    // full-opacity) — a faded grey fill with reduced overall opacity, reading as
    // "inactive/archived" at a glance (e.g. RETIRED vs DRAFT's 'neutral' outline).
    return {
      bgcolor: (theme: Theme) => alpha(theme.palette.text.secondary, 0.12),
      color: 'text.secondary',
      opacity: 0.7,
    }
  }
  return undefined
}

export function RecordCard({
  title,
  avatar,
  badge,
  badges,
  description,
  fields,
  chips,
  editLabel = 'Edit',
  onEdit,
  editTo,
  viewTo,
  secondaryAction,
  secondaryActions,
  feedback,
}: RecordCardProps) {
  const allSecondaryActions = [...(secondaryAction ? [secondaryAction] : []), ...(secondaryActions ?? [])]

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
          {/* docs/specs/040-announce-team.md: flexWrap added so `badge` plus a couple of
              `badges` entries (up to 3 chips) never force horizontal overflow at 375px. */}
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap justifyContent="flex-end">
            {badge && (
              <Chip size="small" label={badge.label} variant={badge.tone === 'neutral' ? 'outlined' : 'filled'} sx={badgeSx(badge.tone)} />
            )}
            {badges?.map((entry, index) => (
              <Chip
                key={index}
                size="small"
                label={entry.label}
                variant={entry.tone === 'neutral' ? 'outlined' : 'filled'}
                sx={badgeSx(entry.tone)}
              />
            ))}
          </Stack>
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
                {/* component="div", not the variant's default <p> — field.value is a plain
                    ReactNode and, since docs/specs/031-jersey-numbers.md, sometimes a form
                    control (e.g. an inline-editable Input, which renders a <fieldset> for its
                    outline); a <p> cannot legally contain block-level content like that. */}
                <Typography variant="body2" fontWeight={600} component="div">
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

      <CardActions sx={{ justifyContent: 'flex-end', flexWrap: 'wrap', px: 2, pb: 2, pt: 0 }}>
        {allSecondaryActions.map((action, index) => (
          <Button
            key={index}
            variant="ghost"
            size="sm"
            disabled={action.pending}
            onClick={action.onClick}
            startIcon={action.icon}
          >
            {action.pending ? action.pendingLabel : action.label}
          </Button>
        ))}
        {viewTo ? (
          <>
            <MuiButton
              component={RouterLink}
              to={viewTo}
              variant="text"
              color="inherit"
              size="small"
              startIcon={<VisibilityOutlinedIcon fontSize="small" />}
            >
              View
            </MuiButton>
            {editTo && (
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
            )}
          </>
        ) : editTo ? (
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
