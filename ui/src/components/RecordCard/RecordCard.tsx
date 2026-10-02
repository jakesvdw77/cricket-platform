import type { ReactNode } from 'react'
import {
  Avatar,
  ButtonBase,
  Box,
  Card as MuiCard,
  CardActions,
  CardContent,
  Chip,
  IconButton,
  Link as MuiLink,
  Stack,
  Typography,
  Button as MuiButton,
} from '@mui/material'
import { alpha } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
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
  // docs/specs/059-record-card-click-to-view.md: when `viewTo` is set, the card's title becomes a
  // "stretched link" whose click target is expanded (via an absolutely-positioned ::after) to cover
  // the whole card. If `value` here is itself interactive (e.g. 031-jersey-numbers.md's inline
  // jersey-number Input on TeamFormPage.tsx's SquadPlayerCard), that element must be given its own
  // `position: relative` (or another stacking context) so it paints above the stretched-link overlay
  // — RecordCard can't add this itself, since it has no way to know in advance whether an arbitrary
  // ReactNode passed as a field value is interactive.
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
const FEEDBACK_COLOR = { success: 'success.main', error: 'error.main', muted: 'text.secondary' } as const

export interface RecordCardFeedback {
  message: string
  tone: 'success' | 'error' | 'muted'
}

// docs/specs/066-poll-close-time-and-unified-cards.md: one button of the equal-column footer - an
// icon above a short caption. `ariaLabel` is the accessible name when the caption alone is too
// terse (e.g. caption 'Share', ariaLabel 'Share invite'); it defaults to the label.
export interface RecordCardFooterButton {
  label: string
  ariaLabel?: string
  icon: ReactNode
  onClick: () => void
  disabled?: boolean
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
  // docs/specs/036-view-first-record-detail-screens.md: when present, the card's title becomes a
  // "stretched link" to this route (docs/specs/059-record-card-click-to-view.md) — clicking
  // anywhere on the card navigates here, replacing the earlier dedicated footer "View" button. If
  // `editTo` is ALSO passed, the footer still renders Edit alongside the title link — `onEdit`
  // stays suppressed either way, since it's the bare-callback fallback for call sites with neither
  // a real view nor edit route. Purely additive: any call site not passing this keeps its existing
  // Edit-only footer unchanged.
  viewTo?: string
  // docs/specs/064-unified-availability-polls.md: a pencil icon button right after the title, for a
  // card whose only edit is a small inline one (the group poll card's description). When set it IS
  // the card's edit affordance, so the footer Edit button is not rendered; `onEdit`/`editTo` are
  // ignored. Purely additive: call sites not passing it are unchanged.
  titleEdit?: { label: string; onClick: () => void }
  // Let the title wrap to up to two lines (ellipsis only beyond that) instead of the single-line
  // `noWrap` ellipsis - for cards whose titles are long sentences (the poll card). The title area
  // then flexes (flex 1, minWidth 0) so a titleEdit pencil stays right after the text and the
  // corner action / badges stay top-right. Purely additive: omitted, nothing changes.
  titleWrap?: boolean
  // docs/specs/064-unified-availability-polls.md: a compact icon-only action (e.g. Delete) in the
  // card's top-right corner, after the badges, keeping the footer for the main actions. The
  // action's `label` is its accessible name and tooltip; `icon` is required.
  cornerAction?: RecordCardSecondaryAction & { icon: ReactNode }
  secondaryAction?: RecordCardSecondaryAction
  // Additional secondary actions beyond the single `secondaryAction` slot above — e.g. a match
  // card carrying both Deactivate/Reactivate (secondaryAction) and "Communicate Team Sheet"
  // (docs/specs/030-team-sheet-communication.md). Rendered after `secondaryAction` (if both are
  // present) and before Edit, using the exact same Button markup/pending behaviour. `secondaryAction`
  // itself stays byte-for-byte unchanged so every existing single-action call site keeps compiling.
  secondaryActions?: RecordCardSecondaryAction[]
  feedback?: RecordCardFeedback | null
  // docs/specs/066: a free body slot rendered between the fields/chips and the feedback line - the
  // poll card's slot summaries and Closes row. Purely additive: omitted, nothing changes.
  children?: ReactNode
  // docs/specs/066: when present, replaces the default footer with N equal-width columns (one per
  // entry), each an icon above a short caption, so no button is clipped or wrapped at any card
  // width - the unified poll card passes exactly four. Every other footer prop is then ignored.
  footerButtons?: RecordCardFooterButton[]
}

