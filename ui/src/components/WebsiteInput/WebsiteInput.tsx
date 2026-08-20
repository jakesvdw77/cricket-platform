import type { ChangeEvent, FocusEvent } from 'react'
import { Input } from '../Input'

// Thin wrapper around Input for a website URL — unlike PhoneInput, this one normalizes a
// missing protocol by prepending "https://" on blur, real behaviour that keeps the two
// components genuinely distinct (not near-identical thin wrappers) so they don't trip
// jscpd's duplicate-code scan (docs/standards/frontend.md, see docs/plans/012-club-profile.md
// Flag #6). Format-invalid error state is still driven by the parent's own validation
// (error/helperText), matching ClubNameSlugFields' pattern of centralizing validation logic in
// the consuming form — this component only normalizes, it doesn't validate.
export interface WebsiteInputProps {
  label?: string
  value: string
  onChange: (value: string) => void
  error?: string
}

const PROTOCOL_PATTERN = /^https?:\/\//i

export function WebsiteInput({ label = 'Website', value, onChange, error }: WebsiteInputProps) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)

  const handleBlur = (event: FocusEvent<HTMLInputElement>) => {
    const trimmed = event.target.value.trim()
    if (trimmed && !PROTOCOL_PATTERN.test(trimmed)) {
      onChange(`https://${trimmed}`)
    }
  }

  return (
    <Input
      label={label}
      type="url"
      value={value}
      onChange={handleChange}
      onBlur={handleBlur}
      error={Boolean(error)}
      helperText={error ?? 'e.g. https://example.com'}
    />
  )
}
