import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Box, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material'
import { Button } from '../Button'
import { Input } from '../Input'

export interface ConfirmDialogProps {
  open: boolean
  title: string
  // Optional leading icon (e.g. a BrandIcon) drawn at the start of the title row.
  icon?: ReactNode
  description: ReactNode
  // Confirm button label; also the lone button's label in acknowledge-only mode (defaults 'OK').
  confirmLabel?: string
  // Shown on the confirm button while `pending` (e.g. 'Deleting…').
  pendingLabel?: string
  // Renders the confirm button with the shared 'danger' Button variant.
  destructive?: boolean
  pending?: boolean
  // docs/specs/064-unified-availability-polls.md: an acknowledge-only notice (no Cancel, no
  // onConfirm) for e.g. 'this group poll can't be deleted' - the single button just dismisses.
  acknowledgeOnly?: boolean
  // docs/specs/099-fields-directory.md: when set, the dialog asks for a required free-text reason (labelled with this
  // text, e.g. "Reason for rejecting") and the confirm button stays disabled until one is typed. `onConfirm` then
  // receives the trimmed reason. Cleared each time the dialog closes.
  reasonLabel?: string
  reasonMaxLength?: number
  onConfirm?: (reason?: string) => void
  onClose: () => void
}

// Generalised from MatchFormPage.tsx's inline 'Replace the current Playing XI?' dialog
// (docs/specs/037-match-improvements.md item 9) once docs/specs/064's two Delete actions and its
// 'cannot delete' notice became the second and third consumers.
export function ConfirmDialog({
  open,
  title,
  icon,
  description,
  confirmLabel,
  pendingLabel,
  destructive = false,
  pending = false,
  acknowledgeOnly = false,
  reasonLabel,
  reasonMaxLength = 500,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const [reason, setReason] = useState('')
  useEffect(() => {
    if (!open) setReason('')
  }, [open])
  const reasonMissing = Boolean(reasonLabel) && !acknowledgeOnly && !reason.trim()
  const resolvedConfirmLabel = confirmLabel ?? (acknowledgeOnly ? 'OK' : 'Confirm')

  return (
    <Dialog open={open} onClose={pending ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={icon ? { display: 'flex', alignItems: 'center', gap: 1.5 } : undefined}>
        {icon && <Box sx={{ display: 'flex', flex: 'none' }}>{icon}</Box>}
        {title}
      </DialogTitle>
      <DialogContent>
        <DialogContentText component="div">{description}</DialogContentText>
        {reasonLabel && !acknowledgeOnly && (
          <Input
            label={reasonLabel}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            disabled={pending}
            multiline
            minRows={2}
            required
            inputProps={{ maxLength: reasonMaxLength }}
            sx={{ mt: 2 }}
          />
        )}
      </DialogContent>
      <DialogActions>
        {!acknowledgeOnly && (
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
        )}
        <Button
          variant={destructive && !acknowledgeOnly ? 'danger' : 'primary'}
          onClick={acknowledgeOnly ? onClose : () => onConfirm?.(reasonLabel ? reason.trim() : undefined)}
          disabled={pending || reasonMissing}
        >
          {pending && pendingLabel ? pendingLabel : resolvedConfirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
