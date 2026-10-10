import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Alert, Box, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem } from '@mui/material'
import { Button } from '../Button'
import { Input } from '../Input'
import type { Section, SectionPayload } from '../../api/sectionApi'
import { inputToNumber } from '../../utils/numberInput'

export interface AddSectionDialogProps {
  open: boolean
  // The section the new one goes under; null for a top-level section.
  parent: Section | null
  // The parent's path for the title, e.g. "Juniors, Boys". Ignored for a top-level section.
  parentPath?: string
  onClose: () => void
  // The caller does the API call (and closes the dialog on success).
  onCreate: (payload: SectionPayload) => Promise<unknown> | void
  pending?: boolean
  // A message to show when the create failed.
  error?: string | null
}

// docs/specs/094-club-structure-and-seasons.md "The '+' button": a small dialog that names the parent and collects the
// few fields a section needs. Everything beyond that (contacts, teams) is on /manage/sections.
export function AddSectionDialog({ open, parent, parentPath, onClose, onCreate, pending = false, error }: AddSectionDialogProps) {
  const [name, setName] = useState('')
  const [minAge, setMinAge] = useState('')
  const [maxAge, setMaxAge] = useState('')
  const [gender, setGender] = useState<'' | 'MALE' | 'FEMALE'>('')
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    if (open) {
      setName('')
      setMinAge('')
      setMaxAge('')
      setGender('')
      setTouched(false)
    }
  }, [open, parent?.id])

  const minValue = inputToNumber(minAge)
  const maxValue = inputToNumber(maxAge)
  const nameError = touched && name.trim() === ''
  const rangeError = minValue !== null && maxValue !== null && maxValue < minValue

  const title = parent ? `Add a section under ${parentPath || parent.name}` : 'Add a top-level section'

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setTouched(true)
    if (name.trim() === '' || rangeError || pending) {
      return
    }
    await onCreate({
      name: name.trim(),
      parentSectionId: parent?.id ?? null,
      minAge: minValue,
      maxAge: maxValue,
      gender: gender === '' ? null : gender,
    })
  }

  return (
    <Dialog open={open} onClose={pending ? undefined : onClose} fullWidth maxWidth="xs">
      <Box component="form" onSubmit={handleSubmit} noValidate>
        <DialogTitle>{title}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, pt: 1 }}>
            <Input
              label="Name"
              required
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              error={nameError}
              helperText={nameError ? 'Enter a name' : undefined}
              sx={{ gridColumn: { sm: '1 / -1' } }}
            />
            <Input
              label="Age from (optional)"
              type="number"
              value={minAge}
              onChange={(event) => setMinAge(event.target.value)}
              inputProps={{ min: 0 }}
            />
            <Input
              label="Age to (optional)"
              type="number"
              value={maxAge}
              onChange={(event) => setMaxAge(event.target.value)}
              error={rangeError}
              helperText={rangeError ? 'Age to must not be below age from' : undefined}
              inputProps={{ min: 0 }}
            />
            <Input
              label="Gender"
              select
              value={gender}
              onChange={(event) => setGender(event.target.value as '' | 'MALE' | 'FEMALE')}
              sx={{ gridColumn: { sm: '1 / -1' } }}
            >
              <MenuItem value="">Not specified</MenuItem>
              <MenuItem value="MALE">Male</MenuItem>
              <MenuItem value="FEMALE">Female</MenuItem>
            </Input>
          </Box>
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? 'Adding…' : 'Add Section'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  )
}
