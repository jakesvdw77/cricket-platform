import { useState } from 'react'
import type { ReactNode } from 'react'
import { Avatar, Box, Chip, IconButton, Link as MuiLink, Typography } from '@mui/material'
import { lighten } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import { Link as RouterLink } from 'react-router-dom'
import LinkIcon from '@mui/icons-material/Link'
import LinkOffIcon from '@mui/icons-material/LinkOff'
import ManageAccountsOutlinedIcon from '@mui/icons-material/ManageAccountsOutlined'
import { avatarSx, badgeSx } from '../RecordCard'
import { FieldStatusMenu } from '../FieldStatusMenu'
import { initialsFromName } from '../../utils/initials'
import { FIELD_CATEGORY_LABEL } from '../../utils/fieldLabels'
import { FIELD_STATUS_ACTIONS, fieldStatusBadge, fieldStatusOf, VERIFIED_FIELD_NO_ACTIONS } from '../../utils/fieldStatus'
import type { FieldStatusAction } from '../../utils/fieldStatus'
import { NOT_ON_FILE } from '../../utils/playerFormat'
import { zebraTint } from '../../utils/zebraTint'
import type { PlayingArea } from '../../api/playingAreaApi'

export interface FieldTableProps {
  fields: PlayingArea[]
  viewTo: (field: PlayingArea) => string
  // A manager's list: the last column is the Add to our fields / Remove button.
  onToggleHome?: (field: PlayingArea) => void
  homePendingId?: string | null
  // The platform admin's list: the last column is the Status button and its menu.
  onStatusAction?: (field: PlayingArea, action: FieldStatusAction) => void
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

function FieldRow({
  field,
  viewTo,
  onToggleHome,
  homePending,
  onStatusAction,
}: {
  field: PlayingArea
  viewTo: string
  onToggleHome?: (field: PlayingArea) => void
  homePending: boolean
  onStatusAction?: (action: FieldStatusAction) => void
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const status = fieldStatusOf(field)
  const badge = fieldStatusBadge(status)
  const admin = Boolean(onStatusAction)
  const linkedHome = Boolean(field.linkedHome)
  const noStatusChanges = FIELD_STATUS_ACTIONS[status].length === 0

  return (
    <Box
      role="row"
      data-testid="field-row"
      sx={{
        ...gridSx,
        position: 'relative',
        minHeight: { xs: 56, sm: 44 },
        '&:nth-of-type(odd)': { bgcolor: zebraTint },
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
                opens the field; the row's button sits above it and never navigates. */}
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
      <Box role="cell" sx={{ display: 'flex', justifyContent: 'center' }}>
        {admin ? (
          <Box component="span" title={noStatusChanges ? VERIFIED_FIELD_NO_ACTIONS : 'Change status'} sx={{ display: 'inline-flex' }}>
            <IconButton
              aria-label="Change status"
              aria-haspopup="menu"
              size="small"
              disabled={noStatusChanges}
              onClick={(event) => setAnchor(event.currentTarget)}
              // position: relative lifts it above the row's stretched link, so using the menu never navigates
              sx={{ position: 'relative', color: 'primary.dark', width: 36, height: 36 }}
            >
              <ManageAccountsOutlinedIcon fontSize="small" />
            </IconButton>
          </Box>
        ) : (
          <IconButton
            aria-label={linkedHome ? `Remove ${field.name} from our fields` : `Add ${field.name} to our fields`}
            title={linkedHome ? 'Remove from our fields' : 'Add to our fields'}
            size="small"
            disabled={homePending || !onToggleHome}
            onClick={() => onToggleHome?.(field)}
            sx={{ position: 'relative', color: 'primary.dark', width: 36, height: 36 }}
          >
            {linkedHome ? <LinkOffIcon fontSize="small" /> : <LinkIcon fontSize="small" />}
          </IconButton>
        )}
      </Box>
      {admin && (
        <FieldStatusMenu status={status} anchorEl={anchor} onClose={() => setAnchor(null)} onAction={(action) => onStatusAction?.(action)} />
      )}
    </Box>
  )
}

// docs/specs/099-fields-directory.md: the list view of the Fields page, the shape of PlayerTable/MatchTable/LeagueTable.
// One bordered panel with a header row that sticks to the top of the scrolling page and zebra rows of equal height; the
// whole row opens the field, and the row's button (Add to our fields / Remove for a manager, Status for the platform
// admin) sits above that link and never navigates. A value that is not on file shows "-".
export function FieldTable({ fields, viewTo, onToggleHome, homePendingId = null, onStatusAction }: FieldTableProps) {
  return (
    <Box
      role="table"
      aria-label="Fields"
      sx={{
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        bgcolor: 'background.paper',
        boxShadow: 2,
        // clip, not hidden: it rounds the corners without becoming a scroll container, so the sticky header still sticks
        overflow: 'clip',
      }}
    >
      <Box
        role="row"
        sx={{
          ...gridSx,
          position: 'sticky',
          top: 0,
          zIndex: 1,
          height: { xs: 36, sm: 40 },
          bgcolor: 'background.paper',
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
        <Box role="columnheader" aria-label={onStatusAction ? 'Status actions' : 'Our fields'} />
      </Box>
      <Box role="rowgroup">
        {fields.map((field) => (
          <FieldRow
            key={field.id}
            field={field}
            viewTo={viewTo(field)}
            onToggleHome={onToggleHome}
            homePending={homePendingId === field.id}
            onStatusAction={onStatusAction ? (action) => onStatusAction(field, action) : undefined}
          />
        ))}
      </Box>
    </Box>
  )
}
