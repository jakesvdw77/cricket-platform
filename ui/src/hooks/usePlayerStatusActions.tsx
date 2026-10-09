import { useState } from 'react'
import type { ReactNode } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { deactivatePlayer, reactivatePlayer, rejectPlayer, verifyPlayer } from '../api/playerApi'
import type { Player } from '../api/playerApi'
import { errorDetail } from '../utils/errorDetail'
import type { PlayerStatusAction } from '../utils/playerStatus'

export interface PlayerStatusActions {
  // Verify and Reactivate act at once; Reject and Suspend open a confirmation first.
  requestAction: (player: Player, action: PlayerStatusAction) => void
  // Render once next to the caller's own UI.
  dialog: ReactNode
  pending: boolean
}

const CONFIRM_COPY = {
  reject: {
    title: 'Reject this player request?',
    description: (name: string) =>
      `${name} will be hidden from the player list. You can still find them with "Show inactive" and verify them later.`,
    confirmLabel: 'Reject player',
    pendingLabel: 'Rejecting…',
  },
  suspend: {
    title: 'Suspend this player?',
    description: (name: string) =>
      `${name} will be hidden from the player list and cannot be picked for matches until you reactivate them. Nothing is deleted.`,
    confirmLabel: 'Suspend player',
    pendingLabel: 'Suspending…',
  },
} as const

// docs/specs/088-players-polls-alignment.md: the one place a player's Status menu is acted on. The Players list cards
// and the Player page both call requestAction and render `dialog` once. Verify and Reactivate run straight away; Reject
// and Suspend ask first. Every success refreshes the whole players prefix (list, counters, a single player); a failure
// shows the server's reason in a notice.
export function usePlayerStatusActions(clubId: string | undefined): PlayerStatusActions {
  const queryClient = useQueryClient()
  const [confirming, setConfirming] = useState<{ player: Player; action: 'reject' | 'suspend' } | null>(null)
  const [failure, setFailure] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: ({ player, action }: { player: Player; action: PlayerStatusAction }) => {
      const id = clubId as string
      switch (action) {
        case 'verify':
          return verifyPlayer(id, player.id)
        case 'reject':
          return rejectPlayer(id, player.id)
        case 'suspend':
          return deactivatePlayer(id, player.id)
        default:
          return reactivatePlayer(id, player.id)
      }
    },
    onSuccess: () => {
      setConfirming(null)
      queryClient.invalidateQueries({ queryKey: ['managed-club', clubId, 'players'] })
    },
    onError: (error) => {
      setConfirming(null)
      setFailure(errorDetail(error, "This player's status could not be changed. Please try again."))
    },
  })

  const requestAction = (player: Player, action: PlayerStatusAction) => {
    if (!clubId) return
    if (action === 'reject' || action === 'suspend') {
      setConfirming({ player, action })
      return
    }
    mutation.mutate({ player, action })
  }

  const copy = confirming ? CONFIRM_COPY[confirming.action] : null
  const name = confirming ? `${confirming.player.firstName} ${confirming.player.lastName}` : ''

  const dialog = (
    <>
      <ConfirmDialog
        open={confirming !== null}
        title={copy?.title ?? ''}
        description={copy?.description(name) ?? ''}
        confirmLabel={copy?.confirmLabel}
        pendingLabel={copy?.pendingLabel}
        destructive
        pending={mutation.isPending}
        onConfirm={() => confirming && mutation.mutate({ player: confirming.player, action: confirming.action })}
        onClose={() => setConfirming(null)}
      />
      <ConfirmDialog
        open={failure !== null}
        title="Couldn't change the status"
        description={failure}
        acknowledgeOnly
        onClose={() => setFailure(null)}
      />
    </>
  )

  return { requestAction, dialog, pending: mutation.isPending }
}
