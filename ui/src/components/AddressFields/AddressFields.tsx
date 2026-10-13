import { Fragment } from 'react'
import type { ChangeEvent } from 'react'
import { Box, MenuItem } from '@mui/material'
import { Input } from '../Input'
import type { Address } from '../../api/clubApi'
import { countryOptions, provinceLabel } from '../../utils/countries'

// Grouped field set for a postal address — number/street/city/province-state/country/postal
// code — modeled after ClubNameSlugFields' "props in, callbacks out, no internal fetching"
// shape, but with a single value/onChange pair rather than one callback per field: six
// individually-threaded callbacks would be unwieldy at this field count (a deliberate deviation
// from ClubNameSlugFields' precedent, see docs/plans/012-club-profile.md item 3). Every field is
// optional — no validation here, matching docs/specs/012-club-profile.md's "every address field
// is nullable" data model. Uses the generic `Address` type from clubApi.ts, not a Club-specific
// one, so the future Club Contacts and Sponsors specs can import and reuse this unchanged.
//
// docs/specs/099-fields-directory.md: the Fields form extends it with optional props - Country as a selector over ISO
// codes (the value is then the code, and the province label follows the country), the fields to show and their order,
// which are wider or optional, and per-field errors. Called without them (ClubForm) it renders exactly as before.
export type AddressFieldKey = keyof Address

export interface AddressFieldsProps {
  value: Address
  onChange: (address: Address) => void
  // Country as a select over ISO 3166-1 alpha-2 codes (shown by name), and a province label that follows it.
  isoCountry?: boolean
  // Which fields to render, in order. Default: all six, in the original order.
  fields?: AddressFieldKey[]
  // Fields that span two columns of a three-column parent grid from md.
  wide?: AddressFieldKey[]
  // The breakpoint the wide fields start spanning two columns from (md, the Fields page's three-column grid; sm for the
  // add-field dialog's two-column grid).
  wideFrom?: 'sm' | 'md'
  // Fields whose label ends in "(optional)".
  optional?: AddressFieldKey[]
  errors?: Partial<Record<AddressFieldKey, string>>
  // Shown under the Country field.
  countryHelperText?: string
  disabled?: boolean
}

const ALL_FIELDS: AddressFieldKey[] = ['number', 'street', 'city', 'provinceState', 'country', 'postalCode']

const LABELS: Record<AddressFieldKey, string> = {
  number: 'Number',
  street: 'Street',
  city: 'City',
  provinceState: 'Province/State',
  country: 'Country',
  postalCode: 'Postal code',
}

export function AddressFields({
  value,
  onChange,
  isoCountry = false,
  fields = ALL_FIELDS,
  wide = [],
  wideFrom = 'md',
  optional = [],
  errors = {},
  countryHelperText,
  disabled = false,
}: AddressFieldsProps) {
  const handleChange = (key: AddressFieldKey) => (event: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...value, [key]: event.target.value })
  }

  const labelFor = (key: AddressFieldKey) => {
    const base = key === 'provinceState' && isoCountry ? (provinceLabel(value.country)) : LABELS[key]
    return optional.includes(key) ? `${base} (optional)` : base
  }

  return (
    <>
      {fields.map((key) => {
        const common = {
          label: labelFor(key),
          error: Boolean(errors[key]),
          helperText: errors[key] ?? (key === 'country' ? countryHelperText : undefined),
          disabled,
        }
        const input =
          key === 'country' && isoCountry ? (
            <Input
              {...common}
              select
              value={value.country ?? ''}
              onChange={(event) => onChange({ ...value, country: event.target.value })}
            >
              {countryOptions().map((option) => (
                <MenuItem key={option.code} value={option.code}>
                  {option.name}
                </MenuItem>
              ))}
            </Input>
          ) : (
            <Input {...common} value={value[key] ?? ''} onChange={handleChange(key)} />
          )
        // A wide field gets its own grid cell wrapper so it can span two columns; every other field is returned bare,
        // which keeps the markup of the original (ClubForm) call unchanged.
        return wide.includes(key) ? (
          <Box key={key} sx={{ gridColumn: { [wideFrom]: 'span 2' }, minWidth: 0 }}>
            {input}
          </Box>
        ) : (
          <Fragment key={key}>{input}</Fragment>
        )
      })}
    </>
  )
}
