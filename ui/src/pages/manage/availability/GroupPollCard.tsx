import { useState } from 'react'
import { Box, Chip, Collapse, Menu, MenuItem, Stack, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import { isAxiosError } from 'axios'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import LockOpenOutlinedIcon from '@mui/icons-material/LockOpenOutlined'
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined'
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined'
import EventNoteOutlinedIcon from '@mui/icons-material/EventNoteOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import { RecordCard } from '../../../components/RecordCard'
import type { RecordCardField } from '../../../components/RecordCard'
import { Input } from '../../../components/Input'
import { Button } from '../../../components/Button'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { SectionAvailabilityShareDialog } from '../../../components/SectionAvailabilityShareDialog'
import {
  openRound,
  closeRound,
  deleteRound,
  getRoundMatches,
  getRoundResponses,
  setRoundPlayerStatus,
  updateRoundDescription,
} from '../../../api/sectionAvailabilityApi'
import type { SectionAvailabilityRound, SectionAvailabilityRoundResponseRow } from '../../../api/sectionAvailabilityApi'
import type { AvailabilityStatus } from '../../../api/matchAvailabilityApi'
import { errorDetail } from '../../../utils/errorDetail'
import { formatBracketLabel } from '../../../utils/dayPart'
import { STATUS_COLOR, STATUS_LABEL } from '../../../utils/availabilityStatus'
import { CANNOT_REOPEN_MESSAGE, closePollDescription, closePollTitle } from '../../../utils/pollClose'
import { canReopen, closesValue } from './pollHelpers'

const STATUS_OPTIONS: AvailabilityStatus[] = ['AVAILABLE', 'UNAVAILABLE', 'UNSURE']

// However many brackets this round actually owns, one to several - no longer a fixed
// Morning/Afternoon pair (docs/specs/063's fixture-group-selection revision).
function roundFields(round: SectionAvailabilityRound): RecordCardField[] {
  const totalMatches = round.brackets.reduce((sum, bracket) => sum + bracket.coveredMatchCount, 0)
  return [
    ...round.brackets.map((bracket) => ({
      label: formatBracketLabel(bracket.windowDate, bracket.dayPart),
      value: `${bracket.availableCount} yes / ${bracket.unavailableCount} no / ${bracket.unsureCount} unsure`,
    })),
    { label: 'Matches covered', value: totalMatches },
    { label: 'Closes', value: closesValue(round.autoClose, round.scheduledCloseAt) },
  ]
}

function playerDisplayName(row: SectionAvailabilityRoundResponseRow): string {
  const name = `${row.firstName} ${row.lastName}`
  return row.jerseyNumber != null ? `#${row.jerseyNumber} ${name}` : name
}

// The admin-override entry point - mirrors MatchAvailabilityTab.tsx's own StatusMenuChip exactly
// (a squad member's status Chip doubles as a menu trigger), just resolved per bracket (identified
// by its own windowId, since a round can now own several windows sharing the same dayPart across
// different dates) instead of per match/side. Disabled while the round is closed, matching the
// backend's own rule (round open/close cascades to every underlying window in lockstep).
function BracketStatusChip({
  windowId,
  dayPart,
  windowDate,
  status,
  disabled,
  pending,
  playerName,
  onSelect,
}: {
  windowId: string
  dayPart: 'MORNING' | 'AFTERNOON'
  windowDate: string
  status: AvailabilityStatus | null
  disabled: boolean
  pending: boolean
  playerName: string
  onSelect: (windowId: string, status: AvailabilityStatus) => void
}) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
  const label = formatBracketLabel(windowDate, dayPart)

  const chipProps = status
    ? {
        label: `${label}: ${STATUS_LABEL[status]}`,
        sx: {
          bgcolor: (theme: Theme) => alpha(theme.palette[STATUS_COLOR[status]].main, 0.12),
          color: `${STATUS_COLOR[status]}.dark`,
          fontWeight: 600,
        },
      }
    : { label: `${label}: No response`, variant: 'outlined' as const }

  return (
    <>
      <Chip
        {...chipProps}
        size="small"
        disabled={disabled || pending}
        onClick={(event) => setAnchorEl(event.currentTarget)}
        aria-label={`Set ${playerName}'s ${label.toLowerCase()} availability`}
      />
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        {STATUS_OPTIONS.map((option) => (
          <MenuItem
            key={option}
            selected={option === status}
            onClick={() => {
              setAnchorEl(null)
              onSelect(windowId, option)
            }}
          >
            {STATUS_LABEL[option]}
          </MenuItem>
        ))}
      </Menu>
    </>
  )
}

