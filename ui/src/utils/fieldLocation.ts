import type { Address } from '../api/clubApi'
import type { Coordinates } from '../api/weatherApi'
import { parseMapCoords } from './weather/mapCoords'

// docs/specs/133-field-location-and-directions.md: the one resolution chain for the forecast and for directions. In order:
// (1) the coordinates stored on the field, (2) the position read out of its map URL, (3) the geocoded town centre (a lookup the
// caller does and passes in), (4) nothing. Pure; no React and no network.
export type LocationSource = 'STORED' | 'MAP_URL' | 'TOWN'

export interface LocatableField {
  name?: string | null
  mapUrl?: string | null
  address?: Partial<Pick<Address, 'number' | 'street' | 'city' | 'provinceState' | 'country' | 'postalCode'>> | null
  latitude?: number | null
  longitude?: number | null
  accessLatitude?: number | null
  accessLongitude?: number | null
  accessNote?: string | null
}

export interface ResolvedLocation {
  point: Coordinates | null
  source: LocationSource | null
}

const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

export function storedPoint(latitude: number | null | undefined, longitude: number | null | undefined): Coordinates | null {
  return isNumber(latitude) && isNumber(longitude) ? { lat: latitude, lng: longitude } : null
}

// `townPoint` is the geocoded town centre when the caller has looked it up; it is used only when nothing else resolves.
export function resolveFieldLocation(field: LocatableField | null | undefined, townPoint?: Coordinates | null): ResolvedLocation {
  const stored = storedPoint(field?.latitude, field?.longitude)
  if (stored) return { point: stored, source: 'STORED' }
  const fromUrl = parseMapCoords(field?.mapUrl)
  if (fromUrl) return { point: fromUrl, source: 'MAP_URL' }
  if (townPoint) return { point: townPoint, source: 'TOWN' }
  return { point: null, source: null }
}

// True when a town lookup is worth making: nothing stored and nothing in the map URL.
export const needsTownLookup = (field: LocatableField | null | undefined): boolean => resolveFieldLocation(field).point === null

export interface DirectionsTarget {
  point: Coordinates
  // The point is a town centre or read from a link, not a surveyed position.
  approximate: boolean
  // The destination is the field's entrance or parking point.
  viaAccess: boolean
  name: string
  accessNote: string | null
  // What Copy Address puts on the clipboard: the name, the address lines and the access note.
  addressText: string
}

export function addressLines(address: LocatableField['address']): string[] {
  if (!address) return []
  const street = [address.number, address.street].filter(Boolean).join(' ')
  const region = [address.city, address.provinceState].filter(Boolean).join(', ')
  return [street, [region, address.postalCode].filter(Boolean).join(' '), address.country].map((line) => (line ?? '').trim()).filter(Boolean)
}

export function copyAddressText(field: LocatableField | null | undefined): string {
  const note = field?.accessNote?.trim()
  return [field?.name?.trim(), ...addressLines(field?.address), note ? `Access: ${note}` : null].filter(Boolean).join('\n')
}

// Where Get Directions goes: the access point when set, else the resolved point. null when nothing resolves.
export function directionsTarget(field: LocatableField | null | undefined, townPoint?: Coordinates | null): DirectionsTarget | null {
  if (!field) return null
  const access = storedPoint(field.accessLatitude, field.accessLongitude)
  const resolved = resolveFieldLocation(field, townPoint)
  const point = access ?? resolved.point
  if (!point) return null
  return {
    point,
    approximate: !access && resolved.source !== 'STORED',
    viaAccess: access !== null,
    name: field.name?.trim() || 'The field',
    accessNote: field.accessNote?.trim() || null,
    addressText: copyAddressText(field),
  }
}
