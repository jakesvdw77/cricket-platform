import { useState } from 'react'
import type { ReactNode } from 'react'
import { Alert, Box, Chip, FormControlLabel, Menu, MenuItem, Stack, Switch, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined'
import { Button } from '../Button'
import { ConfirmDialog } from '../ConfirmDialog'
import { EmptyState } from '../EmptyState'
import type { AvailabilityStatus, MatchAvailabilityPollResponses } from '../../api/matchAvailabilityApi'
import { STATUS_LABEL, statusTintSx } from '../../utils/availabilityStatus'
import { closePollDescription, closePollTitle } from '../../utils/pollClose'
import { squadDisplayName } from '../../utils/squadDisplayName'

const STATUS_OPTIONS: AvailabilityStatus[] = ['AVAILABLE', 'UNAVAILABLE', 'UNSURE']

export interface MatchAvailabilityTabProps {
  // The side's label used in copy, e.g. "the home side" / "the away side" — mirrors MatchSideTab's
  // own `label` prop shape on MatchFormPage.
  label: string
  // null when this side has no poll yet — renders the "Open a poll" prompt instead.
  poll: MatchAvailabilityPollResponses | null
  isLoading?: boolean
  // docs/specs/064-unified-availability-polls.md: receives the Autoclose switch's value (default
  // on) - the caller forwards it as createPoll's autoClose.
  onCreate: (autoClose: boolean) => void
  onOpen: () => void
  onClose: () => void
  onShareInvite: () => void
  // Admin override, added after live review found no way to record a response relayed outside
  // the poll link (e.g. a phone call) — clicking a squad member's own status Chip opens a menu to
  // set it directly. Since docs/specs/066 it also works on a closed poll (a manager correction).
  onSetPlayerStatus: (playerProfileId: string, status: AvailabilityStatus) => void
  // docs/specs/064-unified-availability-polls.md: an extra action rendered beside 'Open squad poll'
  // in the no-poll prompt (MatchFormPage passes the 'Open group poll' link) - nothing else here
  // knows about group polls.
  secondaryEmptyAction?: ReactNode
  isCreatePending?: boolean
  isOpenPending?: boolean
  isClosePending?: boolean
  // playerProfileId of the row currently being saved, if any — shows a pending state on just
  // that one row rather than blocking the whole list.
  settingPlayerId?: string | null
  errorMessage?: string | null
  // docs/specs/064: whether this (closed) poll's own Autoclose is on - only changes the wording of
  // the 'Close this poll?' confirmation. Defaults off.
  autoClose?: boolean
  // docs/specs/066: the closed poll's 'Reopen…' button - the caller opens the Edit close time
  // dialog in reopen mode (components/** can't import it from pages/**). Falls back to onOpen.
  onReopen?: () => void
}

// docs/specs/032-match-availability-polls.md's genuinely new admin-facing visual pattern — a
// read-only response-count summary plus per-player status list for one side's availability poll.
// Presentational only: every mutation is a callback into the caller (MatchFormPage's
// MatchAvailabilityPanel wrapper), which owns the real React Query calls, per
// docs/standards/frontend.md's "server state in the page, not the component" convention.
export function MatchAvailabilityTab({
  label,
  poll,
  isLoading = false,
  onCreate,
  onOpen,
  onClose,
  onShareInvite,
  onSetPlayerStatus,
  secondaryEmptyAction,
  isCreatePending = false,
  isOpenPending = false,
  isClosePending = false,
  settingPlayerId = null,
  errorMessage,
  autoClose: pollAutoClose = false,
  onReopen,
}: MatchAvailabilityTabProps) {
  const [autoClose, setAutoClose] = useState(true)
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false)

  if (isLoading) {
    return (
      <Typography variant="body2" color="text.secondary">
        Loading availability…
      </Typography>
    )
  }

  if (!poll) {
    return (
      <EmptyState
        title="No availability poll yet"
        description={`Open a poll for ${label} so squad members can say whether they're available.`}
        action={
          <Stack spacing={1} alignItems="center">
            <FormControlLabel
              control={<Switch checked={autoClose} onChange={(event) => setAutoClose(event.target.checked)} />}
              label="Autoclose"
            />
            <Typography variant="caption" color="text.secondary">
              {autoClose
                ? 'The poll closes by itself 24 hours before the match.'
                : 'Switched off - close the poll manually.'}
            </Typography>
            <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap justifyContent="center">
              <Button onClick={() => onCreate(autoClose)} disabled={isCreatePending}>
                {isCreatePending ? 'Opening…' : 'Open squad poll'}
              </Button>
              {secondaryEmptyAction}
            </Stack>
          </Stack>
        }
      />
    )
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {errorMessage && <Alert severity="error">{errorMessage}</Alert>}

      {!poll.open && (
        <Alert severity="warning">
          This poll is closed. Changes are recorded as a manager correction; the public page stays read-only until you reopen it.
        </Alert>
      )}

      <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap alignItems="center" justifyContent="space-between">
        {poll.open ? (
          <FormControlLabel
            control={
              <Switch
                checked
                disabled={isClosePending}
                onChange={() => setCloseConfirmOpen(true)}
              />
            }
            label={
              <Typography variant="body2" fontWeight={600} color="primary.main">
                {isClosePending ? 'Closing…' : 'Poll open'}
              </Typography>
            }
          />
        ) : (
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Typography variant="body2" fontWeight={600} color="text.secondary">
              Poll closed
            </Typography>
            <Button variant="secondary" size="sm" disabled={isOpenPending} onClick={onReopen ?? onOpen}>
              {isOpenPending ? 'Reopening…' : 'Reopen…'}
            </Button>
          </Stack>
        )}
        <Button variant="ghost" startIcon={<ShareOutlinedIcon />} onClick={onShareInvite}>
          Share invite
        </Button>
      </Stack>

      <ConfirmDialog
        open={closeConfirmOpen}
        title={closePollTitle()}
        description={closePollDescription(pollAutoClose)}
        confirmLabel="Close poll"
        pendingLabel="Closing…"
        pending={isClosePending}
        onConfirm={() => {
          setCloseConfirmOpen(false)
          onClose()
        }}
        onClose={() => setCloseConfirmOpen(false)}
      />

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' },
          gap: 1.5,
        }}
      >
        <SummaryTile label="Available" count={poll.availableCount} tone="success" />
        <SummaryTile label="Unavailable" count={poll.unavailableCount} tone="error" />
        <SummaryTile label="Unsure" count={poll.unsureCount} tone="warning" />
        <SummaryTile label="No response" count={poll.noResponseCount} tone={null} />
      </Box>

      <Stack spacing={1}>
        <Typography variant="subtitle2" fontWeight={600}>
          Squad responses
        </Typography>

        {poll.responses.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            No squad members to poll yet — add players to this team's squad first.
          </Typography>
        )}

        {poll.responses.map((row) => (
          <Stack
            key={row.playerProfileId}
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            spacing={1.5}
            sx={{ p: 1.5, border: 1, borderColor: 'divider', borderRadius: 1 }}
          >
            <Typography variant="body2" fontWeight={600} noWrap>
              {squadDisplayName(row)}
            </Typography>
            <StatusMenuChip
              status={row.status}
              pending={settingPlayerId === row.playerProfileId}
              playerName={squadDisplayName(row)}
              onSelect={(status) => onSetPlayerStatus(row.playerProfileId, status)}
            />
          </Stack>
        ))}
      </Stack>
    </Box>
  )
}

