import type { ReactNode } from 'react'
import { Box, Chip, Link as MuiLink, Typography } from '@mui/material'
import { lighten } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import { Link as RouterLink, useLocation } from 'react-router-dom'
import { badgeSx } from '../../../components/RecordCard'
import { useCountdown } from '../../../components/Countdown'
import { ProgressMeter } from '../../../components/ProgressMeter'
import { ToolbarCard } from '../../../components/ToolbarCard'
import { currentOrigin, withReturnTo } from '../../../utils/returnTo'
import { zebraTint } from '../../../utils/zebraTint'
import { closesRowText } from './pollHelpers'
import type { PollPanelRow } from './pollPanelRows'

export interface PollTableProps {
  rows: PollPanelRow[]
  // docs/specs/136 and page-anatomy section 3: the page's filter bar. Given, the table renders ONE card: this toolbar, a hairline, then
  // the header and rows. Omitted, the table is its own flat card.
  toolbar?: ReactNode
  // With a toolbar and no rows: this message replaces the table inside the same card, so the toolbar never remounts.
  empty?: ReactNode
  // The row's actions button (PollRowMenu), rendered in the last cell; it never navigates the row.
  renderActions?: (row: PollPanelRow) => ReactNode
}

// Desktop: Poll, Type, Status, Closes, Answered, actions. A phone keeps Poll (the chips and the closing time under the
// title), Answered and the actions button. No chevron: the whole row is the link.
const COLUMNS = {
  xs: 'minmax(0, 1fr) 54px 44px',
  sm: 'minmax(220px, 2fr) 84px 84px minmax(150px, 1.2fr) minmax(170px, 1.2fr) 44px',
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

// clip, not hidden: it rounds the corners without becoming a scroll container, so the sticky header still sticks
const cardSx = { border: 1, borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper', boxShadow: 0, overflow: 'clip' } as const

const hoverTint = (theme: Theme) => lighten(theme.palette.primary.main, 0.86)

function PollRow({ row, actions }: { row: PollPanelRow; actions?: ReactNode }) {
  const location = useLocation()
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
  // docs/specs/127: the row opens the poll's page and returns to the list it is on.
  const rowPath = withReturnTo(row.path, currentOrigin(location), 'Availability')

  return (
    <Box
      role="row"
      data-testid="poll-row"
      data-tone={soon ? 'warning' : 'neutral'}
      sx={{
        ...gridSx,
        position: 'relative',
        minHeight: { xs: 64, sm: 56 },
        '&:nth-of-type(even)': { bgcolor: zebraTint },
        '&:hover': { bgcolor: hoverTint },
        '&:focus-within': { outline: (theme: Theme) => `2px solid ${theme.palette.primary.main}`, outlineOffset: -2 },
      }}
    >
      <Box role="cell" sx={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
        <Typography variant="body2" fontWeight={600} noWrap component="div">
          {/* Stretched link over the whole row (docs/specs/059): the row is position: relative. */}
          <MuiLink component={RouterLink} to={rowPath} color="inherit" underline="none" sx={{ '&::after': { content: '""', position: 'absolute', inset: 0 } }}>
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
            <Typography variant="caption" color="text.secondary" sx={{ ...phoneOnly, fontVariantNumeric: 'tabular-nums', fontWeight: 600, whiteSpace: 'nowrap' }}>
              {`${row.answered}/${row.total}`}
            </Typography>
            <Box sx={{ ...desktopOnly, flex: 1, minWidth: 0 }} {...DESKTOP_ONLY}>
              <ProgressMeter
                value={row.answered}
                max={row.total}
                label={`${row.answered} of ${row.total}${row.bestSlot ? ' (best slot)' : ''}`}
                ariaLabel={`${row.title} answered`}
                testId="poll-row-meter"
              />
            </Box>
          </>
        )}
      </Box>
      <Box role="cell" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', color: 'primary.main' }}>
        {actions}
      </Box>
    </Box>
  )
}

// docs/specs/090 (A), revamped by docs/specs/136: the list view of the Polls page, built like MatchTable and SeasonTable: one flat
// card with a tinted header row that sticks to the top of the scrolling page and zebra rows (the first white, the second tinted);
// the whole row opens the poll's Responses page and the last cell is the row's kebab. The rows are the same PollPanelRow shape the
// polls panel uses, so the table, the panel and the counters always agree. A phone keeps Poll, Answered and the kebab.
export function PollTable({ rows, toolbar, empty, renderActions }: PollTableProps) {
  const table = (
    <Box role="table" aria-label="Polls" sx={toolbar ? undefined : cardSx}>
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
        <Box role="columnheader">Poll</Box>
        <Box role="columnheader" sx={desktopOnly} {...DESKTOP_ONLY}>Type</Box>
        <Box role="columnheader" sx={desktopOnly} {...DESKTOP_ONLY}>Status</Box>
        <Box role="columnheader" sx={desktopOnly} {...DESKTOP_ONLY}>Closes</Box>
        <Box role="columnheader" sx={{ textAlign: { xs: 'right', sm: 'left' } }}>Answered</Box>
        <Box role="columnheader" aria-label="Actions" />
      </Box>
      <Box role="rowgroup">
        {rows.map((row) => (
          <PollRow key={row.key} row={row} actions={renderActions?.(row)} />
        ))}
      </Box>
    </Box>
  )
  if (toolbar) {
    return (
      <Box data-testid="polls-fused-card" sx={cardSx}>
        <ToolbarCard fused>{toolbar}</ToolbarCard>
        {rows.length === 0 && empty ? empty : table}
      </Box>
    )
  }
  return table
}
