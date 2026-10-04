import { useState } from 'react'
import {
  Alert,
  Box,
  Button as MuiButton,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  Typography,
  useMediaQuery,
} from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import PersonAddAltOutlinedIcon from '@mui/icons-material/PersonAddAltOutlined'
import { Button } from '../Button'
import { ConfirmDialog } from '../ConfirmDialog'
import { Input } from '../Input'
import { AvailabilityBadge } from '../TeamSelectionList'
import { squadDisplayName } from '../../utils/squadDisplayName'
import { formatMatchDateTime } from '../../utils/matchDateTime'
import type { SelectionPool, SelectionPoolEntry, SelectionRejection } from '../../api/matchSelectionApi'

// What the page's apply call reports back. A refused apply (409) saved nothing and lists a reason
// per refused player; any other failure carries just a message.
export interface SelectionApplyOutcome {
  ok: boolean
  message?: string
  rejections?: SelectionRejection[]
}

export interface SelectPlayersDialogProps {
  teamName: string
  // The match's kickoff, already formatted by the page (e.g. "Sat, 3 Oct, 10:00").
  kickoffLabel: string
  maxSelected: number
  // The players currently selected on the side; the ticked set starts here.
  initialSelectedIds: string[]
  pool: SelectionPool | undefined
  poolLoading: boolean
  poolError: boolean
  wholeSection: boolean
  onWholeSectionChange: (wholeSection: boolean) => void
  // The search box text; the page debounces it into the pool's q param.
  search: string
  onSearchChange: (text: string) => void
  // Done: add and remove in one atomic request.
  onApply: (playerProfileIds: string[]) => Promise<SelectionApplyOutcome>
  // Release: remove the player from the other team's selection (keepAnnounced). Rejects on failure.
  onRelease: (entry: SelectionPoolEntry) => Promise<void>
  onAddNewPlayer: () => void
  onClose: () => void
}

function entryName(entry: SelectionPoolEntry): string {
  return squadDisplayName({
    firstName: entry.firstName,
    lastName: entry.lastName,
    squadJerseyNumber: entry.jerseyNumber,
  })
}

function infoChipSx(theme: Theme) {
  return {
    color: 'info.dark',
    borderColor: 'info.main',
    bgcolor: alpha(theme.palette.info.main, 0.12),
    fontWeight: 600,
  }
}

// The Responses page of the poll covering the match, opened in a new tab so the ticks survive.
function changeAnswerHref(pool: SelectionPool | undefined): string | null {
  const poll = pool?.coveringPoll
  if (!poll) {
    return null
  }
  if (poll.kind === 'GROUP' && poll.roundId) {
    return `/manage/availability/group/${poll.roundId}`
  }
  if (poll.kind === 'SQUAD' && poll.matchId && poll.pollId) {
    return `/manage/availability/squad/${poll.matchId}/${poll.pollId}`
  }
  return null
}

