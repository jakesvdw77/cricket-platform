import { useState } from 'react'
import type { FormEvent } from 'react'
import { Alert, Box } from '@mui/material'
import { Button } from '../Button'
import { Input } from '../Input'
import { MIN_DATE_OF_BIRTH, todayIso, validatePlayerBasics } from '../../utils/playerValidation'
import type { PlayerBasicsErrors } from '../../utils/playerValidation'

export interface PlayerQuickValues {
  firstName: string
  lastName: string
  dateOfBirth: string
}

export interface PlayerQuickFormProps {
  initialFirstName?: string
  initialLastName?: string
  // The primary button, e.g. "Create and link".
  submitLabel: string
  pending?: boolean
  // A server problem, shown inline above the button.
  error?: string | null
  // Called with trimmed values once the required fields pass the same checks as PlayerForm.
  onSubmit: (values: PlayerQuickValues) => void
}

// docs/specs/104-match-results-import-adaptors.md: the few fields the server requires to create a player (first name,
// last name, date of birth), for creating one from inside another dialog. The rest is added later from the player's page.
// Date of birth is left empty on purpose: the manager has to enter it.
export function PlayerQuickForm({ initialFirstName = '', initialLastName = '', submitLabel, pending = false, error = null, onSubmit }: PlayerQuickFormProps) {
  const [values, setValues] = useState<PlayerQuickValues>({ firstName: initialFirstName, lastName: initialLastName, dateOfBirth: '' })
  const [errors, setErrors] = useState<PlayerBasicsErrors>({})
  const change = (key: keyof PlayerQuickValues) => (event: { target: { value: string } }) => setValues((prev) => ({ ...prev, [key]: event.target.value }))

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const found = validatePlayerBasics(values)
    setErrors(found)
    if (Object.keys(found).length > 0) return
    onSubmit({ firstName: values.firstName.trim(), lastName: values.lastName.trim(), dateOfBirth: values.dateOfBirth })
  }

  return (
    <Box component="form" onSubmit={submit} noValidate aria-label="New player" sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Input label="First name" value={values.firstName} onChange={change('firstName')} error={Boolean(errors.firstName)} helperText={errors.firstName} disabled={pending} autoComplete="off" />
      <Input label="Last name" value={values.lastName} onChange={change('lastName')} error={Boolean(errors.lastName)} helperText={errors.lastName} disabled={pending} autoComplete="off" />
      <Input
        label="Date of birth"
        type="date"
        value={values.dateOfBirth}
        onChange={change('dateOfBirth')}
        error={Boolean(errors.dateOfBirth)}
        helperText={errors.dateOfBirth}
        disabled={pending}
        inputProps={{ min: MIN_DATE_OF_BIRTH, max: todayIso() }}
        InputLabelProps={{ shrink: true }}
      />
      {error && (
        <Alert severity="error" role="alert">
          {error}
        </Alert>
      )}
      <Button type="submit" disabled={pending} sx={{ alignSelf: 'flex-start', minHeight: 44 }}>
        {pending ? 'Saving…' : submitLabel}
      </Button>
    </Box>
  )
}
