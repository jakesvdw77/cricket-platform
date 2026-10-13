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
}

export type FieldFormErrors = Partial<
  Record<'name' | 'ownerName' | 'street' | 'city' | 'country' | 'mapUrl' | 'locationNotes', string>
>

export const MAX_NAME_LENGTH = 200
export const MAX_MAP_URL_LENGTH = 500
export const MAX_NOTES_LENGTH = 500

export function emptyFieldForm(country = ''): FieldFormValues {
  return {
    name: '',
    category: 'CLUB',
    ownerType: null,
    ownerName: '',
    address: { number: null, street: '', city: '', provinceState: '', country, postalCode: '' },
    mapUrl: '',
    locationNotes: '',
  }
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
  }
}

// The 409 DuplicateField response is a ProblemDetail carrying `existingPlayingAreaId`; the id, or null for any other error.
export function duplicateFieldId(error: unknown): string | null {
  const data = (error as { response?: { status?: number; data?: { existingPlayingAreaId?: unknown } } })?.response
  if (data?.status === 409 && typeof data.data?.existingPlayingAreaId === 'string') return data.data.existingPlayingAreaId
  return null
}
