import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { Box, Checkbox, FormControlLabel } from '@mui/material'
import { Input } from '../Input'
import { MediaUpload } from '../MediaUpload'
import type { ClubContactPayload } from '../../api/clubContactApi'

// Stable id the <form> element renders with — RecordFormScreen's actions bar lives outside this
// component (see ClubContactFormPage), so its Save button targets this form via the native HTML
// `form="…"` attribute, same pattern as PRODUCT_FORM_ID/CLUB_FORM_ID.
export const CLUB_CONTACT_FORM_ID = 'club-contact-form'

export interface ClubContactFormProps {
  initialValues?: Partial<ClubContactPayload>
  onSubmit: (payload: ClubContactPayload) => void
}

interface FormState {
  firstName: string
  lastName: string
  email: string
  phone: string
  role: string
  isPrimary: boolean
  photoUrl: string | null
}

type FormErrors = Partial<Record<'firstName' | 'lastName' | 'email' | 'phone' | 'role', string>>

// Mirrors ClubForm's own client-side check for ContactDto's backend @Email annotation.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function toFormState(initialValues?: Partial<ClubContactPayload>): FormState {
  return {
    firstName: initialValues?.contact?.firstName ?? '',
    lastName: initialValues?.contact?.lastName ?? '',
    email: initialValues?.contact?.email ?? '',
    phone: initialValues?.contact?.phone ?? '',
    role: initialValues?.role ?? '',
    isPrimary: initialValues?.isPrimary ?? false,
    photoUrl: initialValues?.photoUrl ?? null,
  }
}

// Mirrors ContactDto's backend rules — firstName/lastName/phone/role @NotBlank, email @NotBlank
// + @Email format (docs/plans/021-club-contacts.md item 12).
function validate(values: FormState): FormErrors {
  const errors: FormErrors = {}

  if (!values.firstName.trim()) {
    errors.firstName = 'First name is required'
  }

  if (!values.lastName.trim()) {
    errors.lastName = 'Last name is required'
  }

  if (!values.email.trim()) {
    errors.email = 'Email is required'
  } else if (!EMAIL_PATTERN.test(values.email.trim())) {
    errors.email = 'Enter a valid email address'
  }

  if (!values.phone.trim()) {
    errors.phone = 'Phone is required'
  }

  if (!values.role.trim()) {
    errors.role = 'Role is required'
  }

  return errors
}

export function ClubContactForm({ initialValues, onSubmit }: ClubContactFormProps) {
  const [values, setValues] = useState<FormState>(() => toFormState(initialValues))
  const [errors, setErrors] = useState<FormErrors>({})

  const handleChange = (field: keyof FormErrors) => (event: ChangeEvent<HTMLInputElement>) => {
    setValues((prev) => ({ ...prev, [field]: event.target.value }))
  }

  const handlePrimaryChange = (event: ChangeEvent<HTMLInputElement>) => {
    setValues((prev) => ({ ...prev, isPrimary: event.target.checked }))
  }

  const handlePhotoUploaded = (photoUrl: string) => {
    setValues((prev) => ({ ...prev, photoUrl }))
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const validationErrors = validate(values)
    setErrors(validationErrors)

    if (Object.keys(validationErrors).length > 0) {
      return
    }

    const payload: ClubContactPayload = {
      contact: {
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        email: values.email.trim(),
        phone: values.phone.trim(),
      },
      role: values.role.trim(),
      isPrimary: values.isPrimary,
      photoUrl: values.photoUrl,
    }

    onSubmit(payload)
  }

  return (
    // display: 'contents' removes this <form> from the box tree so its children become direct
    // items of RecordFormScreen's field grid (see ClubContactFormPage) — same pattern as
    // ProductForm/ClubForm's PRODUCT_FORM_ID/CLUB_FORM_ID.
    <Box component="form" id={CLUB_CONTACT_FORM_ID} onSubmit={handleSubmit} noValidate sx={{ display: 'contents' }}>
      <Input
        label="First name"
        value={values.firstName}
        onChange={handleChange('firstName')}
        error={Boolean(errors.firstName)}
        helperText={errors.firstName}
      />
      <Input
        label="Last name"
        value={values.lastName}
        onChange={handleChange('lastName')}
        error={Boolean(errors.lastName)}
        helperText={errors.lastName}
      />
      <Input
        label="Email"
        type="email"
        value={values.email}
        onChange={handleChange('email')}
        error={Boolean(errors.email)}
        helperText={errors.email}
      />
      <Input
        label="Phone"
        value={values.phone}
        onChange={handleChange('phone')}
        error={Boolean(errors.phone)}
        helperText={errors.phone}
      />
      <Input
        label="Role"
        value={values.role}
        onChange={handleChange('role')}
        error={Boolean(errors.role)}
        helperText={errors.role ?? 'e.g. Chairman, Treasurer, Ground Manager'}
      />

      <Box sx={{ gridColumn: '1 / -1' }}>
        <FormControlLabel
          control={<Checkbox checked={values.isPrimary} onChange={handlePrimaryChange} />}
          label="Is primary contact"
        />
      </Box>

      <Box sx={{ gridColumn: '1 / -1' }}>
        <MediaUpload
          label="Photo"
          value={values.photoUrl}
          onUploaded={handlePhotoUploaded}
          variant="logo"
          namespace="manage"
        />
      </Box>
    </Box>
  )
}
