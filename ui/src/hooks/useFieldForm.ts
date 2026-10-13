import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getManagedClubProfile } from '../api/clubApi'
import type { PlayingArea, PlayingAreaPayload } from '../api/playingAreaApi'
import { browserDefaultCountry } from '../utils/countryFromTimeZone'
import { emptyFieldForm, fieldFormFromField, fieldFormToPayload, validateFieldForm } from '../utils/fieldForm'
import type { FieldFormErrors, FieldFormValues } from '../utils/fieldForm'

// docs/specs/099-fields-directory.md: the Country a new field starts with - the browser's time zone, then the locale
// region, then the club profile's own country (a name, mapped to ISO), then empty. The club profile is only fetched when
// the browser could not tell. Always a default, never a lock.
export function useDefaultFieldCountry(clubId: string | undefined, enabled = true): string {
  const fromBrowser = browserDefaultCountry()
  const { data: profile } = useQuery({
    queryKey: ['managed-club', clubId, 'profile'],
    queryFn: () => getManagedClubProfile(clubId as string),
    enabled: enabled && Boolean(clubId) && fromBrowser === '',
  })
  return fromBrowser || browserDefaultCountry(profile?.address?.country)
}

export interface FieldFormState {
  values: FieldFormValues
  errors: FieldFormErrors
  update: (patch: Partial<FieldFormValues>) => void
  // Validates and shows the errors; returns the payload when valid, otherwise null.
  submit: () => PlayingAreaPayload | null
}

// The state of the Add / Edit field form (docs/specs/099), used by the full page and by the add-field dialog.
export function useFieldForm(
  initial: PlayingArea | null | undefined,
  clubId: string | undefined,
  // Values a new form starts with (the add-field dialog starts with what was typed in the picker).
  seed?: Partial<FieldFormValues>,
): FieldFormState {
  const defaultCountry = useDefaultFieldCountry(clubId, !initial)
  const [values, setValues] = useState<FieldFormValues>(() => (initial ? fieldFormFromField(initial) : { ...emptyFieldForm(defaultCountry), ...seed }))
  const [errors, setErrors] = useState<FieldFormErrors>({})

  // The club profile may arrive after the form opens; fill an untouched (empty) Country then. The select has no empty
  // option, so an empty Country always means the manager has not chosen one.
  useEffect(() => {
    if (!initial && defaultCountry) {
      setValues((previous) => (previous.address.country ? previous : { ...previous, address: { ...previous.address, country: defaultCountry } }))
    }
  }, [initial, defaultCountry])

  const update = (patch: Partial<FieldFormValues>) => setValues((previous) => ({ ...previous, ...patch }))

  const submit = () => {
    const found = validateFieldForm(values)
    setErrors(found)
    return Object.keys(found).length > 0 ? null : fieldFormToPayload(values)
  }

  return { values, errors, update, submit }
}
