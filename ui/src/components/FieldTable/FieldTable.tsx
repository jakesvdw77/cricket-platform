import type { ReactNode } from 'react'
import { Avatar, Box, Chip, Link as MuiLink, Typography } from '@mui/material'
import { lighten } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import { Link as RouterLink } from 'react-router-dom'
import { avatarSx, badgeSx } from '../RecordCard'
import { ToolbarCard } from '../ToolbarCard'
import { initialsFromName } from '../../utils/initials'
import { FIELD_CATEGORY_LABEL } from '../../utils/fieldLabels'
import { fieldStatusBadge, fieldStatusOf } from '../../utils/fieldStatus'
import { NOT_ON_FILE } from '../../utils/playerFormat'
import { zebraTint } from '../../utils/zebraTint'
import type { PlayingArea } from '../../api/playingAreaApi'

export interface FieldTableProps {
  fields: PlayingArea[]
  // The field page for a row, already carrying its returnTo.
  viewTo: (field: PlayingArea) => string
  // The row's ONE actions button (the page's FieldRowMenu kebab), at the right end; it never navigates the row.
  rowActions?: (field: PlayingArea) => ReactNode
  // docs/specs/134 and page-anatomy section 3: the page's filter bar. Given, the table renders ONE card: this toolbar, a hairline,
  // then the header and rows. Omitted, the table is its own bordered card.
  toolbar?: ReactNode
  // With a toolbar and no rows: this message replaces the table inside the same card, so the toolbar never remounts.
  empty?: ReactNode
}

// Desktop: Field, Status, Type, Owner, City, Province, Matches and the button. A phone keeps Field (the status badge moves
// under the name), City and the button.
const COLUMNS = {
  xs: 'minmax(0, 1fr) 96px 44px',
  sm: 'minmax(200px, 2.2fr) 110px 100px minmax(120px, 1.4fr) 110px 130px 70px 44px',
}

const gridSx = {
  display: 'grid',
  gridTemplateColumns: COLUMNS,
  alignItems: 'center',
  columnGap: { xs: 0.75, sm: 1.5 },
  px: 1.5,
} as const

// The columns a phone drops.
const desktopOnly = { display: { xs: 'none', sm: 'block' } } as const
// Marks those cells for assistive tooling and tests (jsdom does not evaluate responsive CSS).
const DESKTOP_ONLY = { 'data-desktop-only': 'true' } as const

