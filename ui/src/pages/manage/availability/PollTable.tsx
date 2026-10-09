import { Box, Chip, Link as MuiLink, Typography } from '@mui/material'
import { lighten } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import { Link as RouterLink } from 'react-router-dom'
import ChevronRightOutlinedIcon from '@mui/icons-material/ChevronRightOutlined'
import { badgeSx } from '../../../components/RecordCard'
import { useCountdown } from '../../../components/Countdown'
import { zebraTint } from '../../../utils/zebraTint'
import { closesRowText } from './pollHelpers'
import type { PollPanelRow } from './pollPanelRows'

export interface PollTableProps {
  rows: PollPanelRow[]
}

// Desktop: Poll, Type, Status, Closes, Answered, chevron. A phone keeps Poll (the chips and the closing time under the
// title), Answered and the chevron.
const COLUMNS = {
  xs: 'minmax(0, 1fr) 54px 32px',
  sm: 'minmax(220px, 2fr) 84px 84px minmax(150px, 1.2fr) minmax(170px, 1.2fr) 32px',
}

const gridSx = {
  display: 'grid',
  gridTemplateColumns: COLUMNS,
  alignItems: 'center',
  columnGap: { xs: 0.75, sm: 1.5 },
  px: 1.5,
} as const

const desktopOnly = { display: { xs: 'none', sm: 'block' } } as const
const phoneOnly = { display: { xs: 'block', sm: 'none' } } as const
// Marks those cells for assistive tooling and tests (jsdom does not evaluate responsive CSS).
const DESKTOP_ONLY = { 'data-desktop-only': 'true' } as const

const hoverTint = (theme: Theme) => lighten(theme.palette.primary.main, 0.86)

