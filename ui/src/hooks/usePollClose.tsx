import { useState } from 'react'
import type { ReactNode } from 'react'
import { useMutation } from '@tanstack/react-query'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { closePoll } from '../api/matchAvailabilityApi'
import { closeRound } from '../api/sectionAvailabilityApi'
import { closePollDescription, closePollTitle } from '../utils/pollClose'

export type PollCloseTarget = { kind: 'SQUAD'; matchId: string; pollId: string } | { kind: 'GROUP'; roundId: string }

export interface PollCloseOptions {
  clubId: string
  target: PollCloseTarget
  autoClose: boolean
  // Called once the poll has been closed (the caller refreshes its data).
  onClosed: () => void
}

export interface PollClose {
  // Opens the "Close this poll?" confirmation.
  requestClose: () => void
  closing: boolean
  closeError: unknown
  // Render once next to the caller's own UI.
  confirmDialog: ReactNode
}

// docs/specs/090: closing a squad or group poll - the confirmation and the request - shared by the poll card and both poll
// pages so they cannot drift. Reopening is not here: it goes through EditCloseTimeDialog (a new close time is saved first,
// because the server refuses a reopen once an automatic close time has passed).
export function usePollClose({ clubId, target, autoClose, onClosed }: PollCloseOptions): PollClose {
  const [open, setOpen] = useState(false)
  const mutation = useMutation({
    mutationFn: async () => {
      if (target.kind === 'GROUP') {
        await closeRound(clubId, target.roundId)
      } else {
        await closePoll(clubId, target.matchId, target.pollId)
      }
    },
    onSuccess: () => {
      setOpen(false)
      onClosed()
    },
    onError: () => setOpen(false),
  })

  return {
    requestClose: () => setOpen(true),
    closing: mutation.isPending,
    closeError: mutation.isError ? mutation.error : null,
    confirmDialog: (
      <ConfirmDialog
        open={open}
        title={closePollTitle()}
        description={closePollDescription(autoClose)}
        confirmLabel="Close poll"
        pendingLabel="Closing…"
        pending={mutation.isPending}
        onConfirm={() => mutation.mutate()}
        onClose={() => setOpen(false)}
      />
    ),
  }
}