// clip, not hidden: it rounds the corners without becoming a scroll container, so the sticky header still sticks
const cardSx = { border: 1, borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper', boxShadow: 0, overflow: 'clip' } as const

const hoverTint = (theme: Theme) => lighten(theme.palette.primary.main, 0.86)

function Cell({ children, value, sx, hiddenOnPhone = false }: { children?: ReactNode; value?: string; sx?: object; hiddenOnPhone?: boolean }) {
  const missing = value === NOT_ON_FILE
  return (
    <Typography
      component="div"
      role="cell"
      variant="body2"
      {...(hiddenOnPhone ? DESKTOP_ONLY : {})}
      sx={{
        minWidth: 0,
        color: missing ? 'text.secondary' : 'text.primary',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        ...(hiddenOnPhone ? desktopOnly : {}),
        ...sx,
      }}
    >
      {children ?? value}
    </Typography>
  )
}

function FieldRow({ field, viewTo, actions }: { field: PlayingArea; viewTo: string; actions?: ReactNode }) {
  const status = fieldStatusOf(field)
  const badge = fieldStatusBadge(status)

  return (
    <Box
      role="row"
      data-testid="field-row"
      sx={{
        ...gridSx,
        position: 'relative',
        minHeight: { xs: 56, sm: 44 },
        // the header row is tinted, so the first data row is white and the second tinted (page-anatomy section 6)
        '&:nth-of-type(even)': { bgcolor: zebraTint },
        '&:hover': { bgcolor: hoverTint },
        // a keyboard user tabbing to the name (or the row's button) sees the whole row marked
        '&:focus-within': { outline: (theme: Theme) => `2px solid ${theme.palette.primary.main}`, outlineOffset: -2 },
      }}
    >
      <Box role="cell" sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
        <Avatar variant="rounded" sx={{ ...avatarSx(32, '0.75rem'), width: { xs: 40, sm: 32 }, height: { xs: 40, sm: 32 } }}>
          {initialsFromName(field.name)}
        </Avatar>
        <Box sx={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
          <Typography variant="body2" fontWeight={600} noWrap component="div">
            {/* Stretched link over the whole row (docs/specs/059): the row is position: relative, so a click anywhere on it
                opens the field; the row's button sits above it and never navigates. No chevron (page-anatomy section 6). */}
            <MuiLink
              component={RouterLink}
              to={viewTo}
              color="inherit"
              underline="none"
              sx={{ '&::after': { content: '""', position: 'absolute', inset: 0 } }}
            >
              {field.name}
            </MuiLink>
          </Typography>
          {/* On a phone the status badge sits under the name (the Status column is dropped) */}
          <Box sx={{ display: { xs: 'block', sm: 'none' } }}>
            <Chip size="small" label={badge.label} sx={{ ...badgeSx(badge.tone), height: 20, fontSize: '0.6875rem' }} data-testid="field-status-badge" />
          </Box>
        </Box>
      </Box>
      <Box role="cell" sx={desktopOnly} {...DESKTOP_ONLY}>
        <Chip size="small" label={badge.label} sx={{ ...badgeSx(badge.tone), height: 22, fontSize: '0.75rem' }} data-testid="field-status-badge-desktop" />
      </Box>
      <Cell hiddenOnPhone value={FIELD_CATEGORY_LABEL[field.category]} />
      <Cell hiddenOnPhone value={field.ownerName || NOT_ON_FILE} />
      <Cell value={field.address.city || NOT_ON_FILE} sx={{ fontSize: { xs: '0.8125rem', sm: '0.875rem' } }} />
      <Cell hiddenOnPhone value={field.address.provinceState || NOT_ON_FILE} />
      <Cell hiddenOnPhone sx={{ textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
        {field.matchCount ?? 0}
      </Cell>
      <Box role="cell" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', color: 'primary.main' }}>
        {actions}
      </Box>
    </Box>
  )
}

// docs/specs/099 and docs/specs/134: the list view of the Fields page, the shape of SeasonTable and LeagueTable. One flat card
// (hairline, no shadow) whose toolbar, when given, is its top row; a tinted header row that sticks to the top of the scrolling
// page, a white first row then tinted rows of equal height; the whole row opens the field, no chevron, and the row's one kebab
// sits above that link and never navigates. A value that is not on file shows "-".
export function FieldTable({ fields, viewTo, rowActions, toolbar, empty }: FieldTableProps) {
  const table = (
    <Box role="table" aria-label="Fields" sx={toolbar ? undefined : cardSx}>
      <Box
        role="row"
        sx={{
          ...gridSx,
          position: 'sticky',
          top: 0,
          zIndex: 1,
          height: { xs: 36, sm: 40 },
          bgcolor: zebraTint,
          borderBottom: 1,
          borderColor: 'divider',
          fontSize: { xs: '0.6875rem', sm: '0.75rem' },
          fontWeight: 700,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: 'text.secondary',
        }}
      >
        <Box role="columnheader">Field</Box>
        <Box role="columnheader" sx={desktopOnly} {...DESKTOP_ONLY}>Status</Box>
        <Box role="columnheader" sx={desktopOnly} {...DESKTOP_ONLY}>Type</Box>
        <Box role="columnheader" sx={desktopOnly} {...DESKTOP_ONLY}>Owner</Box>
        <Box role="columnheader">City</Box>
        <Box role="columnheader" sx={desktopOnly} {...DESKTOP_ONLY}>Province</Box>
        <Box role="columnheader" sx={{ ...desktopOnly, textAlign: 'right' }} {...DESKTOP_ONLY}>Matches</Box>
        <Box role="columnheader" aria-label="Actions" />
      </Box>
      <Box role="rowgroup">
        {fields.map((field) => (
          <FieldRow key={field.id} field={field} viewTo={viewTo(field)} actions={rowActions?.(field)} />
        ))}
      </Box>
    </Box>
  )
  if (toolbar) {
    return (
      <Box data-testid="fields-fused-card" sx={cardSx}>
        <ToolbarCard fused>{toolbar}</ToolbarCard>
        {fields.length === 0 && empty ? empty : table}
      </Box>
    )
  }
  return table
}
