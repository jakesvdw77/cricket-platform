import { useEffect, useState } from 'react'
import { Alert, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material'
import { Button } from '../../../components/Button'
import { Input } from '../../../components/Input'
import { useDeclineLinkRequest } from '../../../api/playerAccountsApi'
import type { LinkRequest } from '../../../api/playerAccountsApi'

export interface DeclineLinkRequestDialogProps {
  clubId: string
  request: LinkRequest | null
  onClose: () => void
}

// docs/specs/119 Part 3: decline with an optional note the requester will see.
export function DeclineLinkRequestDialog({ clubId, request, onClose }: DeclineLinkRequestDialogProps) {
  const decline = useDeclineLinkRequest(clubId)
  const [note, setNote] = useState('')
  useEffect(() => {
    if (!request) {
      setNote('')
      decline.reset()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request])

  return (
    <Dialog open={Boolean(request)} onClose={decline.isPending ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle>Decline this request?</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <DialogContentText>
          {request?.requesterName} will be told the request was declined. You can add a note for them.
        </DialogContentText>
        <Input
          label="Note (optional)"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          multiline
          minRows={2}
          inputProps={{ maxLength: 500 }}
          disabled={decline.isPending}
        />
        {decline.isError && <Alert severity="error">We could not decline this request. Please try again.</Alert>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button variant="ghost" onClick={onClose} disabled={decline.isPending}>
          Cancel
        </Button>
        <Button
          variant="danger"
          disabled={decline.isPending}
          onClick={() => request && decline.mutate({ id: request.id, note: note.trim() || undefined }, { onSuccess: onClose })}
        >
          {decline.isPending ? 'Declining…' : 'Decline request'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
