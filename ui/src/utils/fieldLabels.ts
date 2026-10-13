import type { FieldCategory, FieldOwnerType, PlayingArea } from '../api/playingAreaApi'

// docs/specs/099-fields-directory.md: the words for a field's Type (category) and Owner type. "Playing area" and
// "ground" never appear on screen.
export const FIELD_CATEGORY_LABEL: Record<FieldCategory, string> = {
  SCHOOL: 'School',
  CLUB: 'Club',
  ACADEMY: 'Academy',
  MUNICIPAL: 'Municipal',
  PROVINCIAL: 'Provincial',
}

export const FIELD_CATEGORIES: FieldCategory[] = ['SCHOOL', 'CLUB', 'ACADEMY', 'MUNICIPAL', 'PROVINCIAL']

export const FIELD_OWNER_TYPE_LABEL: Record<FieldOwnerType, string> = {
  CLUB: 'Club',
  SCHOOL: 'School',
  PROVINCE: 'Province',
  OTHER: 'Other',
}

export const FIELD_OWNER_TYPES: FieldOwnerType[] = ['CLUB', 'SCHOOL', 'PROVINCE', 'OTHER']

// The add-field dialog does not ask for an owner type, so it follows the Type the manager picked.
export const OWNER_TYPE_FOR_CATEGORY: Record<FieldCategory, FieldOwnerType> = {
  SCHOOL: 'SCHOOL',
  CLUB: 'CLUB',
  ACADEMY: 'OTHER',
  MUNICIPAL: 'OTHER',
  PROVINCIAL: 'PROVINCE',
}

// "Hilton, KwaZulu-Natal": the city and the province/county/state when there is one.
export function cityLine(field: Pick<PlayingArea, 'address'>): string {
  return [field.address.city, field.address.provinceState].filter(Boolean).join(', ')
}
