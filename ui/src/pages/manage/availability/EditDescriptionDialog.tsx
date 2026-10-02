import { useState } from 'react'
import { Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material'
import { Button } from '../../../components/Button'
import { Input } from '../../../components/Input'

interface EditDescriptionDialogProps {
  open: boolean
  onClose: () => void
  description: string
  pending: boolean
  errorMessage: string | null
  onSave: (description: string) => void
}

// docs/specs/066: the group poll's description editor, a small dialog opened by the card's title
// pencil (it replaced 064's inline panel, so a card's height never changes on its own).
export function EditDescriptionDialog({ open, onClose, pending, ...rest }: EditDescriptionDialogProps) {
  return (
    <Dialog open={open} onClose={pending ? undefined : onClose} fullWidth maxWidth="xs">
      {/* Mounted only while open, so each open starts from the saved description. */}
      <DescriptionForm onClose={onClose} pending={pending} {...rest} />
    </Dialog>
  )
}

function DescriptionForm({
  onClose,
  description,
  pending,
  errorMessage,
  onSave,
}: Omit<EditDescriptionDialogProps, 'open'>) {
  const [draft, setDraft] = useState(description)
  return (
    <>
      <DialogTitle>Edit description</DialogTitle>
      <DialogContent>
        <Input label="Description" value={draft} onChange={(event) => setDraft(event.target.value)} sx={{ mt: 1 }} />
        {errorMessage && (
          <Typography variant="body2" color="error.main" role="alert" sx={{ mt: 1 }}>
            {errorMessage}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button variant="ghost" onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <Button disabled={!draft.trim() || pending} onClick={() => onSave(draft.trim())}>
          {pending ? 'Saving…' : 'Save'}
        </Button>
      </DialogActions>
    </>
  )
}
