import { useState } from 'react'
import type { ReactNode } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { PLATFORM_FIELDS_KEY, rejectPlayingArea, reopenPlayingArea, verifyPlayingArea } from '../api/platformPlayingAreaApi'
import type { PlayingArea } from '../api/playingAreaApi'
import { errorDetail } from '../utils/errorDetail'
import type { FieldStatusAction } from '../utils/fieldStatus'

export interface FieldStatusActions {
  // Verify and Reopen act at once; Reject opens a confirmation that needs a reason first.
  requestAction: (field: PlayingArea, action: FieldStatusAction) => void
  // Render once next to the caller's own UI.
  dialog: ReactNode
  pending: boolean
}

// docs/specs/099-fields-directory.md: the one place a field's Status menu is acted on, the shape of
// usePlayerStatusActions. The admin's field list (cards and rows) and the admin field page call requestAction and render
// `dialog` once. Every success refreshes the whole platform fields prefix (list, counters, one field); a failure shows the
// server's reason in a notice. Platform admin only, so there is no club id.
export function useFieldStatusActions(): FieldStatusActions {
  const queryClient = useQueryClient()
  const [rejecting, setRejecting] = useState<PlayingArea | null>(null)
  const [failure, setFailure] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: ({ field, action, reason }: { field: PlayingArea; action: FieldStatusAction; reason?: string }) => {
      switch (action) {
        case 'verify':
          return verifyPlayingArea(field.id)
        case 'reject':
          return rejectPlayingArea(field.id, reason ?? '')
        default:
          return reopenPlayingArea(field.id)
      }
    },
    onSuccess: () => {
      setRejecting(null)
      queryClient.invalidateQueries({ queryKey: PLATFORM_FIELDS_KEY })
    },
    onError: (error) => {
      setRejecting(null)
      setFailure(errorDetail(error, "This field's status could not be changed. Please try again."))
    },
  })

  const requestAction = (field: PlayingArea, action: FieldStatusAction) => {
    if (action === 'reject') {
      setRejecting(field)
      return
    }
    mutation.mutate({ field, action })
  }

  const dialog = (
    <>
      <ConfirmDialog
        open={rejecting !== null}
        title="Reject this field?"
        description={`${rejecting?.name ?? 'This field'} will stop appearing in search and in the match field picker. Matches already using it show a "Field rejected" flag. You can reopen it later.`}
        reasonLabel="Reason for rejecting"
        confirmLabel="Reject field"
        pendingLabel="Rejecting…"
        destructive
        pending={mutation.isPending}
        onConfirm={(reason) => rejecting && mutation.mutate({ field: rejecting, action: 'reject', reason })}
        onClose={() => setRejecting(null)}
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