// docs/specs/076-team-selection.md section 3: the one dialog that chooses who plays. Presentational
// plus its own ticked state: the page owns the pool query (switch and search are controlled), the
// apply call and the release call. Full screen on a phone with the footer pinned.
export function SelectPlayersDialog({
  teamName,
  kickoffLabel,
  maxSelected,
  initialSelectedIds,
  pool,
  poolLoading,
  poolError,
  wholeSection,
  onWholeSectionChange,
  search,
  onSearchChange,
  onApply,
  onRelease,
  onAddNewPlayer,
  onClose,
}: SelectPlayersDialogProps) {
  const theme = useTheme()
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'))
  const [ticked, setTicked] = useState<Set<string>>(() => new Set(initialSelectedIds))
  const [submitting, setSubmitting] = useState(false)
  const [alertLines, setAlertLines] = useState<string[]>([])
  const [rowMessages, setRowMessages] = useState<Record<string, string>>({})
  const [releasing, setReleasing] = useState<SelectionPoolEntry | null>(null)
  const [releasePending, setReleasePending] = useState(false)
  const [releaseError, setReleaseError] = useState<string | null>(null)

  const entries = pool?.entries ?? []
  const full = ticked.size >= maxSelected
  // Ticks survive the switch and the search, so some may not be listed right now; the footer count
  // includes them and says so.
  const listedIds = new Set(entries.map((entry) => entry.playerProfileId))
  const hiddenTicked = pool ? [...ticked].filter((id) => !listedIds.has(id)).length : 0
  const initial = new Set(initialSelectedIds)
  const changed = ticked.size !== initial.size || [...ticked].some((id) => !initial.has(id))
  const groupPoll = pool?.coveringPoll.kind === 'GROUP'
  const answerHref = changeAnswerHref(pool)

  const available = entries.filter((entry) => entry.selectable && entry.availability === 'AVAILABLE')
  const notConfirmed = entries.filter((entry) => entry.selectable && entry.availability !== 'AVAILABLE')
  const notPossible = entries.filter((entry) => !entry.selectable)

  const toggle = (id: string) => {
    setTicked((previous) => {
      const next = new Set(previous)
      if (next.has(id)) {
        next.delete(id)
      } else if (next.size < maxSelected) {
        next.add(id)
      }
      return next
    })
    setRowMessages((previous) => {
      if (!(id in previous)) {
        return previous
      }
      const next = { ...previous }
      delete next[id]
      return next
    })
  }

  const handleDone = async () => {
    setSubmitting(true)
    setAlertLines([])
    const outcome = await onApply([...ticked])
    setSubmitting(false)
    if (outcome.ok) {
      return
    }
    const rejections = outcome.rejections ?? []
    if (rejections.length === 0) {
      setAlertLines([outcome.message ?? "Couldn't save the selection. Please try again."])
      return
    }
    const messages: Record<string, string> = {}
    const lines = ["Some players can't be selected"]
    const rejectedIds = new Set<string>()
    const visibleIds = new Set(entries.map((entry) => entry.playerProfileId))
    rejections.forEach((rejection) => {
      if (rejection.playerProfileId) {
        messages[rejection.playerProfileId] = rejection.message
        rejectedIds.add(rejection.playerProfileId)
        // A ticked player the current switch or search does not list has no row to show his
        // message on, so it goes in the alert with his name.
        if (!visibleIds.has(rejection.playerProfileId)) {
          lines.push(`${rejection.playerName ?? 'A player'}: ${rejection.message}`)
        }
      } else {
        lines.push(rejection.message)
      }
    })
    setRowMessages(messages)
    setAlertLines(lines)
    setTicked((previous) => new Set([...previous].filter((id) => !rejectedIds.has(id))))
  }

  const confirmRelease = async () => {
    if (!releasing) {
      return
    }
    setReleasePending(true)
    setReleaseError(null)
    try {
      await onRelease(releasing)
      setReleasing(null)
    } catch {
      setReleaseError("Couldn't release this player. Please try again.")
    } finally {
      setReleasePending(false)
    }
  }

  const renderBlockedAction = (entry: SelectionPoolEntry) => {
    if (entry.reason === 'TAKEN_FOR_SLOT' && entry.taken) {
      return entry.taken.canRelease ? (
        <MuiButton
          variant="outlined"
          size="small"
          color="error"
          onClick={() => {
            setReleaseError(null)
            setReleasing(entry)
          }}
          sx={{ flex: 'none' }}
        >
          {`Release from ${entry.taken.teamName}`}
        </MuiButton>
      ) : (
        <Typography variant="caption" color="text.secondary">
          Ask that team's manager to release this player
        </Typography>
      )
    }
    if (entry.reason === 'SAID_UNAVAILABLE' && answerHref) {
      return (
        <MuiButton
          variant="outlined"
          size="small"
          component="a"
          href={answerHref}
          target="_blank"
          rel="noopener noreferrer"
          sx={{ flex: 'none' }}
        >
          Change answer
        </MuiButton>
      )
    }
    return null
  }

  const renderBlockedBadge = (entry: SelectionPoolEntry) => {
    if (entry.reason === 'TAKEN_FOR_SLOT' && entry.taken) {
      return (
        <Chip
          size="small"
          variant="outlined"
          label={`In ${entry.taken.teamName} · ${formatMatchDateTime(entry.taken.matchDate)}`}
          sx={infoChipSx(theme)}
        />
      )
    }
    if (entry.reason === 'SAID_UNAVAILABLE') {
      return <AvailabilityBadge availability="UNAVAILABLE" />
    }
    return null
  }

  const renderSelectableRow = (entry: SelectionPoolEntry) => {
    const isTicked = ticked.has(entry.playerProfileId)
    const disabled = !isTicked && full
    const message = rowMessages[entry.playerProfileId]
    return (
      <Box
        key={entry.playerProfileId}
        data-testid={`pool-row-${entry.playerProfileId}`}
        sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 1, rowGap: 0.25, px: 1.5, py: 0.25, borderBottom: 1, borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}
      >
        <FormControlLabel
          sx={{ flex: '1 1 140px', minWidth: 0, mr: 0 }}
          control={<Checkbox checked={isTicked} disabled={disabled} onChange={() => toggle(entry.playerProfileId)} />}
          label={
            <Typography variant="body2" fontWeight={600} sx={{ overflowWrap: 'anywhere' }}>
              {entryName(entry)}
            </Typography>
          }
        />
        <AvailabilityBadge availability={entry.availability} />
        {entry.taken && entry.selected && (
          <Chip size="small" variant="outlined" label={`Also in ${entry.taken.teamName}`} sx={infoChipSx(theme)} />
        )}
        {disabled && (
          <Typography variant="caption" color="text.secondary">
            Team is full
          </Typography>
        )}
        {message && (
          <Typography variant="caption" color="error.main" sx={{ flexBasis: '100%', pl: 4.5 }}>
            {message}
          </Typography>
        )}
      </Box>
    )
  }

  const renderBlockedRow = (entry: SelectionPoolEntry) => (
    <Box
      key={entry.playerProfileId}
      data-testid={`pool-row-${entry.playerProfileId}`}
      sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 1, rowGap: 0.5, px: 1.5, py: 1, borderBottom: 1, borderColor: 'divider', bgcolor: 'action.hover', '&:last-of-type': { borderBottom: 0 } }}
    >
      <Checkbox disabled checked={false} inputProps={{ 'aria-label': `${entryName(entry)} cannot be selected` }} />
      <Typography variant="body2" fontWeight={600} sx={{ flex: '1 1 120px', minWidth: 0, overflowWrap: 'anywhere', opacity: 0.6 }}>
        {entryName(entry)}
      </Typography>
      {renderBlockedBadge(entry)}
      {renderBlockedAction(entry)}
      {(entry.reason === 'AGE_INELIGIBLE' || rowMessages[entry.playerProfileId]) && (
        <Typography variant="caption" color="text.secondary" sx={{ flexBasis: '100%', pl: 5 }}>
          {rowMessages[entry.playerProfileId] ?? entry.reasonText}
        </Typography>
      )}
    </Box>
  )

  const renderGroup = (label: string, rows: SelectionPoolEntry[], blocked: boolean) =>
    rows.length === 0 ? null : (
      <Box key={label} role="group" aria-label={label}>
        <Typography
          component="div"
          sx={{ bgcolor: 'action.hover', px: 1.5, py: 0.5, fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'text.secondary' }}
        >
          {label}
        </Typography>
        {rows.map((entry) => (blocked ? renderBlockedRow(entry) : renderSelectableRow(entry)))}
      </Box>
    )

  return (
    <>
      <Dialog open onClose={submitting ? undefined : onClose} fullScreen={fullScreen} fullWidth maxWidth="sm" scroll="paper">
        <DialogTitle sx={{ pb: 0.5 }}>{`Select players · ${teamName}`}</DialogTitle>
        {/* flexShrink: 0 on every child: in a column flex container the children shrink by default, and the
            list box clips (overflow hidden), so a long pool was cut off instead of the body scrolling. */}
        <DialogContent
          dividers
          sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, px: { xs: 1.5, sm: 3 }, '& > *': { flexShrink: 0 } }}
        >
          <Typography variant="body2" color="text.secondary">
            {`${kickoffLabel} · tick up to ${maxSelected}. Unticking removes a player from the team.`}
          </Typography>

          {alertLines.length > 0 && (
            <Alert severity="error">
              {alertLines.map((line) => (
                <Typography key={line} variant="body2" fontWeight={line === alertLines[0] ? 700 : 400}>
                  {line}
                </Typography>
              ))}
            </Alert>
          )}

          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Chip
              clickable
              label={groupPoll ? 'Said available' : `${teamName} squad`}
              color={wholeSection ? 'default' : 'primary'}
              variant={wholeSection ? 'outlined' : 'filled'}
              aria-pressed={!wholeSection}
              onClick={() => onWholeSectionChange(false)}
            />
            <Chip
              clickable
              label="Whole section"
              color={wholeSection ? 'primary' : 'default'}
              variant={wholeSection ? 'filled' : 'outlined'}
              aria-pressed={wholeSection}
              onClick={() => onWholeSectionChange(true)}
            />
          </Stack>

          <Input
            label="Search players"
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
          />
          {pool?.truncated && (
            <Typography variant="caption" color="text.secondary">
              Showing the first 500. Refine your search.
            </Typography>
          )}

          {poolError ? (
            <Alert severity="error">Couldn't load the players. Please try again.</Alert>
          ) : poolLoading && !pool ? (
            <Typography variant="body2" color="text.secondary">
              Loading players…
            </Typography>
          ) : entries.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No players match.
            </Typography>
          ) : (
            <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
              {renderGroup('Available', available, false)}
              {renderGroup('Not confirmed', notConfirmed, false)}
              {renderGroup('Not possible', notPossible, true)}
            </Box>
          )}

          <Box>
            <Button variant="ghost" size="sm" startIcon={<PersonAddAltOutlinedIcon fontSize="small" />} onClick={onAddNewPlayer}>
              Add new player
            </Button>
          </Box>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'space-between', px: { xs: 1.5, sm: 3 }, flexWrap: 'wrap', gap: 1 }}>
          <Typography variant="body2" color="text.secondary" component="div" aria-live="polite">
            <b>{`${ticked.size} of ${maxSelected}`}</b>
            {' selected'}
            {full && ' · Team is full'}
            {hiddenTicked > 0 &&
              ` · ${hiddenTicked} selected ${hiddenTicked === 1 ? 'player is' : 'players are'} not shown by the current search`}
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button variant="ghost" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleDone} disabled={!changed || submitting}>
              {submitting ? 'Saving…' : 'Done'}
            </Button>
          </Stack>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={releasing !== null}
        title={releasing?.taken ? `Release ${releasing.firstName} ${releasing.lastName} from ${releasing.taken.teamName}?` : 'Release player?'}
        description={
          releasing?.taken ? (
            <>
              <Typography variant="body2" component="p">
                <b>{`Removes ${releasing.firstName} from ${releasing.taken.teamName}'s selection`}</b>
                {` for ${formatMatchDateTime(releasing.taken.matchDate)}.`}
              </Typography>
              {releasing.taken.announced && (
                <Typography variant="body2" component="p" sx={{ mt: 1 }}>
                  <b>{`${releasing.taken.teamName}'s team is announced. This changes a published team.`}</b>
                </Typography>
              )}
              {releaseError && (
                <Typography variant="body2" color="error.main" component="p" sx={{ mt: 1 }}>
                  {releaseError}
                </Typography>
              )}
            </>
          ) : null
        }
        confirmLabel="Release"
        pendingLabel="Releasing…"
        destructive
        pending={releasePending}
        onConfirm={confirmRelease}
        onClose={() => setReleasing(null)}
      />
    </>
  )
}
