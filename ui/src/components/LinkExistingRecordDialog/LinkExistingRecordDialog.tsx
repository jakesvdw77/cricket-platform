import { useEffect, useState } from 'react'
import {
  Autocomplete,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
} from '@mui/material'
import { Button } from '../Button'
import { Input } from '../Input'

// A single free-text field shown below the search Autocomplete once a candidate is picked —
// e.g. TeamFormPage's team-specific "Role" captured alongside a linked ClubContact
// (docs/specs/027-team-profile.md). quickFillOptions render as small Chips that populate the
// field without submitting, so the admin can still edit the value before confirming.
export interface LinkExistingRecordDialogExtraField {
  label: string
  quickFillOptions?: string[]
}

export interface LinkExistingRecordDialogProps<T> {
  open: boolean
  onClose: () => void
  title: string
  // Pre-filtered by the caller (e.g. already-linked records excluded) — this component does no
  // filtering of its own.
  candidates: T[]
  loading?: boolean
  getOptionLabel: (option: T) => string
  isOptionEqualToValue?: (option: T, value: T) => boolean
  searchLabel?: string
  searchPlaceholder?: string
  // Called with the selected candidate — and, when extraField is supplied, the extra field's
  // trimmed value as a second argument — once the admin confirms the link.
  onLink: (option: T, extraValue?: string) => void
  extraField?: LinkExistingRecordDialogExtraField
}

// Generic "search an existing record and link it" dialog — extracted from ClubStructure.tsx's
// original inline Section↔ClubContact dialog (docs/specs/027-team-profile.md), generalized over
// the linked record type. Two distinct interaction modes, chosen by whether extraField is
// supplied:
//   - No extraField (e.g. Section↔ClubContact, Team↔Sponsor): selecting an Autocomplete option
//     links it immediately — no confirm button, just Cancel. Byte-for-byte the original UX.
//   - extraField supplied (e.g. Team↔ClubContact's team-specific role): selecting an option only
//     stores it locally; the extra field renders below, and a "Link" button in DialogActions
//     (disabled until both a selection and a non-blank extra value exist) confirms the link.
export function LinkExistingRecordDialog<T>({
  open,
  onClose,
  title,
  candidates,
  loading = false,
  getOptionLabel,
  isOptionEqualToValue,
  searchLabel = 'Search',
  searchPlaceholder,
  onLink,
  extraField,
}: LinkExistingRecordDialogProps<T>) {
  const [selected, setSelected] = useState<T | null>(null)
  const [extraValue, setExtraValue] = useState('')

  // Resets local draft state whenever the dialog closes, so reopening it never shows a stale
  // selection/value left over from the previous time it was used.
  useEffect(() => {
    if (!open) {
      setSelected(null)
      setExtraValue('')
    }
  }, [open])

  const handleChange = (_event: unknown, value: T | null) => {
    if (!value) {
      return
    }
    if (extraField) {
      setSelected(value)
    } else {
      onLink(value)
    }
  }

  const handleConfirm = () => {
    if (!selected || !extraValue.trim()) {
      return
    }
    onLink(selected, extraValue.trim())
  }

  const confirmDisabled = !selected || !extraValue.trim()

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Autocomplete<T>
          options={candidates}
          loading={loading}
          getOptionLabel={getOptionLabel}
          isOptionEqualToValue={isOptionEqualToValue}
          onChange={handleChange}
          {...(extraField ? { value: selected } : {})}
          renderInput={(params) => (
            <Input
              {...params}
              label={searchLabel}
              placeholder={searchPlaceholder}
              sx={{ mt: 1 }}
              InputProps={{
                ...params.InputProps,
                endAdornment: (
                  <>
                    {loading && <CircularProgress color="inherit" size={16} />}
                    {params.InputProps.endAdornment}
                  </>
                ),
              }}
            />
          )}
        />

        {extraField && (
          <Stack spacing={1} sx={{ mt: 2 }}>
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
      </DialogContent>
      <DialogActions>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        {extraField && (
          <Button onClick={handleConfirm} disabled={confirmDisabled}>
            Link
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}
