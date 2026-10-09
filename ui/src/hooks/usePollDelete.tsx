import { useState } from 'react'
import type { ReactNode } from 'react'
import { isAxiosError } from 'axios'
import { useMutation } from '@tanstack/react-query'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { deletePoll } from '../api/matchAvailabilityApi'
import { deleteRound } from '../api/sectionAvailabilityApi'
import { errorDetail } from '../utils/errorDetail'
import type { PollCloseTarget } from './usePollClose'

export interface PollDeleteOptions {
  clubId: string
  target: PollCloseTarget
  // The poll's name, for the confirmation ("Sat 6 Jun - U13 Boys fixtures" / "Home vs Rivals").
  title: string
  // Called once the poll has been deleted (the caller refreshes its lists and, on a poll page, leaves).
  onDeleted: () => void
}

export interface PollDelete {
  // Opens the "Delete this ... poll?" confirmation.
  requestDelete: () => void
  deleting: boolean
  // A failure other than the group-poll 409 (which shows the notice instead).
  deleteError: unknown
  // Render once next to the caller's own UI (the confirmation and the "can't delete" notice).
  dialogs: ReactNode
}

// docs/specs/090 (B, extended): deleting a squad or group poll - the confirmation, the request and the group-poll "can't
// delete this poll" notice (the server's own 409 message when picked match squad members block it) - shared by the poll
// card and both poll pages so they cannot drift.
export function usePollDelete({ clubId, target, title, onDeleted }: PollDeleteOptions): PollDelete {
  const [open, setOpen] = useState(false)
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null)
  const mutation = useMutation({
    mutationFn: () => (target.kind === 'GROUP' ? deleteRound(clubId, target.roundId) : deletePoll(clubId, target.matchId, target.pollId)),
    onSuccess: () => {
      setOpen(false)
      onDeleted()
    },
    onError: (error) => {
      setOpen(false)
      if (target.kind === 'GROUP' && isAxiosError(error) && error.response?.status === 409) {
        setBlockedMessage(errorDetail(error, "This group poll can't be deleted right now."))
      }
    },
  })

  return {
    requestDelete: () => setOpen(true),
    deleting: mutation.isPending,
    deleteError: mutation.isError && !blockedMessage ? mutation.error : null,
    dialogs: (
      <>
        <ConfirmDialog
          open={open}
          title={target.kind === 'GROUP' ? 'Delete this group poll?' : 'Delete this squad poll?'}
          description={
            target.kind === 'GROUP'
              ? `"${title}" and every response to it will be removed. Its fixtures can be polled again afterwards.`
              : `The poll for ${title} and every response to it will be removed. This match can be polled again afterwards.`
          }
          confirmLabel="Delete poll"
          pendingLabel="Deleting…"
          destructive
          pending={mutation.isPending}
          onConfirm={() => mutation.mutate()}
          onClose={() => setOpen(false)}
        />
        <ConfirmDialog
          open={blockedMessage !== null}
          title="Can't delete this poll"
          description={blockedMessage}
          acknowledgeOnly
          onClose={() => setBlockedMessage(null)}
        />
      </>
    ),
  }
}
