import type { ChangeEvent, FocusEvent } from 'react'
import { Input } from '../Input'

// Thin wrapper around Input for an email address. Like WebsiteInput's protocol-normalization
// precedent, this one has one real piece of distinguishing behaviour rather than being a bare
// PhoneInput copy (docs/standards/frontend.md's duplicate-code rule, see
// docs/specs/014-subscription-responsible-contact.md's UI Requirements): it trims and lowercases
// the value on blur — a genuinely useful normalization since email addresses are
// case-insensitive by convention and frequently pasted with stray whitespace or capitals.
// Format-invalid error state is still driven by the parent's own validation (error/helperText),
// matching WebsiteInput's pattern of centralizing validation logic in the consuming form — this
// component only normalizes, it doesn't validate.
export interface EmailInputProps {
  label?: string
  value: string
  onChange: (value: string) => void
  error?: string
}

export function EmailInput({ label = 'Email', value, onChange, error }: EmailInputProps) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)

  const handleBlur = (event: FocusEvent<HTMLInputElement>) => {
    const normalized = event.target.value.trim().toLowerCase()
    if (normalized !== event.target.value) {
      onChange(normalized)
    }
  }

  return (
    <Input
      label={label}
      type="email"
      value={value}
      onChange={handleChange}
      onBlur={handleBlur}
      error={Boolean(error)}
      helperText={error}
    />
  )
}
