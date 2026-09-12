import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { Box, Checkbox, FormControlLabel } from '@mui/material'
import { Input } from '../Input'
import type { LeaguePayload } from '../../api/leagueApi'

// Stable id the <form> element renders with — RecordFormScreen's actions bar lives outside this
// component (see LeagueFormPage), same pattern as TEAM_FORM_ID/SPONSOR_FORM_ID.
export const LEAGUE_FORM_ID = 'league-form'

export interface LeagueFormProps {
  initialValues?: Partial<LeaguePayload>
  onSubmit: (payload: LeaguePayload) => void
}

interface FormState {
  name: string
  maxPlayingXiSize: string
  allowSubstitutions: boolean
  minAge: string
  maxAge: string
  ageCutoffDate: string
}

type FormErrors = Partial<Record<'name' | 'maxPlayingXiSize' | 'ageRange', string>>

function toFormState(initialValues?: Partial<LeaguePayload>): FormState {
  return {
    name: initialValues?.name ?? '',
    maxPlayingXiSize: String(initialValues?.maxPlayingXiSize ?? 11),
    allowSubstitutions: initialValues?.allowSubstitutions ?? false,
    minAge: initialValues?.minAge != null ? String(initialValues.minAge) : '',
    maxAge: initialValues?.maxAge != null ? String(initialValues.maxAge) : '',
    ageCutoffDate: initialValues?.ageCutoffDate ?? '',
  }
}

function validate(values: FormState): FormErrors {
  const errors: FormErrors = {}

  if (!values.name.trim()) {
    errors.name = 'Name is required'
  }

  const xiSize = Number(values.maxPlayingXiSize)
  if (!values.maxPlayingXiSize.trim() || Number.isNaN(xiSize) || xiSize <= 0) {
    errors.maxPlayingXiSize = 'Enter a positive whole number'
  }

  // Mirrors the server's own minAge <= maxAge rule (docs/specs/029-league-management.md) so an
  // obviously-invalid range never round-trips to the backend just to be rejected.
  if (values.minAge.trim() && values.maxAge.trim() && Number(values.minAge) > Number(values.maxAge)) {
    errors.ageRange = 'Min age must be less than or equal to max age'
  }

  return errors
}

// Note: League.source is deliberately not exposed here — every League created through this UI is
// INTERNAL (the server default when omitted); source = EXTERNAL is a reserved placeholder for a
// future CricClubs sync with no UI of its own yet (docs/specs/029-league-management.md's
// Non-goals).
export function LeagueForm({ initialValues, onSubmit }: LeagueFormProps) {
  const [values, setValues] = useState<FormState>(() => toFormState(initialValues))
  const [errors, setErrors] = useState<FormErrors>({})

  const handleChange = (field: 'name' | 'maxPlayingXiSize' | 'minAge' | 'maxAge' | 'ageCutoffDate') =>
    (event: ChangeEvent<HTMLInputElement>) => {
      setValues((prev) => ({ ...prev, [field]: event.target.value }))
    }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const validationErrors = validate(values)
    setErrors(validationErrors)

    if (Object.keys(validationErrors).length > 0) {
      return
    }

    const payload: LeaguePayload = {
      name: values.name.trim(),
      maxPlayingXiSize: Number(values.maxPlayingXiSize),
      allowSubstitutions: values.allowSubstitutions,
      minAge: values.minAge.trim() ? Number(values.minAge) : null,
      maxAge: values.maxAge.trim() ? Number(values.maxAge) : null,
      ageCutoffDate: values.ageCutoffDate.trim() ? values.ageCutoffDate : null,
    }
    onSubmit(payload)
  }

  return (
    <Box component="form" id={LEAGUE_FORM_ID} onSubmit={handleSubmit} noValidate sx={{ display: 'contents' }}>
      <Input
        label="Name"
        value={values.name}
        onChange={handleChange('name')}
        error={Boolean(errors.name)}
        helperText={errors.name ?? 'e.g. Riverside Internal T20 League'}
      />

      <Input
        label="Playing XI size"
        type="number"
        value={values.maxPlayingXiSize}
        onChange={handleChange('maxPlayingXiSize')}
        error={Boolean(errors.maxPlayingXiSize)}
        helperText={errors.maxPlayingXiSize ?? 'Defaults to 11 — set to 12 for a Vets league, for example'}
        inputProps={{ min: 1 }}
      />

      <Input
        label="Min age"
        type="number"
        value={values.minAge}
        onChange={handleChange('minAge')}
        error={Boolean(errors.ageRange)}
        helperText={errors.ageRange ?? 'Leave blank for no minimum'}
        inputProps={{ min: 0 }}
      />

      <Input
        label="Max age"
        type="number"
        value={values.maxAge}
        onChange={handleChange('maxAge')}
        error={Boolean(errors.ageRange)}
        helperText="Leave blank for no maximum"
        inputProps={{ min: 0 }}
      />

      <Input
        label="Age cutoff date"
        type="date"
        value={values.ageCutoffDate}
        onChange={handleChange('ageCutoffDate')}
        InputLabelProps={{ shrink: true }}
        helperText="Age as of this date — leave blank to use the match's own season start date"
      />

      <Box sx={{ gridColumn: '1 / -1' }}>
        <FormControlLabel
          control={
            <Checkbox
              checked={values.allowSubstitutions}
              onChange={(event) => setValues((prev) => ({ ...prev, allowSubstitutions: event.target.checked }))}
            />
          }
          label="Allow substitutions (e.g. Vets cricket, where a twelfth man may fully bat/bowl)"
        />
      </Box>
    </Box>
  )
}
