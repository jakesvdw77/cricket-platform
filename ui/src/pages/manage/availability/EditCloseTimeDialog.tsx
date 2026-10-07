import { useState } from 'react'
import { Alert, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Stack, Switch, Typography } from '@mui/material'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '../../../components/Button'
import { Input } from '../../../components/Input'
import { openPoll, updatePollCloseTime } from '../../../api/matchAvailabilityApi'
import { openRound, updateRoundCloseTime } from '../../../api/sectionAvailabilityApi'
import { fromDatetimeLocal, toDatetimeLocal } from '../../../utils/datetimeLocal'
import { errorDetail } from '../../../utils/errorDetail'
import { defaultCloseTime, validateCloseTime } from './pollHelpers'
import { invalidateAvailabilityCounters } from '../../../api/availabilitySummaryApi'

// Which poll the dialog edits: a squad poll is addressed by match + poll id, a group poll by round id.
export type CloseTimeTarget = { kind: 'SQUAD'; matchId: string; pollId: string } | { kind: 'GROUP'; roundId: string }

export interface EditCloseTimeDialogProps {
  open: boolean
  onClose: () => void
  clubId: string
  target: CloseTimeTarget
  autoClose: boolean
  scheduledCloseAt: string | null
  // The earliest covered match's kickoff (squad: matchDate, group: firstMatchKickoff) - the base of
  // the default close time and the upper bound of the validation.
  kickoff: string
  // A closed poll: the dialog is titled 'Reopen this poll' and its primary action saves the close
  // time and then reopens the poll (the server refuses a reopen while an automatic close time has
  // passed, so the new time is saved first).
  reopen?: boolean
  onSaved?: () => void
}

// docs/specs/066-poll-close-time-and-unified-cards.md: the Edit close time dialog shared by the poll
// card, the group Responses page header and a match's own Availability tab. Owns its mutation and
// the cache invalidation so each caller only has to render it.
export function EditCloseTimeDialog(props: EditCloseTimeDialogProps) {
  return (
    <Dialog open={props.open} onClose={props.onClose} fullWidth maxWidth="xs">
      {/* The form is mounted only while the dialog is open, so every open starts from the poll's
          current values rather than a previous edit. */}
      <EditCloseTimeForm {...props} />
    </Dialog>
  )
}

function initialValue(autoClose: boolean, scheduledCloseAt: string | null, kickoff: string, reopen: boolean): string {
  const now = new Date()
  const stored = scheduledCloseAt && autoClose ? new Date(scheduledCloseAt) : null
  // A stored time that has already passed (a closed poll) is no use as a starting point.
  if (stored && (!reopen || stored.getTime() > now.getTime())) {
    return toDatetimeLocal(stored.toISOString())
  }
  return toDatetimeLocal(defaultCloseTime(kickoff, now).toISOString())
}

function EditCloseTimeForm({
  onClose,
  clubId,
  target,
  autoClose: initialAutoClose,
  scheduledCloseAt,
  kickoff,
  reopen = false,
  onSaved,
}: EditCloseTimeDialogProps) {
  const queryClient = useQueryClient()
  const [autoClose, setAutoClose] = useState(initialAutoClose)
  const [value, setValue] = useState(() => initialValue(initialAutoClose, scheduledCloseAt, kickoff, reopen))

  const closeIso = value ? fromDatetimeLocal(value) : null
  const validationError = validateCloseTime(autoClose, closeIso, kickoff)

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = { autoClose, scheduledCloseAt: autoClose ? closeIso : null }
      if (target.kind === 'SQUAD') {
        await updatePollCloseTime(clubId, target.matchId, target.pollId, payload)
        if (reopen) {
          await openPoll(clubId, target.matchId, target.pollId)
        }
      } else {
        await updateRoundCloseTime(clubId, target.roundId, payload)
        if (reopen) {
          await openRound(clubId, target.roundId)
        }
      }
    },
    onSettled: () => {
      // Even a failed reopen has saved the close time, so refresh in both cases. The prefixes cover
      // the dashboard lists, the Responses page ('detail' and 'responses') and a match's poll tab.
      queryClient.invalidateQueries({ queryKey: ['managed-club', clubId, 'availability-polls'] })
      invalidateAvailabilityCounters(queryClient, clubId)
      queryClient.invalidateQueries({ queryKey: ['managed-club', clubId, 'section-availability-rounds'] })
      queryClient.invalidateQueries({ queryKey: ['managed-club', clubId, 'section-availability-fixture-groups'] })
      queryClient.invalidateQueries({ queryKey: ['managed-club', clubId, 'matches'] })
    },
    onSuccess: () => {
      onSaved?.()
      onClose()
    },
  })

  const pending = saveMutation.isPending
  const primaryLabel = reopen ? 'Reopen' : 'Save'
  const pendingLabel = reopen ? 'Reopening…' : 'Saving…'

  return (
    <>
      <DialogTitle>{reopen ? 'Reopen this poll' : 'Edit close time'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {reopen && (
            <Typography variant="body2" color="text.secondary">
              Choose when the poll should close again, or switch Autoclose off to close it yourself.
            </Typography>
          )}
          <FormControlLabel
            control={<Switch checked={autoClose} onChange={(event) => setAutoClose(event.target.checked)} />}
            label="Autoclose"
          />
          <Input
            label="Closes at"
            type="datetime-local"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            disabled={!autoClose}
            error={autoClose && Boolean(validationError)}
            helperText={autoClose ? validationError : 'The poll stays open until you close it.'}
            InputLabelProps={{ shrink: true }}
          />
          {saveMutation.isError && (
            <Alert severity="error">
              {errorDetail(saveMutation.error, 'Something went wrong saving the close time. Please try again.')}
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="ghost" onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <Button disabled={pending || Boolean(validationError)} onClick={() => saveMutation.mutate()}>
          {pending ? pendingLabel : primaryLabel}
        </Button>
      </DialogActions>
    </>
  )
}