// Moved from the deleted SectionAvailabilityRounds.tsx's RoundCard (docs/specs/064-unified-
// availability-polls.md): the same RecordCard plus its own expandable "covered matches"/"responses"
// lists, inline description editor and share dialog, now with a 'Group poll' type badge, a Closes
// row and a Delete action. Each card owns its own mutations so one card's pending state never
// leaks onto another's.
export function GroupPollCard({
  clubId,
  round,
  onChanged,
}: {
  clubId: string
  round: SectionAvailabilityRound
  onChanged: () => void
}) {
  const queryClient = useQueryClient()
  const [matchesOpen, setMatchesOpen] = useState(false)
  const [responsesOpen, setResponsesOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [descriptionDraft, setDescriptionDraft] = useState(round.description)
  const [settingKey, setSettingKey] = useState<string | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [closeOpen, setCloseOpen] = useState(false)
  // The server's own 409 message when picked match squad members block the delete.
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null)

  const deleteMutation = useMutation({
    mutationFn: () => deleteRound(clubId, round.id),
    onSuccess: () => {
      setDeleteOpen(false)
      onChanged()
    },
    onError: (error) => {
      if (isAxiosError(error) && error.response?.status === 409) {
        setDeleteOpen(false)
        setBlockedMessage(errorDetail(error, "This group poll can't be deleted right now."))
      } else {
        // Close the confirm so the card's own inline feedback (gated on !deleteOpen) is visible.
        setDeleteOpen(false)
      }
    },
  })

  const toggleMutation = useMutation({
    mutationFn: () => (round.open ? closeRound(clubId, round.id) : openRound(clubId, round.id)),
    onSuccess: () => {
      setCloseOpen(false)
      onChanged()
    },
    onError: () => setCloseOpen(false),
  })

  // Reopen is only offered until the poll's automatic close time (docs/specs/064).
  const reopenBlocked = !round.open && !canReopen(round)

  const descriptionMutation = useMutation({
    mutationFn: (description: string) => updateRoundDescription(clubId, round.id, description),
    onSuccess: () => {
      onChanged()
      setEditOpen(false)
    },
  })

  const matchesQuery = useQuery({
    queryKey: ['managed-club', clubId, 'section-availability-rounds', round.id, 'matches'],
    queryFn: () => getRoundMatches(clubId, round.id),
    enabled: matchesOpen,
  })

  const responsesQuery = useQuery({
    queryKey: ['managed-club', clubId, 'section-availability-rounds', round.id, 'responses'],
    queryFn: () => getRoundResponses(clubId, round.id),
    enabled: responsesOpen,
  })

  const setStatusMutation = useMutation({
    mutationFn: ({ playerProfileId, windowId, status }: { playerProfileId: string; windowId: string; status: AvailabilityStatus }) =>
      setRoundPlayerStatus(clubId, round.id, playerProfileId, windowId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['managed-club', clubId, 'section-availability-rounds', round.id, 'responses'] })
      onChanged()
    },
    onSettled: () => setSettingKey(null),
  })

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <RecordCard
        title={round.description}
        description={round.sectionName}
        avatar={{ fallback: <EventAvailableOutlinedIcon fontSize="small" />, shape: 'rounded' }}
        badge={{ label: 'Group poll', tone: 'neutral' }}
        badges={[{ label: round.open ? 'Open' : 'Closed', tone: round.open ? 'positive' : 'muted' }]}
        fields={roundFields(round)}
        secondaryAction={
          reopenBlocked
            ? undefined
            : {
                label: round.open ? 'Close' : 'Reopen',
                pendingLabel: round.open ? 'Closing…' : 'Reopening…',
                pending: toggleMutation.isPending,
                onClick: () => (round.open ? setCloseOpen(true) : toggleMutation.mutate()),
                icon: round.open ? <LockOutlinedIcon fontSize="small" /> : <LockOpenOutlinedIcon fontSize="small" />,
              }
        }
        secondaryActions={[
          {
            label: editOpen ? 'Hide description editor' : 'Edit description',
            pendingLabel: 'Edit description',
            pending: false,
            onClick: () => {
              setDescriptionDraft(round.description)
              setEditOpen((prev) => !prev)
            },
            icon: <EditOutlinedIcon fontSize="small" />,
          },
          {
            label: matchesOpen ? 'Hide covered matches' : 'View covered matches',
            pendingLabel: 'View covered matches',
            pending: false,
            onClick: () => setMatchesOpen((prev) => !prev),
            icon: <EventNoteOutlinedIcon fontSize="small" />,
          },
          {
            label: responsesOpen ? 'Hide responses' : 'View responses',
            pendingLabel: 'View responses',
            pending: false,
            onClick: () => setResponsesOpen((prev) => !prev),
            icon: <PeopleAltOutlinedIcon fontSize="small" />,
          },
          {
            label: 'Share invite',
            pendingLabel: 'Share invite',
            pending: false,
            onClick: () => setShareOpen(true),
            icon: <ShareOutlinedIcon fontSize="small" />,
          },
          {
            label: 'Delete',
            pendingLabel: 'Deleting…',
            pending: deleteMutation.isPending,
            onClick: () => setDeleteOpen(true),
            icon: <DeleteOutlineIcon fontSize="small" />,
          },
        ]}
        feedback={
          toggleMutation.isError
            ? { message: errorDetail(toggleMutation.error, 'Something went wrong updating this round. Please try again.'), tone: 'error' }
            : reopenBlocked
              ? { message: CANNOT_REOPEN_MESSAGE, tone: 'muted' }
              : deleteMutation.isError && !deleteOpen && !blockedMessage
              ? { message: errorDetail(deleteMutation.error, 'Something went wrong deleting this poll. Please try again.'), tone: 'error' }
              : null
        }
      />

      <Collapse in={editOpen}>
        <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1.5, bgcolor: 'background.paper' }}>
          <Stack spacing={1.5}>
            <Input
              label="Description"
              value={descriptionDraft}
              onChange={(event) => setDescriptionDraft(event.target.value)}
            />
            {descriptionMutation.isError && (
              <Typography variant="body2" color="error.main">
                {errorDetail(descriptionMutation.error, 'Something went wrong saving this description. Please try again.')}
              </Typography>
            )}
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button variant="ghost" size="sm" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={!descriptionDraft.trim() || descriptionMutation.isPending}
                onClick={() => descriptionMutation.mutate(descriptionDraft.trim())}
              >
                {descriptionMutation.isPending ? 'Saving…' : 'Save'}
              </Button>
            </Stack>
          </Stack>
        </Box>
      </Collapse>

      <Collapse in={matchesOpen}>
        <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1.5, bgcolor: 'background.paper' }}>
          {matchesQuery.isLoading && (
            <Typography variant="body2" color="text.secondary">
              Loading covered matches…
            </Typography>
          )}
          {!matchesQuery.isLoading && (
            <Stack spacing={2}>
              {round.brackets.map((bracket) => {
                const matchesForBracket = (matchesQuery.data ?? []).filter((match) => match.windowId === bracket.windowId)
                return (
                  <Stack key={bracket.windowId} spacing={1}>
                    <Typography variant="subtitle2" fontWeight={600}>
                      {formatBracketLabel(bracket.windowDate, bracket.dayPart)}
                    </Typography>
                    {matchesForBracket.length === 0 && (
                      <Typography variant="body2" color="text.secondary">
                        No matches in this bracket.
                      </Typography>
                    )}
                    {matchesForBracket.map((match) => (
                      <Stack key={`${match.matchId}-${match.teamId}`} direction="row" justifyContent="space-between" spacing={1.5}>
                        <Typography variant="body2">
                          {match.teamName} vs {match.opponentLabel}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {new Date(match.matchDate).toLocaleString()}
                        </Typography>
                      </Stack>
                    ))}
                  </Stack>
                )
              })}
            </Stack>
          )}
        </Box>
      </Collapse>

      <Collapse in={responsesOpen}>
        <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1.5, bgcolor: 'background.paper' }}>
          {responsesQuery.isLoading && (
            <Typography variant="body2" color="text.secondary">
              Loading responses…
            </Typography>
          )}
          {!responsesQuery.isLoading && (responsesQuery.data?.responses ?? []).length === 0 && (
            <Typography variant="body2" color="text.secondary">
              No eligible players for this section yet.
            </Typography>
          )}
          {!responsesQuery.isLoading && (responsesQuery.data?.responses ?? []).length > 0 && (
            <Stack spacing={1}>
              {(responsesQuery.data?.responses ?? []).map((row) => (
                <Stack
                  key={row.playerProfileId}
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                  flexWrap="wrap"
                  useFlexGap
                  spacing={1}
                  sx={{ p: 1.5, border: 1, borderColor: 'divider', borderRadius: 1 }}
                >
                  <Typography variant="body2" fontWeight={600} noWrap>
                    {playerDisplayName(row)}
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {row.statuses.map((entry) => (
                      <BracketStatusChip
                        key={entry.windowId}
                        windowId={entry.windowId}
                        dayPart={entry.dayPart}
                        windowDate={entry.windowDate}
                        status={entry.status}
                        disabled={!round.open}
                        pending={settingKey === `${row.playerProfileId}:${entry.windowId}`}
                        playerName={playerDisplayName(row)}
                        onSelect={(windowId, status) => {
                          setSettingKey(`${row.playerProfileId}:${windowId}`)
                          setStatusMutation.mutate({ playerProfileId: row.playerProfileId, windowId, status })
                        }}
                      />
                    ))}
                  </Stack>
                </Stack>
              ))}
            </Stack>
          )}
        </Box>
      </Collapse>

      <SectionAvailabilityShareDialog open={shareOpen} onClose={() => setShareOpen(false)} round={round} />

      <ConfirmDialog
        open={closeOpen}
        title={closePollTitle()}
        description={closePollDescription(round.autoClose)}
        confirmLabel="Close poll"
        pendingLabel="Closing…"
        pending={toggleMutation.isPending}
        onConfirm={() => toggleMutation.mutate()}
        onClose={() => setCloseOpen(false)}
      />
      <ConfirmDialog
        open={deleteOpen}
        title="Delete this group poll?"
        description={`"${round.description}" and every response to it will be removed. Its fixtures can be polled again afterwards.`}
        confirmLabel="Delete poll"
        pendingLabel="Deleting…"
        destructive
        pending={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
        onClose={() => setDeleteOpen(false)}
      />
      <ConfirmDialog
        open={blockedMessage !== null}
        title="Can't delete this poll"
        description={blockedMessage}
        acknowledgeOnly
        onClose={() => setBlockedMessage(null)}
      />
    </Box>
  )
}
