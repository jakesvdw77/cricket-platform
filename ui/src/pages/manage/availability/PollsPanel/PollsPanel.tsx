import { Link as RouterLink } from 'react-router-dom'
import { Box, Chip, Link, Skeleton, Typography } from '@mui/material'
import { Countdown } from '../../../../components/Countdown'
import { SidePanel } from '../../../../components/SidePanel'
import { badgeSx } from '../../../../components/RecordCard'
import { closesRowText } from '../pollHelpers'
import { closesWithin48Hours, pollsPanelHeader, sortPollRows } from '../pollPanelRows'
import type { PollPanelRow } from '../pollPanelRows'

export type PollsPanelKind = 'all' | 'closing-soon'

export interface PollsPanelProps {
  open: boolean
  onClose: () => void
  // 'all': the polls the page shows ("Open polls" / "Polls shown"); 'closing-soon': the open ones closing within 48 hours.
  kind: PollsPanelKind
  // The polls the page shows; null until the page has loaded them.
  rows: PollPanelRow[] | null
  showClosed: boolean
  // The "Showing: ..." text of the page (empty = no shared filter set).
  scope: string
  // Only for tests: the clock the 48-hour rule reads.
  now?: number
}

const SKELETON_ROWS = 4

function PollRow({ row }: { row: PollPanelRow }) {
  return (
    <Box component="li" data-testid="polls-panel-row" sx={{ borderBottom: 1, borderColor: 'divider' }}>
      <Link
        component={RouterLink}
        to={row.path}
        underline="none"
        color="inherit"
        sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, minHeight: 44, py: 1, px: 0.5, borderRadius: 1, '&:hover': { bgcolor: 'action.hover' } }}
      >
        <Typography component="span" fontWeight={700} sx={{ overflowWrap: 'anywhere' }}>
          {row.title}
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.75 }}>
          <Chip size="small" label={row.kind === 'GROUP' ? 'Group' : 'Squad'} sx={badgeSx(row.kind === 'GROUP' ? 'groupPoll' : 'squadPoll')} />
          <Chip size="small" label={row.open ? 'Open' : 'Closed'} sx={badgeSx(row.open ? 'open' : 'closed')} />
          {row.open && row.autoClose && row.scheduledCloseAt ? (
            <Countdown target={row.scheduledCloseAt} phrase="left" ariaPrefix="Closes in" />
          ) : (
            <Typography component="span" variant="caption" color="text.secondary">
              {closesRowText(row.open, row.autoClose, row.scheduledCloseAt)}
            </Typography>
          )}
          <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 'auto', whiteSpace: 'nowrap' }}>
            {row.answered} of {row.total} answered
          </Typography>
        </Box>
      </Link>
    </Box>
  )
}

function PanelContent({ kind, rows, showClosed, scope, now }: Omit<PollsPanelProps, 'open' | 'onClose'>) {
  const clock = now ?? Date.now()
  const shown = rows ? sortPollRows(kind === 'closing-soon' ? rows.filter((row) => closesWithin48Hours(row, clock)) : rows) : null
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, minHeight: 0, flex: 1 }}>
      {shown && (
        <Typography variant="body2" fontWeight={600} data-testid="polls-panel-header">
          {pollsPanelHeader(kind, shown, showClosed)}
        </Typography>
      )}
      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }} aria-busy={shown === null}>
        {shown === null && (
          <Box data-testid="polls-panel-loading" sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {Array.from({ length: SKELETON_ROWS }, (_, index) => (
              <Skeleton key={index} variant="rounded" height={56} />
            ))}
          </Box>
        )}
        {shown && shown.length === 0 && (
          <Typography color="text.secondary" sx={{ py: 1 }}>
            No polls to show.
          </Typography>
        )}
        {shown && shown.length > 0 && (
          <Box component="ul" aria-label="Polls" sx={{ listStyle: 'none', m: 0, p: 0 }}>
            {shown.map((row) => (
              <PollRow key={row.key} row={row} />
            ))}
          </Box>
        )}
      </Box>
      {scope && (
        <Typography variant="caption" color="text.secondary" data-testid="polls-panel-scope">
          {`Showing: ${scope}`}
        </Typography>
      )}
    </Box>
  )
}

// docs/specs/085 (G): the panel behind the "Open polls / Polls shown" and "Close in 48 hours" counters - one row per
// poll (title, Group / Squad, Open / Closed, when it closes, "N of M answered"), each a link to that poll's Responses
// page. Built from the polls the Polls page already loads, so it always agrees with the list; the chrome is the
// shared SidePanel (right drawer from sm, bottom sheet below).
export function PollsPanel({ open, onClose, ...content }: PollsPanelProps) {
  const title = content.kind === 'closing-soon' ? 'Closing within 48 hours' : content.showClosed ? 'Polls shown' : 'Open polls'
  return (
    <SidePanel open={open} onClose={onClose} title={title} closeLabel="Close polls list">
      {() => <PanelContent {...content} />}
    </SidePanel>
  )
}
