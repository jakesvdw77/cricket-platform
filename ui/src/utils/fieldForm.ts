import type { Address } from '../api/clubApi'
import type { FieldCategory, FieldOwnerType, PlayingArea, PlayingAreaPayload } from '../api/playingAreaApi'
import { OWNER_TYPE_FOR_CATEGORY } from './fieldLabels'

// docs/specs/099-fields-directory.md: the values, validation and payload of the Add / Edit field form, shared by the full page
// (FieldFormPage, the admin's edit page) and the add-field dialog of the match form's picker (one body, not two copies).
export interface FieldFormValues {
  name: string
  category: FieldCategory
  // null = follows the Type until the manager chooses one (the add-field dialog never asks).
  ownerType: FieldOwnerType | null
  ownerName: string
  address: Address
  mapUrl: string
  locationNotes: string
  // docs/specs/133: decimal degrees typed as text (empty = not set), and the optional entrance or parking point with its note.
  latitude: string
  longitude: string
  accessLatitude: string
  accessLongitude: string
  accessNote: string
}

export type FieldFormErrors = Partial<
  Record<'name' | 'ownerName' | 'street' | 'city' | 'country' | 'mapUrl' | 'locationNotes' | 'latitude' | 'longitude' | 'accessLatitude' | 'accessLongitude' | 'accessNote', string>
>

export const MAX_NAME_LENGTH = 200
export const MAX_MAP_URL_LENGTH = 500
export const MAX_NOTES_LENGTH = 500
export const MAX_ACCESS_NOTE_LENGTH = 200

export function emptyFieldForm(country = ''): FieldFormValues {
  return {
    name: '',
    category: 'CLUB',
    ownerType: null,
    ownerName: '',
    address: { number: null, street: '', city: '', provinceState: '', country, postalCode: '' },
    mapUrl: '',
    locationNotes: '',
    latitude: '',
    longitude: '',
    accessLatitude: '',
    accessLongitude: '',
    accessNote: '',
  }
}

// A stored coordinate as the text of its input (at most 6 decimals, no trailing zeros).
export const coordinateText = (value: number | null | undefined): string => (typeof value === 'number' && Number.isFinite(value) ? String(Number(value.toFixed(6))) : '')

// docs/specs/133: a typed coordinate, or null when empty or not a plain decimal number.
const DECIMAL = /^-?\d+(?:\.\d+)?$/
export function parseCoordinate(text: string): number | null {
  const trimmed = text.trim()
  return DECIMAL.test(trimmed) ? Number(trimmed) : null
}

type Axis = 'latitude' | 'longitude'
const LIMIT: Record<Axis, number> = { latitude: 90, longitude: 180 }

function coordinateError(text: string, axis: Axis): string | null {
  const trimmed = text.trim()
  if (!trimmed) return null
  const value = parseCoordinate(trimmed)
  if (value === null) return 'Enter a number such as -26.1234'
  if (Math.abs(value) > LIMIT[axis]) return `${axis === 'latitude' ? 'Latitude' : 'Longitude'} must be between -${LIMIT[axis]} and ${LIMIT[axis]}`
  return null
}

// Both or neither, each in range. `keys` picks the field's own pair or the access point's.
function pairErrors(latText: string, lngText: string, keys: { lat: 'latitude' | 'accessLatitude'; lng: 'longitude' | 'accessLongitude' }): FieldFormErrors {
  const errors: FieldFormErrors = {}
  const latError = coordinateError(latText, 'latitude')
  const lngError = coordinateError(lngText, 'longitude')
  if (latError) errors[keys.lat] = latError
  if (lngError) errors[keys.lng] = lngError
  const hasLat = latText.trim() !== ''
  const hasLng = lngText.trim() !== ''
  if (hasLat && !hasLng) errors[keys.lng] = 'Enter the longitude too, or clear the latitude'
  if (hasLng && !hasLat) errors[keys.lat] = 'Enter the latitude too, or clear the longitude'
  return errors
}

