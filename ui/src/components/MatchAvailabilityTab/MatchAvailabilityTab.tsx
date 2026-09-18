import { Alert, Box, Chip, FormControlLabel, Stack, Switch, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined'
import { Button } from '../Button'
import { EmptyState } from '../EmptyState'
import type { AvailabilityStatus, MatchAvailabilityPollResponses } from '../../api/matchAvailabilityApi'

const STATUS_LABEL: Record<AvailabilityStatus, string> = {
  AVAILABLE: 'Available',
  UNAVAILABLE: 'Unavailable',
  UNSURE: 'Unsure',
}

// 'success'/'error'/'warning' — MUI palette keys, matching this codebase's existing
// RecordCard.tsx tinted-badge convention (alpha(theme.palette.X.main, ~0.12) for the
// background, the full-saturation X.main/X.dark for the text) rather than a plain filled Chip.
const STATUS_COLOR: Record<AvailabilityStatus, 'success' | 'error' | 'warning'> = {
  AVAILABLE: 'success',
  UNAVAILABLE: 'error',
  UNSURE: 'warning',
}

// docs/specs/031-jersey-numbers.md's display convention, reused here for the read-only squad row.
function squadDisplayName(row: { firstName: string; lastName: string; squadJerseyNumber: number | null }): string {
  const name = `${row.firstName} ${row.lastName}`
  return row.squadJerseyNumber != null ? `#${row.squadJerseyNumber} ${name}` : name
}

export interface MatchAvailabilityTabProps {
  // The side's label used in copy, e.g. "the home side" / "the away side" — mirrors MatchSideTab's
  // own `label` prop shape on MatchFormPage.
  label: string
  // null when this side has no poll yet — renders the "Open a poll" prompt instead.
  poll: MatchAvailabilityPollResponses | null
  isLoading?: boolean
  onCreate: () => void
  onOpen: () => void
  onClose: () => void
  onShareInvite: () => void
  isCreatePending?: boolean
  isOpenPending?: boolean
  isClosePending?: boolean
  errorMessage?: string | null
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
  isCreatePending = false,
  isOpenPending = false,
  isClosePending = false,
  errorMessage,
}: MatchAvailabilityTabProps) {
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
          <Button onClick={onCreate} disabled={isCreatePending}>
            {isCreatePending ? 'Opening…' : 'Open a poll for this side'}
          </Button>
        }
      />
    )
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {errorMessage && <Alert severity="error">{errorMessage}</Alert>}

      {!poll.open && (
        <Alert severity="warning">
          This poll is closed — the public page is read-only. Reopen it to accept new responses.
        </Alert>
      )}

      <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap alignItems="center" justifyContent="space-between">
        <FormControlLabel
          control={
            <Switch
              checked={poll.open}
              disabled={isOpenPending || isClosePending}
              onChange={(_event, checked) => (checked ? onOpen() : onClose())}
            />
          }
          label={
            <Typography variant="body2" fontWeight={600} color={poll.open ? 'primary.main' : 'text.secondary'}>
              {isOpenPending ? 'Reopening…' : isClosePending ? 'Closing…' : poll.open ? 'Poll open' : 'Poll closed'}
            </Typography>
          }
        />
        <Button variant="ghost" startIcon={<ShareOutlinedIcon />} onClick={onShareInvite}>
          Share invite
        </Button>
      </Stack>

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
            {row.status ? (
              <Chip
                label={STATUS_LABEL[row.status]}
                size="small"
                sx={{
                  bgcolor: (theme) => alpha(theme.palette[STATUS_COLOR[row.status]].main, 0.12),
                  color: `${STATUS_COLOR[row.status]}.dark`,
                  fontWeight: 600,
                }}
              />
            ) : (
              <Chip label="No response" size="small" variant="outlined" />
            )}
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
