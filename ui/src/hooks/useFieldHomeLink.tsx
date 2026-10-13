import { useState } from 'react'
import type { ReactNode } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { linkPlayingAreaHome, playingAreasKey, unlinkPlayingAreaHome } from '../api/playingAreaApi'
import type { PlayingArea } from '../api/playingAreaApi'
import { errorDetail } from '../utils/errorDetail'

export interface FieldHomeLink {
  // Adds the field to the club's own fields, or removes it when it already is one. Acts at once.
  toggleHome: (field: PlayingArea) => void
  pendingId: string | null
  // Render once next to the caller's own UI (a notice when the change fails).
  dialog: ReactNode
}

// docs/specs/099-fields-directory.md: the club's "Our fields" shortlist - Add to our fields / Remove on the Fields list
// (cards and rows) and the field page. Unlinking is always allowed: matches reference the field directly, the link is
// only the shortlist. Every success refreshes the whole playing-areas prefix (list, counters, the picker, one field).
export function useFieldHomeLink(clubId: string | undefined): FieldHomeLink {
  const queryClient = useQueryClient()
  const [failure, setFailure] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: ({ field }: { field: PlayingArea }) =>
      field.linkedHome ? unlinkPlayingAreaHome(clubId as string, field.id) : linkPlayingAreaHome(clubId as string, field.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: playingAreasKey(clubId as string) }),
    onError: (error) => setFailure(errorDetail(error, "Your fields couldn't be changed. Please try again.")),
  })

  const dialog = (
    <ConfirmDialog open={failure !== null} title="Couldn't change your fields" description={failure} acknowledgeOnly onClose={() => setFailure(null)} />
  )

  return {
    toggleHome: (field) => {
      if (clubId) mutation.mutate({ field })
    },
    pendingId: mutation.isPending ? (mutation.variables?.field.id ?? null) : null,
    dialog,
  }
}