// The grid unit for any record list (ProductList today, future Subscriptions/Discounts/
// Invoicing/System Settings screens — docs/specs/008-product-catalog.md's UI Requirements).
// Fixed slot order regardless of which screen uses it: avatar + title + status badge, a
// 2-line-clamped description, a row of key fields, an optional row of attribute chips, then an
// Edit footer. Solid `background.paper` + shadow (see docs/standards/design-system.md) keeps the
// card visible against the page without competing with badge/chip colour — every shell's <main>
// now carries its own brand-tinted gradient background (theme.ts's pageBackgroundGradient), and a
// translucent tint card read as indistinguishable from it; an opaque, shadowed card reads as a
// surface floating above it instead. Built directly from MUI Card/CardContent/CardActions rather
// than the shared Card component — this slot structure is more specific than Card's generic
// title/children/footer shape.
// Shared by the singular `badge` and the plural `badges` below so both render identically —
// extracted rather than duplicated inline once a second call site needed the exact same
// tone-to-styling mapping (docs/specs/040-announce-team.md).
// The shared solid-fill avatar treatment — real user feedback preferring AvatarMenu.tsx's
// existing solid `primary.main` + white-text look over every other avatar site's independently
// hand-rolled light tint (`alpha(primary.main, 0.14)` + `primary.dark`). `size` covers both list-
// card and detail-header avatars alike (56px for a record's own primary avatar), `fontSize`
// defaults to the size that pairs with a 56px avatar; smaller avatar contexts (icon grids, logo
// rows, the account menu) pass their own existing fontSize explicitly.
export function avatarSx(size: number, fontSize?: string) {
  return {
    width: size,
    height: size,
    flex: 'none' as const,
    fontSize: fontSize ?? '1.125rem',
    fontWeight: 600,
    bgcolor: 'primary.main',
    color: 'primary.contrastText',
  }
}

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
  titleEdit,
  titleWrap,
  cornerAction,
  secondaryAction,
  secondaryActions,
  feedback,
  children,
  footerButtons,
}: RecordCardProps) {
  const titleTypographyProps = titleWrap
    ? {
        sx: {
          minWidth: 0,
          flex: '0 1 auto',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical' as const,
          overflow: 'hidden',
          overflowWrap: 'anywhere' as const,
        },
      }
    : { noWrap: true }
  const allSecondaryActions = [...(secondaryAction ? [secondaryAction] : []), ...(secondaryActions ?? [])]
  // The status chips, shared by the default top-right slot and the cornerAction layout's own row.
  const badgeChips = (
    <>
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
    </>
  )

  return (
    // height: '100%' + column flex, direct user feedback: a row of these cards sits in a CSS grid
    // (grid's own default align-items: stretch already equalizes each card's outer height to the
    // row's tallest), but without this the footer (CardActions) just trailed the content instead of
    // occupying that extra stretched space — so unequal content heights left View/Edit at different
    // vertical positions from one card to the next in the same row. flex: '1 1 auto' on CardContent
    // makes it the one element that grows into that space, leaving CardActions pinned to the bottom.
    // position: 'relative' makes this MuiCard the containing block the title link's stretched
    // ::after resolves `inset: 0` against, per docs/specs/059-record-card-click-to-view.md — the
    // ::after fills exactly this element, not the viewport or some other ancestor.
    <MuiCard
      sx={{
        bgcolor: 'background.paper',
        boxShadow: 2,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        // Real user feedback: with the explicit "View" button gone, a viewTo card otherwise gives
        // no visual cue at all that it's clickable beyond the cursor changing on hover — mirrors
        // the legacy Cricket Legend app's own hover "halo." transition keeps it from feeling
        // abrupt; only applies to viewTo cards, since an editTo/onEdit-only card was never made
        // click-anywhere (see this spec's Non-goals) and shouldn't imply it is.
        ...(viewTo && {
          transition: 'box-shadow 0.15s ease, outline-color 0.15s ease',
          outline: '1px solid transparent',
          '&:hover': { boxShadow: 6, outlineColor: 'primary.main' },
        }),
      }}
    >
      <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, flex: '1 1 auto' }}>
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
          <Stack
            direction="row"
            alignItems="center"
            spacing={1.5}
            sx={{ minWidth: 0, ...(titleWrap && { flex: 1 }) }}
          >
            {avatar && (
              <Avatar
                src={avatar.imageUrl ?? undefined}
                variant={avatar.shape === 'rounded' ? 'rounded' : 'circular'}
                sx={avatarSx(56)}
              >
                {avatar.fallback}
              </Avatar>
            )}
            {viewTo ? (
              // The heading (h3) stays the outer element so this card keeps exactly the same
              // heading semantics as before (screen-reader heading navigation, existing
              // `getByRole('heading', ...)` queries across every consuming list's own tests) — the
              // stretched-link technique is layered onto an inner MuiLink rather than replacing the
              // heading itself.
              //
              // Deliberately does NOT set `position: 'relative'` on this link, even though the
              // spec's own UI Requirements prose describes the link itself as carrying it — verified
              // empirically (Playwright, real browser hit-testing) that doing so makes the *link*
              // the nearest positioned ancestor for its own `::after` (a pseudo-element is generated
              // as the last child of its originating element, so the containing-block search for an
              // absolutely-positioned `::after` starts at, and immediately resolves to, that
              // element's own `position: relative`, never reaching MuiCard). That constrains the
              // stretched overlay to the link's own tiny box instead of the whole card — the
              // opposite of this spec's goal. Leaving the link `position: static` (the default) lets
              // the containing-block search skip over it and resolve to MuiCard (the outer
              // `position: relative` element), which is what actually makes `inset: 0` cover the
              // whole card.
              <Typography variant="subtitle1" component="h3" fontWeight={600} {...titleTypographyProps}>
                <MuiLink
                  component={RouterLink}
                  to={viewTo}
                  color="inherit"
                  underline="none"
                  sx={{ '&::after': { content: '""', position: 'absolute', inset: 0 } }}
                >
                  {title}
                </MuiLink>
              </Typography>
            ) : (
              <Typography variant="subtitle1" component="h3" fontWeight={600} {...titleTypographyProps}>
                {title}
              </Typography>
            )}
            {titleEdit && (
              <IconButton
                size="small"
                aria-label={titleEdit.label}
                title={titleEdit.label}
                onClick={titleEdit.onClick}
                // position: relative keeps it above any viewTo stretched-link overlay.
                sx={{ position: 'relative', flexShrink: 0 }}
              >
                <EditOutlinedIcon fontSize="small" />
              </IconButton>
            )}
          </Stack>
          {/* docs/specs/040-announce-team.md: flexWrap added so `badge` plus a couple of
              `badges` entries (up to 3 chips) never force horizontal overflow at 375px.
              docs/specs/064-unified-availability-polls.md: a card with a `cornerAction` shows only
              that icon here and moves the badges to their own row below, so the title keeps the
              full header width instead of being truncated. */}
          {cornerAction ? (
            <IconButton
              size="small"
              aria-label={cornerAction.pending ? cornerAction.pendingLabel : cornerAction.label}
              title={cornerAction.label}
              disabled={cornerAction.pending}
              onClick={cornerAction.onClick}
              // position: relative keeps it above any viewTo stretched-link overlay.
              sx={{ position: 'relative', flexShrink: 0, mt: -0.5, mr: -0.5 }}
            >
              {cornerAction.icon}
            </IconButton>
          ) : (
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap justifyContent="flex-end">
              {badgeChips}
            </Stack>
          )}
        </Stack>

        {cornerAction && (badge || (badges && badges.length > 0)) && (
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {badgeChips}
          </Stack>
        )}

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

        {children}

        {feedback && (
          <Typography variant="body2" color={FEEDBACK_COLOR[feedback.tone]}>
            {feedback.message}
          </Typography>
        )}
      </CardContent>

      {/* position: 'relative' is the stacking-order fix docs/specs/059-record-card-click-to-view.md
          flags as the trickiest part of this spec: the title link's absolutely-positioned ::after
          overlay (above) paints above every plain, unpositioned sibling in the same stacking
          context regardless of DOM order — without this, every button below (secondary actions,
          Edit) would silently stop receiving clicks, swallowed by that overlay. Giving CardActions
          its own position lifts every button inside it above the overlay in one place, with no
          explicit z-index and no per-button change needed. */}
      {footerButtons ? (
        // minmax(0, 1fr) columns + minWidth 0 keep the columns equal whatever the card width. The
        // no-clip guarantee is the caller's: captions stay short (the longest is 'Responses', ~52px
        // at 11px) and the poll grid never makes a card narrower than 320px (>= ~74px per column).
        // The ellipsis below is only a last-resort safety net, never the expected path.
        <CardActions
          sx={{
            display: 'grid',
            gridTemplateColumns: `repeat(${footerButtons.length}, minmax(0, 1fr))`,
            gap: 0.5,
            px: 1,
            pb: 1,
            pt: 0,
            position: 'relative',
            borderTop: 1,
            borderColor: 'divider',
            // CardActions' own 8px left margin between siblings would skew the equal columns.
            '& > :not(:first-of-type)': { ml: 0 },
          }}
        >
          {footerButtons.map((button, index) => (
            <ButtonBase
              key={`${index}-${button.label}`}
              aria-label={button.ariaLabel ?? button.label}
              title={button.ariaLabel ?? button.label}
              disabled={button.disabled}
              onClick={button.onClick}
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 0.25,
                minWidth: 0,
                py: 1,
                px: 0.25,
                borderRadius: 1,
                color: 'primary.dark',
                '&:hover': { bgcolor: 'action.hover' },
                '&.Mui-disabled': { opacity: 0.5 },
                '&.Mui-focusVisible': { bgcolor: 'action.focus' },
              }}
            >
              {button.icon}
              <Box
                component="span"
                sx={{
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  lineHeight: 1.2,
                  whiteSpace: 'nowrap',
                  textAlign: 'center',
                  minWidth: 0,
                  maxWidth: '100%',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {button.label}
              </Box>
            </ButtonBase>
          ))}
        </CardActions>
      ) : (
        <CardActions sx={{ justifyContent: 'flex-end', flexWrap: 'wrap', px: 2, pb: 2, pt: 0, position: 'relative' }}>
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
          {titleEdit ? null : viewTo ? (
            editTo && (
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
            )
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
      )}
    </MuiCard>
  )
}
