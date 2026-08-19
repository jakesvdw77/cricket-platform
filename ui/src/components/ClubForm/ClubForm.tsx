import { useState } from 'react'
import type { FormEvent } from 'react'
import { Box } from '@mui/material'
import { ClubNameSlugFields } from '../ClubNameSlugFields'
import type { ClubPayload } from '../../api/clubApi'
import { deriveSlug, validateSlug } from '../../utils/slug'

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

  const slugError = validateSlug(values.slug)
  if (slugError) {
    errors.slug = slugError
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

  const handleNameChange = (name: string) => {
    setValues((prev) => ({ ...prev, name, slug: slugTouched ? prev.slug : deriveSlug(name) }))
  }

  const handleSlugChange = (slug: string) => {
    setSlugTouched(true)
    setValues((prev) => ({ ...prev, slug }))
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
      <ClubNameSlugFields
        name={values.name}
        slug={values.slug}
        slugTouched={slugTouched}
        nameError={errors.name}
        slugError={errors.slug}
        onNameChange={handleNameChange}
        onSlugChange={handleSlugChange}
      />
    </Box>
  )
}
