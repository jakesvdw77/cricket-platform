import { Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button } from '../../../components/Button'
import { currentOrigin, withReturnTo } from '../../../utils/returnTo'
import { PollTypeTiles } from './PollTypeTiles'
import type { PollKind } from './PollTypeTiles'

export interface AddPollChooserDialogProps {
  open: boolean
  onClose: () => void
  // The Group branch's shortcuts (the hub's Section filter): passed on when the manager picks a Group Poll.
  sectionId?: string | null
}

// docs/specs/136 and page-anatomy section 8: Add Poll is ONE button that opens a chooser of large tiles. A tile goes straight to the
// New Poll page for that kind, carrying returnTo so Back, Cancel and Create come back here.
export function AddPollChooserDialog({ open, onClose, sectionId }: AddPollChooserDialogProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const choose = (kind: PollKind) => {
    const query = kind === 'group' && sectionId ? `?type=group&sectionId=${encodeURIComponent(sectionId)}` : `?type=${kind}`
    onClose()
    navigate(withReturnTo(`/manage/availability/new${query}`, currentOrigin(location), 'Availability'))
  }
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" aria-labelledby="add-poll-chooser-title">
      <DialogTitle id="add-poll-chooser-title">Create New Poll</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: 1 }}>
        <PollTypeTiles onChoose={choose} />
      </DialogContent>
      <DialogActions>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  )
}
