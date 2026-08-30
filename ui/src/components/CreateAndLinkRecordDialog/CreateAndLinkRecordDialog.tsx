import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Box, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from '@mui/material'
import { Button } from '../Button'
import { Input } from '../Input'

// Same optional extra-field slot LinkExistingRecordDialog offers — e.g. TeamFormPage's
// create-and-link-a-new-contact flow still needs the team-specific "Role" captured alongside a
// brand-new ClubContact (docs/specs/027-team-profile.md), separate from ClubContactForm's own
// club-wide role field.
export interface CreateAndLinkRecordDialogExtraField {
  label: string
  quickFillOptions?: string[]
}

export interface CreateAndLinkRecordDialogProps<TPayload> {
  open: boolean
  onClose: () => void
  title: string
  // The target create-form component's exported *_FORM_ID constant (e.g. CLUB_CONTACT_FORM_ID) —
  // the confirm button below targets it via the native HTML form="…" attribute, same pattern
  // every *Form component in this codebase already uses.
  formId: string
  // Renders the create-form component itself, wired to call the given onSubmit with its own
  // validated payload once submitted.
  renderForm: (onSubmit: (payload: TPayload) => void) => ReactNode
  // Called once the wrapped form validates and submits — with the extra field's trimmed value as
  // a second argument when extraField is supplied.
  onCreateAndLink: (payload: TPayload, extraValue?: string) => void
  isPending?: boolean
  isError?: boolean
  errorMessage?: string
  confirmLabel?: string
  pendingLabel?: string
  extraField?: CreateAndLinkRecordDialogExtraField
}

// Generic "create a brand-new record and link it in the same flow" dialog — extracted from
// ClubStructure.tsx's original inline Section↔ClubContact create dialog (docs/specs/
// 027-team-profile.md), generalized over both the payload type and the wrapped create-form
// component (ClubContactForm, SponsorForm, …) via renderForm/formId.
export function CreateAndLinkRecordDialog<TPayload>({
  open,
  onClose,
  title,
  formId,
  renderForm,
  onCreateAndLink,
  isPending = false,
  isError = false,
  errorMessage,
  confirmLabel = 'Create & link',
  pendingLabel = 'Creating…',
  extraField,
}: CreateAndLinkRecordDialogProps<TPayload>) {
  const [extraValue, setExtraValue] = useState('')

  // Resets the extra field whenever the dialog closes, so reopening it never shows a stale value
  // left over from the previous time it was used.
  useEffect(() => {
    if (!open) {
      setExtraValue('')
    }
  }, [open])

  const handleFormSubmit = (payload: TPayload) => {
    if (extraField) {
      onCreateAndLink(payload, extraValue.trim())
    } else {
      onCreateAndLink(payload)
    }
  }

  const confirmDisabled = isPending || (Boolean(extraField) && !extraValue.trim())

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        {extraField && (
          <Stack spacing={1} sx={{ mb: 2 }}>
            <Input
              label={extraField.label}
              value={extraValue}
              onChange={(event) => setExtraValue(event.target.value)}
            />
            {extraField.quickFillOptions && extraField.quickFillOptions.length > 0 && (
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {extraField.quickFillOptions.map((option) => (
                  <Chip key={option} label={option} size="small" onClick={() => setExtraValue(option)} />
                ))}
              </Stack>
            )}
          </Stack>
        )}

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2, pt: extraField ? 0 : 1 }}>
          {renderForm(handleFormSubmit)}
        </Box>

        {isError && (
          <Typography variant="body2" color="error.main" sx={{ mt: 2 }}>
            {errorMessage}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" form={formId} disabled={confirmDisabled}>
          {isPending ? pendingLabel : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
