// docs/specs/131-match-sharing.md (Weather): the free Open-Meteo forecast and geocoding APIs, called from the browser (no
// key, no platform endpoint). This is NOT our backend, so it deliberately does not use the shared axios instance (which
// would attach the user's token): a plain fetch that sends only a rounded location, a place name and a date.

export interface DailyForecast {
  date: string
  code: number
  tempMax: number
  tempMin: number
  rainChance: number | null
}

export interface Coordinates {
  lat: number
  lng: number
}

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast'
const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search'

export const FORECAST_DAYS = 7

interface ForecastResponse {
  daily?: {
    time?: string[]
    weather_code?: number[]
    temperature_2m_max?: number[]
    temperature_2m_min?: number[]
    precipitation_probability_max?: (number | null)[]
  }
}

// The forecast for one date, or null when the API has none for it. Throws on a network or HTTP failure (the hook keeps that quiet).
export async function fetchDailyForecast(coords: Coordinates, date: string): Promise<DailyForecast | null> {
  const params = new URLSearchParams({
    latitude: coords.lat.toFixed(2),
    longitude: coords.lng.toFixed(2),
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    forecast_days: String(FORECAST_DAYS),
    timezone: 'auto',
  })
  const response = await fetch(`${FORECAST_URL}?${params.toString()}`)
  if (!response.ok) throw new Error(`Forecast failed with ${response.status}`)
  const body = (await response.json()) as ForecastResponse
  const daily = body.daily
  const index = daily?.time?.indexOf(date) ?? -1
  if (!daily || index < 0) return null
  const code = daily.weather_code?.[index]
  const tempMax = daily.temperature_2m_max?.[index]
  const tempMin = daily.temperature_2m_min?.[index]
  if (typeof code !== 'number' || typeof tempMax !== 'number' || typeof tempMin !== 'number') return null
  const rain = daily.precipitation_probability_max?.[index]
  return { date, code, tempMax, tempMin, rainChance: typeof rain === 'number' ? rain : null }
}

interface GeocodeResponse {
  results?: { latitude: number; longitude: number; admin1?: string; country_code?: string }[]
}

export interface PlaceQuery {
  city: string
  provinceState: string | null
  // ISO 3166-1 alpha-2 when the field stores one.
  countryCode: string | null
}

// The first place that matches, preferring one whose province or state matches. null when nothing matches. Throws on failure.
export async function geocodePlace(place: PlaceQuery): Promise<Coordinates | null> {
  const params = new URLSearchParams({ name: place.city, count: '5', language: 'en', format: 'json' })
  if (place.countryCode) params.set('countryCode', place.countryCode)
  const response = await fetch(`${GEOCODE_URL}?${params.toString()}`)
  if (!response.ok) throw new Error(`Geocoding failed with ${response.status}`)
  const body = (await response.json()) as GeocodeResponse
  const results = body.results ?? []
  const wanted = place.provinceState?.trim().toLowerCase()
  const best = (wanted ? results.find((item) => item.admin1?.toLowerCase() === wanted) : undefined) ?? results[0]
  return best ? { lat: best.latitude, lng: best.longitude } : null
}
