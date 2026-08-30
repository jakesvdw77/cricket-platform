import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { Box, Checkbox, FormControlLabel } from '@mui/material'
import { Input } from '../Input'
import type { SponsorContactPayload } from '../../api/sponsorContactApi'

// Stable id the <form> element renders with — RecordFormScreen's actions bar lives outside this
// component (see SponsorContactFormPage), so its Save button targets this form via the native
// HTML `form="…"` attribute, same pattern as CLUB_CONTACT_FORM_ID.
export const SPONSOR_CONTACT_FORM_ID = 'sponsor-contact-form'

export interface SponsorContactFormProps {
  initialValues?: Partial<SponsorContactPayload>
  onSubmit: (payload: SponsorContactPayload) => void
}

interface FormState {
  firstName: string
  lastName: string
  email: string
  phone: string
  role: string
  isPrimary: boolean
}

type FormErrors = Partial<Record<'firstName' | 'lastName' | 'email' | 'phone' | 'role', string>>

// Mirrors ClubContactForm's own client-side check for ContactDto's backend @Email annotation.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function toFormState(initialValues?: Partial<SponsorContactPayload>): FormState {
  return {
    firstName: initialValues?.contact?.firstName ?? '',
    lastName: initialValues?.contact?.lastName ?? '',
    email: initialValues?.contact?.email ?? '',
    phone: initialValues?.contact?.phone ?? '',
    role: initialValues?.role ?? '',
    isPrimary: initialValues?.isPrimary ?? false,
  }
}

// Mirrors ContactDto's backend rules — firstName/lastName/phone/role @NotBlank, email @NotBlank
// + @Email format (docs/plans/024-sponsor-contacts.md item 9), same as ClubContactForm's checks.
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

// Near-copy of ClubContactForm's pattern, not an import — SponsorContactPayload's shape differs
// (scoped to a sponsor, not a club) and this form deliberately has no MediaUpload/photo field
// (docs/specs/024-sponsor-contacts.md's Non-goals).
export function SponsorContactForm({ initialValues, onSubmit }: SponsorContactFormProps) {
  const [values, setValues] = useState<FormState>(() => toFormState(initialValues))
  const [errors, setErrors] = useState<FormErrors>({})

  const handleChange = (field: keyof FormErrors) => (event: ChangeEvent<HTMLInputElement>) => {
    setValues((prev) => ({ ...prev, [field]: event.target.value }))
  }

  const handlePrimaryChange = (event: ChangeEvent<HTMLInputElement>) => {
    setValues((prev) => ({ ...prev, isPrimary: event.target.checked }))
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const validationErrors = validate(values)
    setErrors(validationErrors)

    if (Object.keys(validationErrors).length > 0) {
      return
    }

    const payload: SponsorContactPayload = {
      contact: {
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        email: values.email.trim(),
        phone: values.phone.trim(),
      },
      role: values.role.trim(),
      isPrimary: values.isPrimary,
    }

    onSubmit(payload)
  }

  return (
    // display: 'contents' removes this <form> from the box tree so its children become direct
    // items of RecordFormScreen's field grid (see SponsorContactFormPage) — same pattern as
    // ClubContactForm's CLUB_CONTACT_FORM_ID.
    <Box
      component="form"
      id={SPONSOR_CONTACT_FORM_ID}
      onSubmit={handleSubmit}
      noValidate
      sx={{ display: 'contents' }}
    >
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
        helperText={errors.role ?? 'e.g. Marketing Contact, Account Manager'}
      />

      <Box sx={{ gridColumn: '1 / -1' }}>
        <FormControlLabel
          control={<Checkbox checked={values.isPrimary} onChange={handlePrimaryChange} />}
          label="Is primary contact"
        />
      </Box>
    </Box>
  )
}
