import type { ChangeEvent } from 'react'
import { Input } from '../Input'

// Thin wrapper around Input for a phone number — format-agnostic, no country-code
// enforcement in this pass (consistent with docs/specs/012-club-profile.md's "basic
// validation, not a full address/phone service" posture). Kept deliberately minimal and
// distinct from WebsiteInput (see WebsiteInput's protocol-normalization behaviour) so the
// two don't trip jscpd's duplicate-code scan (docs/standards/frontend.md).
export interface PhoneInputProps {
  label?: string
  value: string
  onChange: (value: string) => void
  error?: string
}

export function PhoneInput({ label = 'Phone', value, onChange, error }: PhoneInputProps) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)

  return (
    <Input
      label={label}
      type="tel"
      value={value}
      onChange={handleChange}
      error={Boolean(error)}
      helperText={error}
    />
  )
}
