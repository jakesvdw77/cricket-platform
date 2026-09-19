import type { ReactNode } from 'react'
import { Avatar, Box, Button as MuiButton, Chip, Stack, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import { Link as RouterLink } from 'react-router-dom'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import type { RecordCardAvatar, RecordCardBadge } from '../RecordCard'

export interface RecordDetailScreenSection {
  // Omitted entirely for a single-section page (Season/Club Contact/Sponsor Contact/Sponsor) —
  // RecordDetailScreen renders no heading at all when this is undefined, per
  // docs/plans/036-view-first-record-detail-screens.md item 1.
  heading?: string
  // A small supplementary control/caption rendered directly under the heading (e.g. Team's own
  // "N players" stat pill, or a season-filter Select for Team's Squad/League's Affiliations
  // sections) — distinct from `content` so a section can carry a non-field-grid control above its
  // main body without every caller re-inventing the same spacing.
  note?: ReactNode
  content: ReactNode
}

export interface RecordDetailScreenProps {
  title: string
  backTo: string
  backLabel: string
  // Reuses RecordCard's own avatar/badge shape verbatim (docs/plans/036's item 1) — the header
  // mirrors RecordCard's fixed slot order (avatar + title + badge), just larger, since this is the
  // one full-page rendering of a record rather than a grid tile.
  avatar?: RecordCardAvatar
  badge?: RecordCardBadge
  editTo: string
  editLabel?: string
  sections: RecordDetailScreenSection[]
}

// The read-only counterpart to RecordFormScreen (docs/specs/036-view-first-record-detail-screens.md):
// a single, tab-free page — a Back action (RecordFormScreen's own markup, reused verbatim), a
// header mirroring RecordCard's avatar/title/badge slots plus one Edit action, then a vertical
// stack of labelled sections in place of tabs. Every mutating affordance beyond the single Edit
// button lives on the edit form this screen's Edit action leads to, not here.
export function RecordDetailScreen({
  title,
  backTo,
  backLabel,
  avatar,
  badge,
  editTo,
  editLabel = 'Edit',
  sections,
}: RecordDetailScreenProps) {
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

        <Stack
          direction="row"
          alignItems="flex-start"
          justifyContent="space-between"
          spacing={2}
          flexWrap="wrap"
          useFlexGap
        >
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ minWidth: 0 }}>
            {avatar && (
              <Avatar
                src={avatar.imageUrl ?? undefined}
                variant={avatar.shape === 'rounded' ? 'rounded' : 'circular'}
                sx={{
                  width: 56,
                  height: 56,
                  flex: 'none',
                  fontSize: '1.125rem',
                  fontWeight: 600,
                  bgcolor: (theme) => alpha(theme.palette.primary.main, 0.14),
                  color: 'primary.dark',
                }}
              >
                {avatar.fallback}
              </Avatar>
            )}
            <Stack spacing={0.5} sx={{ minWidth: 0 }}>
              <Typography variant="h6" component="h1" noWrap>
                {title}
              </Typography>
              {badge && (
                <Chip
                  size="small"
                  label={badge.label}
                  variant={badge.tone === 'neutral' ? 'outlined' : 'filled'}
                  sx={{
                    alignSelf: 'flex-start',
                    ...(badge.tone === 'positive'
                      ? { bgcolor: (theme) => alpha(theme.palette.primary.main, 0.12), color: 'primary.dark', fontWeight: 600 }
                      : badge.tone === 'muted'
                        ? { bgcolor: (theme) => alpha(theme.palette.text.secondary, 0.12), color: 'text.secondary', opacity: 0.7 }
                        : {}),
                  }}
                />
              )}
            </Stack>
          </Stack>

          {/* The one mutating affordance on the whole screen — matches the mockup's `.edit-btn`
              treatment (a tinted-primary outlined button, not RecordCard's plain text Edit link,
              since this is the page's single, deliberate action rather than a grid-tile footer
              action among several). */}
          <MuiButton
            component={RouterLink}
            to={editTo}
            variant="outlined"
            startIcon={<EditOutlinedIcon fontSize="small" />}
            sx={{
              flex: 'none',
              bgcolor: (theme) => alpha(theme.palette.primary.main, 0.12),
              color: 'primary.dark',
              borderColor: 'transparent',
              '&:hover': {
                borderColor: 'transparent',
                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.2),
              },
            }}
          >
            {editLabel}
          </MuiButton>
        </Stack>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {sections.map((section, index) => (
          <Box key={section.heading ?? index} sx={index > 0 ? { pt: 3, borderTop: 1, borderColor: 'divider' } : undefined}>
            {section.heading && (
              <Typography
                variant="subtitle2"
                sx={{ display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'text.secondary', mb: 1.5 }}
              >
                {section.heading}
              </Typography>
            )}
            {section.note && <Box sx={{ mb: 1.5 }}>{section.note}</Box>}
            {section.content}
          </Box>
        ))}
      </Box>
    </Box>
  )
}

export interface DetailFieldRowProps {
  icon: ReactNode
  label: string
  value: ReactNode
}

// The small icon+caption+value row every section's field grid is built from (docs/plans/036's
// item 1) — an icon-prefixed evolution of RecordCard's own "caption label above bold value" field
// slot, per the approved Claude Design pass.
export function DetailFieldRow({ icon, label, value }: DetailFieldRowProps) {
  return (
    <Stack direction="row" spacing={1.25} alignItems="flex-start">
      <Box
        sx={{
          color: 'text.secondary',
          display: 'flex',
          alignItems: 'center',
          pt: 0.25,
          flex: 'none',
          '& svg': { fontSize: 19 },
        }}
      >
        {icon}
      </Box>
      <Stack spacing={0.25} sx={{ minWidth: 0 }}>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
        {/* component="div", not the variant's default <p> — same RecordCard.tsx precedent
            (docs/specs/031-jersey-numbers.md) in case a caller ever passes richer content. */}
        <Typography variant="body2" fontWeight={600} component="div">
          {value}
        </Typography>
      </Stack>
    </Stack>
  )
}

export interface DetailFieldGridProps {
  children: ReactNode
}

// The responsive field grid every section's DetailFieldRows sit in — the same
// `{ xs: '1fr', md: '1fr 1fr' }` grid RecordFormScreen already uses, pulled out here (rather than
// each of the eight DetailPages re-declaring the same sx) since every entity's Details-shaped
// section reuses it identically.
export function DetailFieldGrid({ children }: DetailFieldGridProps) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2.5 }}>{children}</Box>
  )
}
