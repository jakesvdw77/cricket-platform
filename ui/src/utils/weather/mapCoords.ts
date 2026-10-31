import type { Address } from '../../api/clubApi'
import type { Coordinates, PlaceQuery } from '../../api/weatherApi'

// docs/specs/131-match-sharing.md (Weather, coordinates): step 1 of the order, latitude and longitude read out of the
// field's map URL, as the legacy app did. Short links (maps.app.goo.gl, goo.gl/maps) cannot be resolved in the browser and give null.
const inRange = (lat: number, lng: number): boolean => Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180

const PATTERNS: RegExp[] = [
  /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
  /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,
  /[?&](?:q|ll|query)=(-?\d+(?:\.\d+)?)(?:,|%2C)(-?\d+(?:\.\d+)?)/i,
]

export function parseMapCoords(mapUrl: string | null | undefined): Coordinates | null {
  if (!mapUrl) return null
  for (const pattern of PATTERNS) {
    const found = pattern.exec(mapUrl)
    if (found) {
      const lat = Number(found[1])
      const lng = Number(found[2])
      if (inRange(lat, lng)) return { lat, lng }
    }
  }
  return null
}

// Step 2: the address as a place to geocode (city, province or state, country), or null when there is no city.
export function placeFromAddress(address: Pick<Address, 'city' | 'provinceState' | 'country'> | null | undefined): PlaceQuery | null {
  const city = address?.city?.trim()
  if (!city) return null
  const country = address?.country?.trim() ?? ''
  return {
    city,
    provinceState: address?.provinceState?.trim() || null,
    countryCode: /^[A-Za-z]{2}$/.test(country) ? country.toUpperCase() : null,
  }
}

// The cache key of a place: the whole place string, lower case.
export const placeKey = (place: PlaceQuery): string =>
  [place.city, place.provinceState, place.countryCode].filter(Boolean).join(', ').toLowerCase()
