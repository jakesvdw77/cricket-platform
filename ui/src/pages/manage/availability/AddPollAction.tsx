import { useState } from 'react'
import { EmptyStateLink } from '../../../components/EmptyState'
import { AddPollChooserDialog } from './AddPollChooserDialog'

// page-anatomy section 5 (2026-11-04): the quick-action "Add Poll" button of an Availability empty state, with the same chooser the
// title-row button opens. One component, so every tab's empty state offers it the same way.
export function AddPollAction({ sectionId }: { sectionId?: string | null }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <EmptyStateLink onClick={() => setOpen(true)}>Create New Poll</EmptyStateLink>
      <AddPollChooserDialog open={open} onClose={() => setOpen(false)} sectionId={sectionId} />
    </>
  )
}
