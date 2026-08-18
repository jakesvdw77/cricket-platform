import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { Box } from '@mui/material'
import { Input } from '../Input'
import type { ClubPayload } from '../../api/clubApi'

// Stable id the <form> element renders with — RecordFormScreen's actions bar lives outside
// this component (see ClubFormPage), so its Save button targets this form via the native
// HTML `form="…"` attribute rather than nesting a submit button inside the field grid.
export const CLUB_FORM_ID = 'club-form'

export interface ClubFormProps {
  initialValues?: Partial<ClubPayload>
  onSubmit: (values: ClubPayload) => void
}

interface FormState {
  name: string
  slug: string
}

type FormErrors = Partial<Record<keyof FormState, string>>

// Mirrors the backend's CreateClubRequest/UpdateClubRequest @Pattern — lowercase alphanumeric
// segments joined by single hyphens, no leading/trailing/doubled hyphens.
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/

function toFormState(initialValues?: Partial<ClubPayload>): FormState {
  return {
    name: initialValues?.name ?? '',
    slug: initialValues?.slug ?? '',
  }
}

function validate(values: FormState): FormErrors {
  const errors: FormErrors = {}

  if (!values.name.trim()) {
    errors.name = 'Name is required'
  }

  const slug = values.slug.trim()
  if (!slug) {
    errors.slug = 'Slug is required'
  } else if (slug.length < 3 || slug.length > 63) {
    errors.slug = 'Slug must be between 3 and 63 characters'
  } else if (!SLUG_PATTERN.test(slug)) {
    errors.slug = 'Use lowercase letters, numbers, and single hyphens, e.g. riverside-cc'
  }

  return errors
}

export function ClubForm({ initialValues, onSubmit }: ClubFormProps) {
  const [values, setValues] = useState<FormState>(() => toFormState(initialValues))
  const [errors, setErrors] = useState<FormErrors>({})

  const handleChange = (field: keyof FormState) => (event: ChangeEvent<HTMLInputElement>) => {
    setValues((prev) => ({ ...prev, [field]: event.target.value }))
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const validationErrors = validate(values)
    setErrors(validationErrors)

    if (Object.keys(validationErrors).length > 0) {
      return
    }

    const payload: ClubPayload = {
      name: values.name.trim(),
      slug: values.slug.trim(),
    }

    onSubmit(payload)
  }

  return (
    // display: 'contents' removes this <form> from the box tree so its children become direct
    // items of RecordFormScreen's field grid (see ClubFormPage) — the native <form>/onSubmit
    // wiring still works, submission is just triggered from outside via CLUB_FORM_ID.
    <Box component="form" id={CLUB_FORM_ID} onSubmit={handleSubmit} noValidate sx={{ display: 'contents' }}>
      <Input
        label="Name"
        value={values.name}
        onChange={handleChange('name')}
        error={Boolean(errors.name)}
        helperText={errors.name}
      />
      <Input
        label="Slug"
        value={values.slug}
        onChange={handleChange('slug')}
        error={Boolean(errors.slug)}
        helperText={errors.slug ?? 'Lowercase letters, numbers, and hyphens, e.g. riverside-cc'}
      />
    </Box>
  )
}
