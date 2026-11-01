import { useQuery } from '@tanstack/react-query'
import { geocodePlace } from '../api/weatherApi'
import type { Coordinates } from '../api/weatherApi'
import { directionsTarget, resolveFieldLocation } from '../utils/fieldLocation'
import type { DirectionsTarget, LocatableField, ResolvedLocation } from '../utils/fieldLocation'
import { placeFromAddress, placeKey } from '../utils/weather/mapCoords'

const GEOCODE_STALE = 30 * 24 * 60 * 60 * 1000

export interface FieldLocation extends ResolvedLocation {
  // The town is still being looked up.
  loading: boolean
  townPoint: Coordinates | null
}

// docs/specs/133: the chain of `resolveFieldLocation` with the town step done for the caller. The geocoding request is made only
// when `enabled`, nothing is stored, the map URL gives nothing and the address has a city; it is cached by place for a long time.
// The access point is for directions only and plays no part here, so the forecast never uses it.
export function useFieldLocation(field: LocatableField | null | undefined, enabled = true): FieldLocation {
  const known = resolveFieldLocation(field).point !== null
  const place = known ? null : placeFromAddress(field?.address)
  const geocode = useQuery({
    queryKey: ['weather', 'geocode', place ? placeKey(place) : ''],
    queryFn: () => geocodePlace(place as NonNullable<typeof place>),
    enabled: enabled && place !== null,
    staleTime: GEOCODE_STALE,
    gcTime: GEOCODE_STALE,
    refetchOnWindowFocus: false,
    retry: false,
  })
  const townPoint = geocode.data ?? null
  return { ...resolveFieldLocation(field, townPoint), townPoint, loading: place !== null && geocode.isLoading }
}

// The Get Directions destination of a field (access point first), or null while nothing resolves.
export function useDirectionsTarget(field: LocatableField | null | undefined, enabled = true): DirectionsTarget | null {
  const { townPoint } = useFieldLocation(field, enabled)
  return directionsTarget(field, townPoint)
}
