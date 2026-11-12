import { countryName } from '../../../utils/countries'
import type { FieldDto } from '../../../api/myPlayersApi'

// docs/specs/121 (Field Directory): pure helpers for the hub's field cards and search.

// True only for a parseable https: URL; javascript:, data: and plain http are all refused.
export function isHttpsUrl(value: string | null | undefined): boolean {
  if (!value) return false
  try {
    return new URL(value.trim()).protocol === 'https:'
  } catch {
    return false
  }
}

const clean = (value: string | null | undefined) => (value ?? '').trim()

// "<line>, <city>, <province>, <postal code>, <country name>", leaving out whatever is empty.
export function joinAddress(field: Pick<FieldDto, 'addressLine1' | 'city' | 'provinceState' | 'postalCode' | 'country'>): string {
  return [field.addressLine1, field.city, field.provinceState, field.postalCode, countryName(field.country)].map(clean).filter(Boolean).join(', ')
}

// The address as lines for the card (owner, 2026-11-12): street, then "city, province postal code", then the country; empty parts are left out.
export function addressLines(field: Pick<FieldDto, 'addressLine1' | 'city' | 'provinceState' | 'postalCode' | 'country'>): string[] {
  const region = [clean(field.city), [clean(field.provinceState), clean(field.postalCode)].filter(Boolean).join(' ')].filter(Boolean).join(', ')
  return [clean(field.addressLine1), region, clean(countryName(field.country))].filter(Boolean)
}

export { countryName }

// Case-insensitive match over name, address and owner; a blank query matches everything.
export function matchesSearch(field: FieldDto, query: string): boolean {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  return [field.name, joinAddress(field), field.owner].some((part) => clean(part).toLowerCase().includes(needle))
}
