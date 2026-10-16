import type { MouseEvent, ReactNode } from 'react'
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
import { STRUCTURAL_PURPLE } from '../../theme'
import { Button } from '../Button'

// The first three are the original general-purpose tones. The poll tones are for the availability
// poll screens (PollCard and both Responses page headers) so one poll reads the same everywhere:
// squadPoll / groupPoll name the kind, open / closed the state, side the Home/Away marker. Each is
// always paired with its text label - colour is never the only signal.
export type RecordCardBadgeTone =
  | 'positive'
  | 'neutral'
  | 'muted'
  | 'squadPoll'
  | 'groupPoll'
  | 'open'
  | 'closed'
  | 'side'
  | 'noPoll'
  // docs/specs/072-league-view-pages.md: the league card/header badges - format (purple), season
  // (amber) and active (green tint).
  | 'format'
  | 'season'
  | 'active'
  // docs/specs/077: a record needing attention (PlayerCard's missing date of birth).
  | 'warning'

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
  fallback?: ReactNode
  shape?: 'circular' | 'rounded'
  // docs/specs/082: a ready-made 56px element (e.g. a BrandIcon tile) drawn in place of the solid
  // Avatar - no green square behind it. When set, imageUrl/fallback/shape are ignored.
  element?: ReactNode
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
  // docs/specs/075-match-view-and-edit.md: receives the click event so a button can anchor a menu to it.
  onClick?: (event: MouseEvent<HTMLElement>) => void
  // docs/specs/092: a router link instead of a click handler (a real anchor, so it can open in a new tab). Teams' footer.
  to?: string
  disabled?: boolean
  // Tooltip text, defaulting to `ariaLabel ?? label`. When set on a `disabled` button it also
  // explains why: the button is wrapped in a span carrying the tooltip, because a disabled
  // ButtonBase has pointer-events none and would never show its own `title`.
  title?: string
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
  // How many lines `titleWrap` clamps the title to before the ellipsis; defaults to 2. The poll card
  // passes 3 so a long description-style title reads in full beside its pencil. Ignored without
  // `titleWrap`. Purely additive.
  titleLines?: number
  // docs/specs/069-match-card-redesign.md: render the badge/badges chips in their own full-width,
  // right-aligned wrapping row ABOVE the avatar + title header, so the title keeps the full card
  // width instead of being squeezed by a right-hand badge cluster. The header's right-hand badges
  // are then not rendered. Purely additive: omitted, nothing changes.
  badgesAbove?: boolean
  // docs/specs/087-matches-polls-alignment.md: render the badges in a left-aligned wrapping row directly
  // BELOW the header (the poll card's layout) while `headerActions` stay top-right, without needing a
  // `cornerAction`. Ignored when `badgesAbove` is set. Purely additive: omitted, nothing changes.
  badgesBelow?: boolean
  // Small actions (icon buttons) drawn at the right end of the title row when badgesAbove or badgesBelow is set; positioned
  // above the stretched view link so they stay clickable.
  headerActions?: ReactNode
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

// 'neutral' and 'noPoll' are the outlined tones; every other tone is a filled chip.
function isOutlinedTone(tone: RecordCardBadgeTone) {
  return tone === 'neutral' || tone === 'noPoll'
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
  if (tone === 'noPoll') {
    // 'No poll': a dashed outline with muted text, so the absence of a poll reads as an empty slot
    // rather than a status. Rendered as an outlined chip (see isOutlinedTone).
    return {
      color: 'text.secondary',
      borderStyle: 'dashed',
      borderColor: 'text.disabled',
      bgcolor: 'transparent',
      fontWeight: 600,
    }
  }
  if (tone === 'squadPoll') return tintedBadgeSx('primary', 'primary.dark')
  if (tone === 'groupPoll') return tintedBadgeSx('warning', 'warning.dark')
  if (tone === 'format') return tintedBadgeSx('purple', 'purple.dark', 0.1)
  if (tone === 'season') return tintedBadgeSx('warning', 'warning.dark')
  if (tone === 'active') return tintedBadgeSx('success', 'success.dark')
  if (tone === 'warning') return tintedBadgeSx('warning', 'warning.dark')
  if (tone === 'side') return tintedBadgeSx('info', 'info.dark')
  if (tone === 'closed') return tintedBadgeSx('error', 'error.dark')
  if (tone === 'open') {
    return { bgcolor: 'success.main', color: 'success.contrastText', fontWeight: 600 }
  }
  return undefined
}

