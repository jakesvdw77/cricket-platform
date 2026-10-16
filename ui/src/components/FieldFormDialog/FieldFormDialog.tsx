import { useState } from 'react'
import { Box, Dialog, DialogActions, DialogContent, DialogTitle, Typography, useMediaQuery } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { FormEvent } from 'react'
import { BottomSheet } from '../BottomSheet'
import { Button } from '../Button'
import { FieldFormFields } from '../FieldFormFields'
import { createPlayingArea, playingAreasKey } from '../../api/playingAreaApi'
import type { PlayingArea } from '../../api/playingAreaApi'
import { useFieldForm } from '../../hooks/useFieldForm'
import { duplicateFieldId } from '../../utils/fieldForm'
import { errorDetail } from '../../utils/errorDetail'

// The form's id: the confirm button below targets it through the native HTML form="..." attribute, the same pattern as
// CreateAndLinkRecordDialog and every *Form component here.
export const FIELD_DIALOG_FORM_ID = 'field-dialog-form'

export interface FieldFormDialogProps {
  open: boolean
  onClose: () => void
  clubId: string
  // What was typed in the picker's search box, used as the new field's name.
  initialName?: string
  // Called with the saved field (a new one, or an existing one the manager chose in "Did you mean"). The caller selects it.
  onCreated: (field: PlayingArea) => void
}

function DialogBody({ clubId, initialName, phone, onClose, onCreated }: Omit<FieldFormDialogProps, 'open'> & { phone: boolean }) {
  const queryClient = useQueryClient()
  const form = useFieldForm(null, clubId, initialName ? { name: initialName } : undefined)
  const [duplicateOfId, setDuplicateOfId] = useState<string | null>(null)

  const save = useMutation({
    mutationFn: (payload: Parameters<typeof createPlayingArea>[1]) => createPlayingArea(clubId, payload, false),
    onSuccess: (field) => {
      queryClient.invalidateQueries({ queryKey: playingAreasKey(clubId) })
      onCreated(field)
      onClose()
    },
    onError: (error) => setDuplicateOfId(duplicateFieldId(error)),
  })

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    // This dialog is opened from inside the match form. React events bubble through the portal to the host <form>, so
    // stop the submit here or saving a field would also submit the match.
    event.stopPropagation()
    const payload = form.submit()
    if (payload) save.mutate(payload)
  }

  const useExisting = (field: PlayingArea) => {
    onCreated(field)
    onClose()
  }

  const fields = (
    <Box component="form" id={FIELD_DIALOG_FORM_ID} onSubmit={handleSubmit} noValidate sx={{ display: 'grid', gap: 2 }}>
      <FieldFormFields
        variant="dialog"
        values={form.values}
        onChange={form.update}
        errors={form.errors}
        clubId={clubId}
        suggest
        duplicateOfId={duplicateOfId}
        onUseExisting={useExisting}
      />
      <Typography variant="body2" color="text.secondary">
        Starts as unverified. A Cricket Legend administrator will check it.
      </Typography>
      {save.isError && !duplicateOfId && (
        <Typography variant="body2" color="error.main">
          {errorDetail(save.error, 'Something went wrong adding this field. Please try again.')}
        </Typography>
      )}
    </Box>
  )

  const actions = (
    <>
      <Button variant="ghost" onClick={onClose} disabled={save.isPending} sx={phone ? { flex: 1 } : undefined}>
        Cancel
      </Button>
      <Button type="submit" form={FIELD_DIALOG_FORM_ID} disabled={save.isPending} sx={phone ? { flex: 1 } : undefined}>
        {save.isPending ? 'Adding…' : 'Add and select'}
      </Button>
    </>
  )

  if (phone) {
    return (
      <>
        <Box sx={{ mt: 0.5 }}>{fields}</Box>
        <Box sx={{ display: 'flex', gap: 1.5, mt: 2 }}>{actions}</Box>
      </>
    )
  }
  return (
    <>
      <DialogContent sx={{ pt: 1 }}>{fields}</DialogContent>
      <DialogActions>{actions}</DialogActions>
    </>
  )
}

// docs/specs/099-fields-directory.md: "Add a new field...", opened from the match form's FieldPicker. A dialog on a desktop,
// a BottomSheet on a phone, around the same FieldFormFields body as the full page. Only name, type, owner, address and an
// optional map link; no area type, no ground. On save the caller selects the new field and the match form behind it is
// left exactly as it was (the dialog's own form never submits the host form).
export function FieldFormDialog({ open, onClose, clubId, initialName, onCreated }: FieldFormDialogProps) {
  const theme = useTheme()
  const phone = useMediaQuery(theme.breakpoints.down('sm'), { noSsr: true })

  if (phone) {
    return (
      <BottomSheet open={open} onOpen={() => undefined} onClose={onClose} ariaLabel="Add a new field" title="Add a new field" closeLabel="Close" aboveDialogs>
        {open && <DialogBody clubId={clubId} initialName={initialName} phone onClose={onClose} onCreated={onCreated} />}
      </BottomSheet>
    )
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" aria-label="Add a new field">
      <DialogTitle>Add a new field</DialogTitle>
      <DialogBody clubId={clubId} initialName={initialName} phone={false} onClose={onClose} onCreated={onCreated} />
    </Dialog>
  )
}
