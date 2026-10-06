import { useState, type ReactNode } from 'react'
import {
  Alert,
  Box,
  Button as MuiButton,
  CircularProgress,
  Menu,
  MenuItem,
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
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'
import CheckIcon from '@mui/icons-material/Check'
import PersonAddAltOutlinedIcon from '@mui/icons-material/PersonAddAltOutlined'
import { Button } from '../Button'
import { ConfirmDialog } from '../ConfirmDialog'
import { Input } from '../Input'
import { AvailabilityBadge } from '../TeamSelectionList'
import { errorDetail } from '../../utils/errorDetail'
import { squadDisplayName } from '../../utils/squadDisplayName'
import { formatMatchDateTime } from '../../utils/matchDateTime'
import type { AvailabilityStatus } from '../../api/matchAvailabilityApi'
import type { SelectionPool, SelectionPoolEntry, SelectionRejection } from '../../api/matchSelectionApi'

// What the page's apply call reports back. A refused apply (409) saved nothing and lists a reason
// per refused player; any other failure carries just a message.
export interface SelectionApplyOutcome {
  ok: boolean
  message?: string
  rejections?: SelectionRejection[]
}

export type DialogSource = 'squad' | 'section' | 'previous'

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
  // The switch: the team's squad (or the people who said available), the whole section, or the
  // players of a previous match.
  source: DialogSource
  onSourceChange: (source: DialogSource) => void
  // 'From previous match': that team's earlier matches, the chosen one and the player ids who were in
  // its selection in last match's order (null until a match is chosen and its side has loaded).
  previousMatches: { id: string; label: string }[]
  previousMatchesLoading: boolean
  previousMatchId: string | null
  onPreviousMatchChange: (matchId: string | null) => void
  previousOrder: string[] | null
  previousOrderLoading: boolean
  // The search box text; the page debounces it into the pool's q param.
  search: string
  onSearchChange: (text: string) => void
  // Done: add and remove in one atomic request.
  onApply: (playerProfileIds: string[]) => Promise<SelectionApplyOutcome>
  // Release: remove the player from the other team's selection (keepAnnounced). Rejects on failure.
  onRelease: (entry: SelectionPoolEntry) => Promise<void>
  onAddNewPlayer: () => void
  // Saves a manager correction of the player's answer on the poll covering the match, at once
  // (the page owns the API call and the cache invalidation). Rejects on failure.
  onSetAnswer: (entry: SelectionPoolEntry, status: AvailabilityStatus) => Promise<void>
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

const ANSWER_OPTIONS: { status: AvailabilityStatus; label: string }[] = [
  { status: 'AVAILABLE', label: 'Available' },
  { status: 'UNSURE', label: 'Unsure' },
  { status: 'UNAVAILABLE', label: 'Unavailable' },
]

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
  source,
  onSourceChange,
  previousMatches,
  previousMatchesLoading,
  previousMatchId,
  onPreviousMatchChange,
  previousOrder,
  previousOrderLoading,
  search,
  onSearchChange,
  onApply,
  onRelease,
  onAddNewPlayer,
  onSetAnswer,
  onClose,
}: SelectPlayersDialogProps) {
  const theme = useTheme()
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'))
  const [ticked, setTicked] = useState<Set<string>>(() => new Set(initialSelectedIds))
  const [submitting, setSubmitting] = useState(false)
  const [alertLines, setAlertLines] = useState<string[]>([])
  const [rowMessages, setRowMessages] = useState<Record<string, string>>({})
  const [answerMenu, setAnswerMenu] = useState<{ anchor: HTMLElement; entry: SelectionPoolEntry } | null>(null)
  const [answerPending, setAnswerPending] = useState<Set<string>>(() => new Set())
  const [releasing, setReleasing] = useState<SelectionPoolEntry | null>(null)
  const [releasePending, setReleasePending] = useState(false)
  const [releaseError, setReleaseError] = useState<string | null>(null)

  // In 'From previous match' mode the list is filtered to the players of that match and sorted by its
  // order, so Select all appends them in last match's order. Every other rule is unchanged.
  const allEntries = pool?.entries ?? []
  const entries =
    source === 'previous'
      ? (() => {
          if (!previousOrder) {
            return []
          }
          const rank = new Map(previousOrder.map((id, index) => [id, index]))
          return allEntries
            .filter((entry) => rank.has(entry.playerProfileId))
            .sort((a, b) => (rank.get(a.playerProfileId) as number) - (rank.get(b.playerProfileId) as number))
        })()
      : allEntries
  const full = ticked.size >= maxSelected
  // Ticks survive the switch and the search, so some may not be listed right now; the footer count
  // includes them and says so.
  const listedIds = new Set(entries.map((entry) => entry.playerProfileId))
  const hiddenTicked = pool ? [...ticked].filter((id) => !listedIds.has(id)).length : 0
  const initial = new Set(initialSelectedIds)
  const changed = ticked.size !== initial.size || [...ticked].some((id) => !initial.has(id))
  const groupPoll = pool?.coveringPoll.kind === 'GROUP'
  const covered = Boolean(pool) && pool?.coveringPoll.kind !== 'NONE'
  const canSetAnswer = (entry: SelectionPoolEntry) =>
    covered &&
    (entry.availability === 'UNSURE' || entry.availability === 'NO_RESPONSE' || entry.availability === 'UNAVAILABLE')

  // A player already selected on this side is never blocked (grandfathering): he is always a tickable
  // row (shown ticked, untick to release him), whatever his answer. Only players who are NOT selected
  // are split into selectable and greyed rows.
  const initialSet = new Set(initialSelectedIds)
  const tickable = (entry: SelectionPoolEntry) =>
    entry.selectable || entry.selected || initialSet.has(entry.playerProfileId)
  const available = entries.filter((entry) => tickable(entry) && entry.availability === 'AVAILABLE')
  // Players with no poll answer to ask for (nobody polled them) stay selectable.
  const notPolled = entries.filter((entry) => tickable(entry) && entry.availability === 'NOT_POLLED')
  // Selected but not confirmed available (grandfathered, or answered differently later), ticked, with
  // their badge and Set answer.
  const selectedNotConfirmed = entries.filter(
    (entry) => tickable(entry) && entry.availability !== 'AVAILABLE' && entry.availability !== 'NOT_POLLED',
  )
  // Not selected and Unsure / No response: cannot be selected until the answer is set to Available.
  const needsAnswer = entries.filter((entry) => !tickable(entry) && entry.reason === 'NOT_CONFIRMED')
  const notPossible = entries.filter((entry) => !tickable(entry) && entry.reason !== 'NOT_CONFIRMED')

  // Ticks every Available player who is not ticked yet, up to the limit (the rest stay unticked and the
  // footer shows the team is full).
  const availableUnticked = available.filter((entry) => !ticked.has(entry.playerProfileId))
  const room = Math.max(0, maxSelected - ticked.size)
  const selectAllCount = Math.min(availableUnticked.length, room)
  const selectAllAvailable = () => {
    setTicked((previous) => {
      const next = new Set(previous)
      for (const entry of availableUnticked) {
        if (next.size >= maxSelected) {
          break
        }
        next.add(entry.playerProfileId)
      }
      return next
    })
  }

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

  // Set answer: a manager correction saved at once. The dialog stays open and the ticks are kept,
  // except that a ticked player who has just become unavailable is unticked (he can no longer be
  // selected) and the alert says so.
  const handleSetAnswer = async (entry: SelectionPoolEntry, status: AvailabilityStatus) => {
    const id = entry.playerProfileId
    const name = `${entry.firstName} ${entry.lastName}`
    setAnswerMenu(null)
    setAnswerPending((previous) => new Set(previous).add(id))
    try {
      await onSetAnswer(entry, status)
      if (status === 'UNAVAILABLE' && ticked.has(id)) {
        setTicked((previous) => new Set([...previous].filter((candidate) => candidate !== id)))
        setAlertLines([`${name} is now marked unavailable, so he was unticked.`])
      }
    } catch (error) {
      setAlertLines([`Couldn't save ${name}'s answer. ${errorDetail(error, 'Please try again.')}`])
    } finally {
      setAnswerPending((previous) => {
        const next = new Set(previous)
        next.delete(id)
        return next
      })
    }
  }

  const renderSetAnswer = (entry: SelectionPoolEntry) => {
    if (!canSetAnswer(entry)) {
      return null
    }
    const pending = answerPending.has(entry.playerProfileId)
    return (
      <MuiButton
        size="small"
        color="inherit"
        disabled={pending}
        aria-haspopup="menu"
        aria-label={`Set answer for ${entry.firstName} ${entry.lastName}`}
        onClick={(event) => setAnswerMenu({ anchor: event.currentTarget, entry })}
        endIcon={pending ? <CircularProgress size={12} /> : <ArrowDropDownIcon fontSize="small" />}
        sx={{ color: 'text.secondary', textTransform: 'none', fontSize: 12, minWidth: 0, py: 0, flex: 'none' }}
      >
        Set answer
      </MuiButton>
    )
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
    if (entry.reason === 'NOT_CONFIRMED') {
      return <AvailabilityBadge availability={entry.availability} />
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
        {renderSetAnswer(entry)}
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
      {renderSetAnswer(entry)}
      {(entry.reason === 'AGE_INELIGIBLE' || entry.reason === 'NOT_CONFIRMED' || rowMessages[entry.playerProfileId]) && (
        <Typography variant="caption" color="text.secondary" sx={{ flexBasis: '100%', pl: 5 }}>
          {rowMessages[entry.playerProfileId] ?? entry.reasonText}
        </Typography>
      )}
    </Box>
  )

  const renderGroup = (label: string, rows: SelectionPoolEntry[], blocked: boolean, action?: ReactNode) =>
    rows.length === 0 ? null : (
      <Box key={label} role="group" aria-label={label}>
        <Box sx={{ bgcolor: 'action.hover', px: 1.5, py: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
          <Typography
            component="div"
            sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'text.secondary' }}
          >
            {label}
          </Typography>
          {action}
        </Box>
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

          <Typography variant="caption" color="text.secondary">
            Only players who are available can be selected. To pick someone who hasn't confirmed, set their answer first.
          </Typography>

          {pool?.coveringPoll.kind === 'GROUP' && (
            <Typography variant="caption" color="text.secondary">
              Answers set here apply to the whole slot (all matches in this group poll window).
            </Typography>
          )}

          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            {(
              [
                ['squad', groupPoll ? 'Said available' : `${teamName} squad`],
                ['section', 'Whole section'],
                ['previous', 'From previous match'],
              ] as const
            ).map(([key, label]) => (
              <Chip
                key={key}
                clickable
                label={label}
                color={source === key ? 'primary' : 'default'}
                variant={source === key ? 'filled' : 'outlined'}
                aria-pressed={source === key}
                onClick={() => onSourceChange(key)}
              />
            ))}
          </Stack>

          {source === 'previous' &&
            (!previousMatchesLoading && previousMatches.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No previous matches for this team and season
              </Typography>
            ) : (
              <Input
                select
                label="Previous match"
                value={previousMatchId ?? ''}
                onChange={(event) => onPreviousMatchChange(event.target.value || null)}
                disabled={previousMatchesLoading}
              >
                {previousMatches.map((option) => (
                  <MenuItem key={option.id} value={option.id}>
                    {option.label}
                  </MenuItem>
                ))}
              </Input>
            ))}

          <Box title={selectAllCount === 0 ? 'No available players to select' : undefined} sx={{ alignSelf: 'flex-start' }}>
            <Button
              variant="secondary"
              size="sm"
              disabled={selectAllCount === 0}
              onClick={selectAllAvailable}
              aria-label={`Select all available players not yet selected (${selectAllCount})`}
            >
              {`Select all available (${selectAllCount})`}
            </Button>
          </Box>

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
          ) : source === 'previous' && !previousOrder ? (
            <Typography variant="body2" color="text.secondary">
              {previousMatchId && previousOrderLoading
                ? 'Loading the match…'
                : 'Choose a match to show the players who played in it.'}
            </Typography>
          ) : entries.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No players match.
            </Typography>
          ) : (
            <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
              {renderGroup('Available', available, false)}
              {renderGroup('Not polled', notPolled, false)}
              {renderGroup('Selected, not confirmed', selectedNotConfirmed, false)}
              {renderGroup('Needs an answer', needsAnswer, true)}
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

      <Menu anchorEl={answerMenu?.anchor ?? null} open={Boolean(answerMenu)} onClose={() => setAnswerMenu(null)}>
        {ANSWER_OPTIONS.map((option) => {
          const current = answerMenu?.entry.availability === option.status
          return (
            <MenuItem
              key={option.status}
              disabled={current}
              onClick={() => answerMenu && handleSetAnswer(answerMenu.entry, option.status)}
              sx={{ gap: 1 }}
            >
              {option.label}
              {current && <CheckIcon fontSize="small" />}
            </MenuItem>
          )
        })}
      </Menu>

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