export function fieldFormFromField(field: PlayingArea): FieldFormValues {
  return {
    name: field.name,
    category: field.category,
    ownerType: field.ownerType,
    ownerName: field.ownerName,
    address: {
      number: field.address.number ?? null,
      street: field.address.street ?? '',
      city: field.address.city ?? '',
      provinceState: field.address.provinceState ?? '',
      country: field.address.country ?? '',
      postalCode: field.address.postalCode ?? '',
    },
    mapUrl: field.mapUrl ?? '',
    locationNotes: field.locationNotes ?? '',
    latitude: coordinateText(field.latitude),
    longitude: coordinateText(field.longitude),
    accessLatitude: coordinateText(field.accessLatitude),
    accessLongitude: coordinateText(field.accessLongitude),
    accessNote: field.accessNote ?? '',
  }
}

export const effectiveOwnerType = (values: Pick<FieldFormValues, 'category' | 'ownerType'>): FieldOwnerType =>
  values.ownerType ?? OWNER_TYPE_FOR_CATEGORY[values.category]

// The map link is optional; when given it must be an https address (the server refuses javascript: and data: too).
export function validateMapUrl(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.length > MAX_MAP_URL_LENGTH) return 'Link must be 500 characters or fewer'
  try {
    const url = new URL(trimmed)
    if (url.protocol !== 'https:') return 'Use a link that starts with https://'
  } catch {
    return 'Use a link that starts with https://'
  }
  return null
}

export function validateFieldForm(values: FieldFormValues): FieldFormErrors {
  const errors: FieldFormErrors = {}
  if (!values.name.trim()) errors.name = 'Name is required'
  else if (values.name.trim().length > MAX_NAME_LENGTH) errors.name = 'Name must be 200 characters or fewer'
  if (!values.ownerName.trim()) errors.ownerName = 'Owner is required'
  if (!(values.address.city ?? '').trim()) errors.city = 'City is required'
  if (!(values.address.country ?? '').trim()) errors.country = 'Country is required'
  const mapError = validateMapUrl(values.mapUrl)
  if (mapError) errors.mapUrl = mapError
  if (values.locationNotes.trim().length > MAX_NOTES_LENGTH) errors.locationNotes = 'Notes must be 500 characters or fewer'
  Object.assign(errors, pairErrors(values.latitude, values.longitude, { lat: 'latitude', lng: 'longitude' }))
  Object.assign(errors, pairErrors(values.accessLatitude, values.accessLongitude, { lat: 'accessLatitude', lng: 'accessLongitude' }))
  const note = values.accessNote.trim()
  if (note.length > MAX_ACCESS_NOTE_LENGTH) errors.accessNote = 'Note must be 200 characters or fewer'
  else if (note && !values.accessLatitude.trim() && !values.accessLongitude.trim()) errors.accessNote = 'Add the entrance or parking position for this note'
  return errors
}

const orNull = (value: string | null | undefined): string | null => (value && value.trim() ? value.trim() : null)

export function fieldFormToPayload(values: FieldFormValues): PlayingAreaPayload {
  return {
    name: values.name.trim(),
    category: values.category,
    ownerType: effectiveOwnerType(values),
    ownerName: values.ownerName.trim(),
    address: {
      number: orNull(values.address.number),
      street: orNull(values.address.street),
      city: orNull(values.address.city),
      provinceState: orNull(values.address.provinceState),
      country: orNull(values.address.country),
      postalCode: orNull(values.address.postalCode),
    },
    mapUrl: orNull(values.mapUrl),
    locationNotes: orNull(values.locationNotes),
    latitude: parseCoordinate(values.latitude),
    longitude: parseCoordinate(values.longitude),
    accessLatitude: parseCoordinate(values.accessLatitude),
    accessLongitude: parseCoordinate(values.accessLongitude),
    accessNote: orNull(values.accessNote),
  }
}

// The 409 DuplicateField response is a ProblemDetail carrying `existingPlayingAreaId`; the id, or null for any other error.
export function duplicateFieldId(error: unknown): string | null {
  const data = (error as { response?: { status?: number; data?: { existingPlayingAreaId?: unknown } } })?.response
  if (data?.status === 409 && typeof data.data?.existingPlayingAreaId === 'string') return data.data.existingPlayingAreaId
  return null
}
