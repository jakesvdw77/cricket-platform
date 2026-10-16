import { useState } from 'react'
import type { ReactNode } from 'react'
import { Typography } from '@mui/material'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { deleteMatch } from '../../../../api/matchApi'
import { ConfirmDialog } from '../../../../components/ConfirmDialog'
import { errorDetail } from '../../../../utils/errorDetail'

export interface DeleteMatchTarget {
  id: string
  // "Home v Away", for the row's accessible name.
  name: string
}

// docs/specs/109-delete-empty-match.md: the one confirm-and-delete flow for an empty match, shared by the proposed candidates
// and the "Find another match" results. On success the matches queries are refreshed (so the search results drop it) and
// `onDeleted` lets the page remove it from the candidates and clear any choice of it.
export function useDeleteMatchDialog(clubId: string, onDeleted: (matchId: string) => void): { request: (target: DeleteMatchTarget) => void; dialog: ReactNode } {
  const queryClient = useQueryClient()
  const [target, setTarget] = useState<DeleteMatchTarget | null>(null)
  const mutation = useMutation({
    mutationFn: (match: DeleteMatchTarget) => deleteMatch(clubId, match.id),
    onSuccess: (_data, match) => {
      setTarget(null)
      void queryClient.invalidateQueries({ queryKey: ['managed-club', clubId, 'matches'] })
      onDeleted(match.id)
    },
  })
  const close = () => {
    setTarget(null)
    mutation.reset()
  }
  const dialog = (
    <ConfirmDialog
      open={target !== null}
      title="Delete this match?"
      description={
        <>
          It has nothing recorded against it. This cannot be undone.
          {mutation.isError && (
            <Typography role="alert" variant="body2" color="error" sx={{ mt: 1.5 }}>
              {errorDetail(mutation.error, 'Something went wrong deleting this match. Please try again.')}
            </Typography>
          )}
        </>
      }
      confirmLabel="Delete"
      pendingLabel="Deleting…"
      destructive
      pending={mutation.isPending}
      onConfirm={() => target && mutation.mutate(target)}
      onClose={close}
    />
  )
  return { request: setTarget, dialog }
}
