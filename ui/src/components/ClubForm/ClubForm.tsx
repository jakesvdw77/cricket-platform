import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { Box } from '@mui/material'
import { Input } from '../Input'
import type { ClubPayload } from '../../api/clubApi'
import { deriveSlug, SLUG_PATTERN } from '../../utils/slug'

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
  // Once the admin has explicitly edited the slug (typed one in, or it arrived from
  // initialValues on edit — Club.slug is required, so an edit-mode club always has one already),
  // stop auto-deriving it from the name — never clobber a deliberate value.
  const [slugTouched, setSlugTouched] = useState(Boolean(initialValues?.slug))

  const handleNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    const name = event.target.value
    setValues((prev) => ({ ...prev, name, slug: slugTouched ? prev.slug : deriveSlug(name) }))
  }

  const handleSlugChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSlugTouched(true)
    setValues((prev) => ({ ...prev, slug: event.target.value }))
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
        onChange={handleNameChange}
        error={Boolean(errors.name)}
        helperText={errors.name}
      />
      <Input
        label="Slug"
        value={values.slug}
        onChange={handleSlugChange}
        error={Boolean(errors.slug)}
        helperText={
          errors.slug ??
          (!slugTouched && values.slug
            ? 'Auto-filled from name — edit to override'
            : 'Lowercase letters, numbers, and hyphens, e.g. riverside-cc')
        }
      />
    </Box>
  )
}