// A light tint of the palette colour with a matching border and a dark same-hue text, so the badge
// stays legible on the white card.
function tintedBadgeSx(
  palette: 'primary' | 'warning' | 'info' | 'error' | 'success' | 'purple',
  color: string,
  fill = 0.14,
) {
  // The purple token falls back to the structural constant so a badge rendered outside the app's
  // ThemeProvider (tests, stories) still resolves a colour.
  const main = (theme: Theme) =>
    palette === 'purple' ? (theme.palette.purple ?? STRUCTURAL_PURPLE).main : theme.palette[palette].main
  return {
    bgcolor: (theme: Theme) => alpha(main(theme), fill),
    color: palette === 'purple' ? (theme: Theme) => (theme.palette.purple ?? STRUCTURAL_PURPLE).dark : color,
    border: 1,
    borderColor: (theme: Theme) => alpha(main(theme), 0.5),
    fontWeight: 600,
  }
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
  titleLines = 2,
  badgesAbove,
  badgesBelow,
  headerActions,
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
          WebkitLineClamp: titleLines,
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
        <Chip size="small" label={badge.label} variant={isOutlinedTone(badge.tone) ? 'outlined' : 'filled'} sx={badgeSx(badge.tone)} />
      )}
      {badges?.map((entry, index) => (
        <Chip
          key={index}
          size="small"
          label={entry.label}
          variant={isOutlinedTone(entry.tone) ? 'outlined' : 'filled'}
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
        {badgesAbove && (badge || (badges && badges.length > 0)) && (
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap justifyContent="flex-end" data-testid="badges-above">
            {badgeChips}
          </Stack>
        )}
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
          <Stack
            direction="row"
            alignItems="center"
            spacing={1.5}
            sx={{ minWidth: 0, ...(titleWrap && { flex: 1 }) }}
          >
            {avatar?.element}
            {avatar && !avatar.element && (
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
            {titleEdit && !cornerAction && (
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
            // The title pencil (when there is one) joins the corner action in one right-aligned cluster
            // so the two icons sit flush against the card's right edge whatever the title length.
            <Stack direction="row" alignItems="flex-start" sx={{ flexShrink: 0, mt: -0.5, mr: -0.5 }}>
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
              <IconButton
                size="small"
                aria-label={cornerAction.pending ? cornerAction.pendingLabel : cornerAction.label}
                title={cornerAction.label}
                disabled={cornerAction.pending}
                onClick={cornerAction.onClick}
                // position: relative keeps it above any viewTo stretched-link overlay.
                sx={{ position: 'relative', flexShrink: 0 }}
              >
                {cornerAction.icon}
              </IconButton>
            </Stack>
          ) : badgesAbove || badgesBelow ? (
            headerActions ? (
              <Box sx={{ position: 'relative', display: 'flex', flexShrink: 0, alignItems: 'flex-start', mt: -0.5, mr: -0.5 }}>
                {headerActions}
              </Box>
            ) : null
          ) : (
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap justifyContent="flex-end">
              {badgeChips}
            </Stack>
          )}
        </Stack>

        {(cornerAction || badgesBelow) && !badgesAbove && (badge || (badges && badges.length > 0)) && (
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
        // at 11px) and the shared card grid (utils/cardGrid.ts) never makes a card narrower than 380px
        // (capped at 100% on a narrower phone), i.e. >= ~85px per column.
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
          {footerButtons.map((button, index) => {
            const tooltip = button.title ?? button.ariaLabel ?? button.label
            const control = (
            <ButtonBase
              key={`${index}-${button.label}`}
              aria-label={button.ariaLabel ?? button.label}
              title={tooltip}
              disabled={button.disabled}
              onClick={button.onClick}
              {...(button.to ? { component: RouterLink, to: button.to } : {})}
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 0.25,
                minWidth: 0,
                width: '100%',
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
            )
            return button.disabled && button.title ? (
              <Box key={`${index}-${button.label}`} component="span" title={tooltip} sx={{ display: 'flex', minWidth: 0 }}>
                {control}
              </Box>
            ) : (
              control
            )
          })}
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
