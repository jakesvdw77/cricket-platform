import { useQuery } from '@tanstack/react-query'
import { fetchDailyForecast } from '../api/weatherApi'
import { getPlayingArea, playingAreasKey } from '../api/playingAreaApi'
import { localDateIso, inForecastRange } from '../utils/weather/forecastWindow'
import { storedPoint } from '../utils/fieldLocation'
import type { DirectionsTarget, LocatableField } from '../utils/fieldLocation'
import { useDirectionsTarget, useFieldLocation } from './useFieldLocation'
import { summariseForecast } from '../utils/weather/wmo'
import type { WeatherSummary } from '../utils/weather/wmo'
import type { Match } from '../api/matchApi'

// docs/specs/131-match-sharing.md (Weather) and 133: the forecast for a match day at a field. Coordinates come, in this order, from
// (1) the coordinates stored on the field, (2) its map URL, (3) the Open-Meteo geocoding of the address city (cached by place for a
// long time), (4) nothing: then no weather is shown, never a guess. The access point is for directions only. Nothing is requested
// for a past date, for a date more than 6 days ahead, or when the field gives no usable place. A failed fetch is quiet and retried later.

export type WeatherField = LocatableField

export type MatchWeatherStatus = 'ready' | 'loading' | 'none'

export interface MatchWeather {
  status: MatchWeatherStatus
  summary: WeatherSummary | null
}

const LONG = 6 * 60 * 60 * 1000
const NONE: MatchWeather = { status: 'none', summary: null }

export function useMatchWeather(matchDate: string | null | undefined, field: WeatherField | null | undefined, now?: Date): MatchWeather {
  const inRange = Boolean(matchDate) && inForecastRange(matchDate as string, now)
  const location = useFieldLocation(field, inRange)
  const coords = location.point
  const date = inRange ? localDateIso(matchDate as string) : ''

  const forecast = useQuery({
    queryKey: ['weather', 'forecast', coords ? coords.lat.toFixed(2) : '', coords ? coords.lng.toFixed(2) : '', date],
    queryFn: () => fetchDailyForecast(coords as NonNullable<typeof coords>, date),
    enabled: inRange && coords !== null,
    staleTime: LONG,
    refetchOnWindowFocus: false,
    retry: false,
  })

  if (!inRange) return NONE
  if (forecast.data) return { status: 'ready', summary: summariseForecast(forecast.data) }
  const waiting = location.loading || (coords !== null && forecast.isLoading)
  return waiting ? { status: 'loading', summary: null } : NONE
}

// docs/specs/133: what a match tells about its field's position without a request: the stored coordinates and access point on
// the match itself (MatchDto and the Player Hub rows carry them).
export interface MatchFieldPosition {
  playingAreaName?: string | null
  venue?: string | null
  playingAreaLatitude?: number | null
  playingAreaLongitude?: number | null
  playingAreaAccessLatitude?: number | null
  playingAreaAccessLongitude?: number | null
  playingAreaAccessNote?: string | null
}

export function fieldFromMatch(match: MatchFieldPosition | null | undefined): LocatableField {
  return {
    name: match?.playingAreaName ?? match?.venue ?? null,
    latitude: match?.playingAreaLatitude ?? null,
    longitude: match?.playingAreaLongitude ?? null,
    accessLatitude: match?.playingAreaAccessLatitude ?? null,
    accessLongitude: match?.playingAreaAccessLongitude ?? null,
    accessNote: match?.playingAreaAccessNote ?? null,
  }
}

// The match's field for the chain: the stored position on the match first; the Fields directory entry (cached with it) is loaded
// only when the match carries no stored position, to read its map URL and address.
export function useMatchField(clubId: string | undefined, match: (Pick<Match, 'playingAreaId'> & MatchFieldPosition) | null | undefined, enabled = true): LocatableField {
  const own = fieldFromMatch(match)
  const stored = storedPoint(own.latitude, own.longitude) !== null
  const field = useQuery({
    queryKey: [...playingAreasKey(clubId ?? ''), 'one', match?.playingAreaId ?? ''],
    queryFn: () => getPlayingArea(clubId as string, match?.playingAreaId as string),
    enabled: enabled && !stored && Boolean(clubId) && Boolean(match?.playingAreaId),
    staleTime: LONG,
    refetchOnWindowFocus: false,
    retry: false,
  })
  if (stored || !field.data) return own
  return { ...field.data, accessLatitude: own.accessLatitude ?? field.data.accessLatitude, accessLongitude: own.accessLongitude ?? field.data.accessLongitude, accessNote: own.accessNote ?? field.data.accessNote }
}

// The forecast for a match: loads the field's place only when the match has no stored position.
export function useMatchFieldWeather(clubId: string | undefined, match: (Pick<Match, 'matchDate' | 'playingAreaId'> & MatchFieldPosition) | null | undefined, now?: Date): MatchWeather {
  const inRange = Boolean(match?.matchDate) && inForecastRange(match?.matchDate as string, now)
  const field = useMatchField(clubId, match, inRange)
  return useMatchWeather(match?.matchDate, field, now)
}

// Get Directions for a match: the access point when set, else the resolved position (the town lookup only when nothing else exists).
export function useMatchDirections(clubId: string | undefined, match: (Pick<Match, 'playingAreaId'> & MatchFieldPosition) | null | undefined): DirectionsTarget | null {
  const field = useMatchField(clubId, match, Boolean(match?.playingAreaId))
  return useDirectionsTarget(match?.playingAreaId ? field : null)
}