function PollRow({ row }: { row: PollPanelRow }) {
  // The countdown (and the amber tone) exist only for an open poll with an automatic close time.
  const target = row.open && row.autoClose && row.scheduledCloseAt ? row.scheduledCloseAt : null
  const countdown = useCountdown(target)
  const soon = target !== null && countdown.stage !== 'none' && countdown.warn
  const manual = row.open && !target
  const closesText = closesRowText(row.open, row.autoClose, row.scheduledCloseAt)
  const caption = target ? (countdown.text ? `in ${countdown.text}` : countdown.stage === 'expired' ? 'Closing now' : '') : manual ? 'No auto-close' : ''
  const timeColor = soon ? 'warning.dark' : 'text.secondary'
  const typeChip = (height: number) => (
    <Chip
      size="small"
      label={row.kind === 'GROUP' ? 'Group' : 'Squad'}
      sx={{ ...badgeSx(row.kind === 'GROUP' ? 'groupPoll' : 'squadPoll'), height, fontSize: '0.75rem' }}
    />
  )
  const statusChip = (height: number) => (
    <Chip size="small" label={row.open ? 'Open' : 'Closed'} sx={{ ...badgeSx(row.open ? 'open' : 'closed'), height, fontSize: '0.75rem' }} />
  )
  const percent = row.total > 0 ? Math.min(100, (row.answered / row.total) * 100) : 0

  return (
    <Box
      role="row"
      data-testid="poll-row"
      data-tone={soon ? 'warning' : 'neutral'}
      sx={{
        ...gridSx,
        position: 'relative',
        minHeight: { xs: 64, sm: 56 },
        '&:nth-of-type(odd)': { bgcolor: zebraTint },
        '&:hover': { bgcolor: hoverTint },
        '&:focus-within': { outline: (theme: Theme) => `2px solid ${theme.palette.primary.main}`, outlineOffset: -2 },
      }}
    >
      <Box role="cell" sx={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
        <Typography variant="body2" fontWeight={600} noWrap component="div">
          {/* Stretched link over the whole row (docs/specs/059): the row is position: relative. */}
          <MuiLink component={RouterLink} to={row.path} color="inherit" underline="none" sx={{ '&::after': { content: '""', position: 'absolute', inset: 0 } }}>
            {row.title}
          </MuiLink>
        </Typography>
        {row.subtitle && (
          <Typography variant="caption" color="text.secondary" noWrap sx={desktopOnly} {...DESKTOP_ONLY}>
            {row.subtitle}
          </Typography>
        )}
        <Box sx={{ ...phoneOnly, display: { xs: 'flex', sm: 'none' }, gap: 0.75, alignItems: 'center', flexWrap: 'wrap' }} data-testid="poll-row-phone-chips">
          {typeChip(20)}
          {statusChip(20)}
        </Box>
        <Typography variant="caption" noWrap sx={{ ...phoneOnly, color: timeColor }} data-testid="poll-row-phone-closes">
          {closesText}
          {caption ? ` · ${caption}` : ''}
        </Typography>
      </Box>
      <Box role="cell" sx={desktopOnly} {...DESKTOP_ONLY} data-testid="poll-row-type">
        {typeChip(22)}
      </Box>
      <Box role="cell" sx={desktopOnly} {...DESKTOP_ONLY} data-testid="poll-row-status">
        {statusChip(22)}
      </Box>
      <Box role="cell" sx={desktopOnly} {...DESKTOP_ONLY} data-testid="poll-row-closes">
        <Typography variant="body2" fontWeight={600} component="div" noWrap sx={{ color: soon ? 'warning.dark' : 'text.primary' }}>
          {closesText}
        </Typography>
        {caption && (
          <Typography variant="caption" component="div" sx={{ color: timeColor }}>
            {caption}
          </Typography>
        )}
      </Box>
      <Box role="cell" sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, justifyContent: { xs: 'flex-end', sm: 'flex-start' } }} data-testid="poll-row-answered">
        {row.total === 0 ? (
          <Typography variant="caption" color="text.secondary">
            –
          </Typography>
        ) : (
          <>
            <Box sx={{ ...desktopOnly, flex: 1, height: 6, borderRadius: 3, bgcolor: 'grey.300', overflow: 'hidden' }} {...DESKTOP_ONLY}>
              <Box sx={{ width: `${percent}%`, height: '100%', bgcolor: 'primary.main' }} />
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, whiteSpace: 'nowrap' }}>
              <Box component="span" sx={phoneOnly}>{`${row.answered}/${row.total}`}</Box>
              <Box component="span" sx={desktopOnly} {...DESKTOP_ONLY}>{`${row.answered} of ${row.total}${row.bestSlot ? ' (best slot)' : ''}`}</Box>
            </Typography>
          </>
        )}
      </Box>
      <Box role="cell" aria-hidden sx={{ display: 'flex', justifyContent: 'center', color: 'primary.main' }}>
        <ChevronRightOutlinedIcon fontSize="small" />
      </Box>
    </Box>
  )
}

// docs/specs/090 (A): the list view of the Polls page, built like PlayerTable and MatchTable (docs/specs/088 F): one
// bordered panel with a header row that sticks to the top of the scrolling page and zebra rows; the whole row opens the
// poll's Responses page. The rows are the same PollPanelRow shape the polls panel uses, so the table, the panel and the
// counters always agree. A phone keeps Poll, Answered and the chevron.
export function PollTable({ rows }: PollTableProps) {
  return (
    <Box
      role="table"
      aria-label="Polls"
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
        <Box role="columnheader">Poll</Box>
        <Box role="columnheader" sx={desktopOnly} {...DESKTOP_ONLY}>Type</Box>
        <Box role="columnheader" sx={desktopOnly} {...DESKTOP_ONLY}>Status</Box>
        <Box role="columnheader" sx={desktopOnly} {...DESKTOP_ONLY}>Closes</Box>
        <Box role="columnheader" sx={{ textAlign: { xs: 'right', sm: 'left' } }}>Answered</Box>
        <Box role="columnheader" aria-label="Open" />
      </Box>
      <Box role="rowgroup">
        {rows.map((row) => (
          <PollRow key={row.key} row={row} />
        ))}
      </Box>
    </Box>
  )
}
