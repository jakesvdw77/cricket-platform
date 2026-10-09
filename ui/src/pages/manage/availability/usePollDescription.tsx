import { useState } from 'react'
import type { ReactNode } from 'react'
import { useMutation } from '@tanstack/react-query'
import { EditDescriptionDialog } from './EditDescriptionDialog'
import { updateRoundDescription } from '../../../api/sectionAvailabilityApi'
import { errorDetail } from '../../../utils/errorDetail'

export interface PollDescriptionOptions {
  clubId: string
  roundId: string
  // The saved description.
  description: string
  // Called once it has been saved (the caller refreshes its data).
  onSaved: () => void
}

export interface PollDescription {
  // Opens the edit dialog.
  openEditor: () => void
  // Render once next to the caller's own UI.
  dialog: ReactNode
}

// docs/specs/090 (B, extended): a group poll's description editor - the dialog and the save - shared by the poll card's
// title pencil and the group poll page's. A squad poll has no description (its title is its match).
export function usePollDescription({ clubId, roundId, description, onSaved }: PollDescriptionOptions): PollDescription {
  const [open, setOpen] = useState(false)
  const mutation = useMutation({
    mutationFn: (next: string) => updateRoundDescription(clubId, roundId, next),
    onSuccess: () => {
      setOpen(false)
      onSaved()
    },
  })

  return {
    openEditor: () => setOpen(true),
    dialog: (
      <EditDescriptionDialog
        open={open}
        onClose={() => setOpen(false)}
        description={description}
        pending={mutation.isPending}
        errorMessage={mutation.isError ? errorDetail(mutation.error, 'Something went wrong saving this description. Please try again.') : null}
        onSave={(next) => mutation.mutate(next)}
      />
    ),
  }
}
