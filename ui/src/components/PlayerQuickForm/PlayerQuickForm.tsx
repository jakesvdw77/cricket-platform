import { useState } from 'react'
import type { FormEvent } from 'react'
import { Alert, Box, Typography } from '@mui/material'
import { Button } from '../Button'
import { Input } from '../Input'
import { MIN_DATE_OF_BIRTH, todayIso, validatePlayerBasics } from '../../utils/playerValidation'
import type { PlayerBasicsErrors } from '../../utils/playerValidation'
import { birthDateWindow, birthDateWindowText, isOutsideWindow } from '../../utils/birthDateWindow'
import type { Section } from '../../api/sectionApi'
import type { League } from '../../api/leagueApi'

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
  // The guest's section: its age limits narrow the date of birth box (min and max, a helper line, an amber note for a date
  // outside them). Guidance only; nothing is prefilled and nothing is blocked.
  section?: Pick<Section, 'name' | 'minAge' | 'maxAge'> | null
  // The match's league: its age cut-off date and limits take over from the section's.
  league?: Pick<League, 'minAge' | 'maxAge' | 'ageCutoffDate'> | null
  // Called with trimmed values once the required fields pass the same checks as PlayerForm.
  onSubmit: (values: PlayerQuickValues) => void
}

// docs/specs/104-match-results-import-adaptors.md: the few fields the server requires to create a player (first name,
// last name, date of birth), for creating one from inside another dialog. The rest is added later from the player's page.
// Date of birth is left empty on purpose: the manager has to enter it.
export function PlayerQuickForm({ initialFirstName = '', initialLastName = '', submitLabel, pending = false, error = null, section = null, league = null, onSubmit }: PlayerQuickFormProps) {
  const [values, setValues] = useState<PlayerQuickValues>({ firstName: initialFirstName, lastName: initialLastName, dateOfBirth: '' })
  const [errors, setErrors] = useState<PlayerBasicsErrors>({})
  const window = birthDateWindow({ section, league })
  const outside = window !== null && isOutsideWindow(window, values.dateOfBirth)
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
        helperText={errors.dateOfBirth ?? (window ? birthDateWindowText(window) : undefined)}
        disabled={pending}
        inputProps={{ min: window?.earliest ?? MIN_DATE_OF_BIRTH, max: window?.latest ?? todayIso() }}
        InputLabelProps={{ shrink: true }}
      />
      {outside && (
        <Typography variant="body2" role="status" sx={{ color: 'warning.main', fontWeight: 600 }}>
          This date is outside the section&apos;s age range.
        </Typography>
      )}
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