// tone === null renders the neutral "No response" tile (docs/standards/design-system.md's
// surface-alt background, no tint) — the other three get a tinted background per status,
// matching RecordCard.tsx's established alpha(theme.palette.X.main, 0.12) badge convention.
function SummaryTile({
  label,
  count,
  tone,
}: {
  label: string
  count: number
  tone: 'success' | 'error' | 'warning' | null
}) {
  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: 1,
        textAlign: 'center',
        bgcolor: tone ? (theme) => alpha(theme.palette[tone].main, 0.12) : 'action.hover',
      }}
    >
      <Typography
        variant="h6"
        fontWeight={700}
        sx={{ fontVariantNumeric: 'tabular-nums', color: tone ? `${tone}.dark` : 'text.secondary' }}
      >
        {count}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
    </Box>
  )
}

// The admin-override entry point: a squad member's status Chip doubles as a menu trigger.
// Enabled on a closed poll too since docs/specs/066 (a manager correction).
function StatusMenuChip({
  status,
  pending,
  playerName,
  onSelect,
}: {
  status: AvailabilityStatus | null
  pending: boolean
  playerName: string
  onSelect: (status: AvailabilityStatus) => void
}) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)

  const chipProps = status
    ? {
        label: STATUS_LABEL[status],
        sx: statusTintSx(status),
      }
    : { label: 'No response', variant: 'outlined' as const }

  return (
    <>
      <Chip
        {...chipProps}
        size="small"
        disabled={pending}
        onClick={(event) => setAnchorEl(event.currentTarget)}
        aria-label={`Set ${playerName}'s availability`}
      />
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        {STATUS_OPTIONS.map((option) => (
          <MenuItem
            key={option}
            selected={option === status}
            onClick={() => {
              setAnchorEl(null)
              onSelect(option)
            }}
          >
            {STATUS_LABEL[option]}
          </MenuItem>
        ))}
      </Menu>
    </>
  )
}
