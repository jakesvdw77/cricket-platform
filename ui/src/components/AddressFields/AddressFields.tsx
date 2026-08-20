import type { ChangeEvent } from 'react'
import { Input } from '../Input'
import type { Address } from '../../api/clubApi'

// Grouped field set for a postal address — number/street/city/province-state/country/postal
// code — modeled after ClubNameSlugFields' "props in, callbacks out, no internal fetching"
// shape, but with a single value/onChange pair rather than one callback per field: six
// individually-threaded callbacks would be unwieldy at this field count (a deliberate deviation
// from ClubNameSlugFields' precedent, see docs/plans/012-club-profile.md item 3). Every field is
// optional — no validation here, matching docs/specs/012-club-profile.md's "every address field
// is nullable" data model. Uses the generic `Address` type from clubApi.ts, not a Club-specific
// one, so the future Club Contacts and Sponsors specs can import and reuse this unchanged.
export interface AddressFieldsProps {
  value: Address
  onChange: (address: Address) => void
}

const FIELDS: Array<{ key: keyof Address; label: string }> = [
  { key: 'number', label: 'Number' },
  { key: 'street', label: 'Street' },
  { key: 'city', label: 'City' },
  { key: 'provinceState', label: 'Province/State' },
  { key: 'country', label: 'Country' },
  { key: 'postalCode', label: 'Postal code' },
]

export function AddressFields({ value, onChange }: AddressFieldsProps) {
  const handleChange = (key: keyof Address) => (event: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...value, [key]: event.target.value })
  }

  return (
    <>
      {FIELDS.map(({ key, label }) => (
        <Input key={key} label={label} value={value[key] ?? ''} onChange={handleChange(key)} />
      ))}
    </>
  )
}
