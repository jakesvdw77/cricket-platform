import { useQuery } from '@tanstack/react-query'
import type { Address } from '../api/clubApi'
import { fetchDailyForecast, geocodePlace } from '../api/weatherApi'
import { getPlayingArea, playingAreasKey } from '../api/playingAreaApi'
import { localDateIso, inForecastRange } from '../utils/weather/forecastWindow'
import { parseMapCoords, placeFromAddress, placeKey } from '../utils/weather/mapCoords'
import { summariseForecast } from '../utils/weather/wmo'
import type { WeatherSummary } from '../utils/weather/wmo'
import type { Match } from '../api/matchApi'

// docs/specs/131-match-sharing.md (Weather): the forecast for a match day at a field. Coordinates come, in this order, from
// (1) the field's map URL, (2) the Open-Meteo geocoding of the address city (cached by place for a long time), (3) nothing: then
// no weather is shown, never a guess. Nothing is requested for a past date, for a date more than 6 days ahead, or when the
// field gives no usable place. A failed fetch is quiet and retried later.

export interface WeatherField {
  mapUrl?: string | null
  address?: Pick<Address, 'city' | 'provinceState' | 'country'> | null
}

export type MatchWeatherStatus = 'ready' | 'loading' | 'none'

export interface MatchWeather {
  status: MatchWeatherStatus
  summary: WeatherSummary | null
}

const LONG = 6 * 60 * 60 * 1000
const GEOCODE_STALE = 30 * 24 * 60 * 60 * 1000
const NONE: MatchWeather = { status: 'none', summary: null }

export function useMatchWeather(matchDate: string | null | undefined, field: WeatherField | null | undefined, now?: Date): MatchWeather {
  const inRange = Boolean(matchDate) && inForecastRange(matchDate as string, now)
  const fromMap = parseMapCoords(field?.mapUrl)
  const place = fromMap ? null : placeFromAddress(field?.address)

  const geocode = useQuery({
    queryKey: ['weather', 'geocode', place ? placeKey(place) : ''],
    queryFn: () => geocodePlace(place as NonNullable<typeof place>),
    enabled: inRange && place !== null,
    staleTime: GEOCODE_STALE,
    gcTime: GEOCODE_STALE,
    refetchOnWindowFocus: false,
    retry: false,
  })
  const coords = fromMap ?? geocode.data ?? null
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
  const waiting = (place !== null && geocode.isLoading) || (coords !== null && forecast.isLoading)
  return waiting ? { status: 'loading', summary: null } : NONE
}

// The same for a match: loads the field the match is played on (cached with the Fields directory) and reads its place.
export function useMatchFieldWeather(clubId: string | undefined, match: Pick<Match, 'matchDate' | 'playingAreaId'> | null | undefined, now?: Date): MatchWeather {
  const inRange = Boolean(match?.matchDate) && inForecastRange(match?.matchDate as string, now)
  const field = useQuery({
    queryKey: [...playingAreasKey(clubId ?? ''), 'one', match?.playingAreaId ?? ''],
    queryFn: () => getPlayingArea(clubId as string, match?.playingAreaId as string),
    enabled: inRange && Boolean(clubId) && Boolean(match?.playingAreaId),
    staleTime: LONG,
    refetchOnWindowFocus: false,
    retry: false,
  })
  return useMatchWeather(match?.matchDate, field.data ?? null, now)
}
