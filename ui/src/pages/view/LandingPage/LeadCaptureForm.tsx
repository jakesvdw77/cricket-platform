import { useState } from 'react'
import type { FormEvent } from 'react'
import { Box, Stack, Typography } from '@mui/material'
import { useMutation } from '@tanstack/react-query'
import { Input } from '../../../components/Input'
import { Button } from '../../../components/Button'
import { EmptyState } from '../../../components/EmptyState'
import { submitLead } from '../../../api/leadApi'
import type { SubmitLeadPayload } from '../../../api/leadApi'

interface FormState {
  name: string
  email: string
  clubName: string
  phone: string
  message: string
}

const initialState: FormState = {
  name: '',
  email: '',
  clubName: '',
  phone: '',
  message: '',
}

type FormErrors = Partial<Record<keyof FormState, string>>

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validate(values: FormState): FormErrors {
  const errors: FormErrors = {}

  if (!values.name.trim()) {
    errors.name = 'Name is required'
  }

  if (!values.email.trim()) {
    errors.email = 'Email is required'
  } else if (!EMAIL_PATTERN.test(values.email.trim())) {
    errors.email = 'Enter a valid email address'
  }

  if (!values.clubName.trim()) {
    errors.clubName = 'Club name is required'
  }

  return errors
}

export default function LeadCaptureForm() {
  const [values, setValues] = useState<FormState>(initialState)
  const [errors, setErrors] = useState<FormErrors>({})

  const mutation = useMutation({
    mutationFn: (payload: SubmitLeadPayload) => submitLead(payload),
  })

  const handleChange = (field: keyof FormState) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setValues((prev) => ({ ...prev, [field]: event.target.value }))
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const validationErrors = validate(values)
    setErrors(validationErrors)

    if (Object.keys(validationErrors).length > 0) {
      return
    }

    mutation.mutate({
      name: values.name.trim(),
      email: values.email.trim(),
      clubName: values.clubName.trim(),
      phone: values.phone.trim() || undefined,
      message: values.message.trim() || undefined,
    })
  }

  if (mutation.isSuccess) {
    return <EmptyState title="Thanks — we'll be in touch" description="A member of our team will follow up with you shortly." />
  }

  return (
    <Box component="form" onSubmit={handleSubmit} noValidate sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Input
        label="Name"
        value={values.name}
        onChange={handleChange('name')}
        error={Boolean(errors.name)}
        helperText={errors.name}
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
        label="Club name"
        value={values.clubName}
        onChange={handleChange('clubName')}
        error={Boolean(errors.clubName)}
        helperText={errors.clubName}
      />
      <Input label="Phone (optional)" value={values.phone} onChange={handleChange('phone')} />
      <Input
        label="Message (optional)"
        value={values.message}
        onChange={handleChange('message')}
        multiline
        minRows={3}
      />

      {mutation.isError && (
        <Typography variant="body2" color="error.main">
          Something went wrong submitting your details. Please try again.
        </Typography>
      )}

      <Stack direction="row" justifyContent="flex-end">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Submitting…' : 'Get started'}
        </Button>
      </Stack>
    </Box>
  )
}
