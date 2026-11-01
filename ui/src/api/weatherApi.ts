// docs/specs/131-match-sharing.md (Weather): the free Open-Meteo forecast and geocoding APIs, called from the browser (no
// key, no platform endpoint). This is NOT our backend, so it deliberately does not use the shared axios instance (which
// would attach the user's token): a plain fetch that sends only a rounded location, a place name and a date.

export interface DailyForecast {
  date: string
  code: number
  tempMax: number
  tempMin: number
  rainChance: number | null
  // The hourly values of that day and its sunrise and sunset (local clock 'yyyy-MM-ddTHH:mm'); absent when the response has none.
  hours?: HourSample[]
  sunrise?: string | null
  sunset?: string | null
}

// One hour of the day at the field, in the field's own local time ('yyyy-MM-ddTHH:mm'); a value the API leaves out is null.
export interface HourSample {
  time: string
  temperature: number | null
  rainChance: number | null
  rainMm: number | null
  wind: number | null
  gusts: number | null
  humidity: number | null
  uv: number | null
  cloud: number | null
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
    sunrise?: (string | null)[]
    sunset?: (string | null)[]
  }
  hourly?: {
    time?: string[]
    temperature_2m?: (number | null)[]
    precipitation_probability?: (number | null)[]
    precipitation?: (number | null)[]
    wind_speed_10m?: (number | null)[]
    wind_gusts_10m?: (number | null)[]
    relative_humidity_2m?: (number | null)[]
    uv_index?: (number | null)[]
    cloud_cover?: (number | null)[]
  }
}

const HOURLY = 'temperature_2m,precipitation_probability,precipitation,wind_speed_10m,wind_gusts_10m,relative_humidity_2m,uv_index,cloud_cover'

const num = (value: number | null | undefined): number | null => (typeof value === 'number' ? value : null)

function hoursOf(hourly: ForecastResponse['hourly'], date: string): HourSample[] {
  const times = hourly?.time ?? []
  const samples: HourSample[] = []
  times.forEach((time, index) => {
    if (!time.startsWith(date)) return
    samples.push({
      time,
      temperature: num(hourly?.temperature_2m?.[index]),
      rainChance: num(hourly?.precipitation_probability?.[index]),
      rainMm: num(hourly?.precipitation?.[index]),
      wind: num(hourly?.wind_speed_10m?.[index]),
      gusts: num(hourly?.wind_gusts_10m?.[index]),
      humidity: num(hourly?.relative_humidity_2m?.[index]),
      uv: num(hourly?.uv_index?.[index]),
      cloud: num(hourly?.cloud_cover?.[index]),
    })
  })
  return samples
}

// The forecast for one date, or null when the API has none for it. Throws on a network or HTTP failure (the hook keeps that quiet).
export async function fetchDailyForecast(coords: Coordinates, date: string): Promise<DailyForecast | null> {
  const params = new URLSearchParams({
    latitude: coords.lat.toFixed(2),
    longitude: coords.lng.toFixed(2),
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset',
    hourly: HOURLY,
    wind_speed_unit: 'kmh',
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
  const hours = hoursOf(body.hourly, date)
  return {
    date,
    code,
    tempMax,
    tempMin,
    rainChance: typeof rain === 'number' ? rain : null,
    ...(hours.length > 0 ? { hours } : {}),
    sunrise: daily.sunrise?.[index] ?? null,
    sunset: daily.sunset?.[index] ?? null,
  }
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

export interface PlaceMatch {
  name: string
  admin1: string | null
  country: string | null
  coords: Coordinates
}

interface PlaceSearchResponse {
  results?: { name?: string; latitude: number; longitude: number; admin1?: string; country?: string }[]
}

// docs/specs/133 (Find On Map): up to five towns that match the typed city, for the manager to choose from. Nothing is picked here.
// Only a place name (and the country code when the field has one) leaves the browser. Throws on failure.
export async function searchPlaces(place: PlaceQuery): Promise<PlaceMatch[]> {
  const params = new URLSearchParams({ name: place.city, count: '5', language: 'en', format: 'json' })
  if (place.countryCode) params.set('countryCode', place.countryCode)
  const response = await fetch(`${GEOCODE_URL}?${params.toString()}`)
  if (!response.ok) throw new Error(`Geocoding failed with ${response.status}`)
  const body = (await response.json()) as PlaceSearchResponse
  return (body.results ?? []).slice(0, 5).map((item) => ({
    name: item.name ?? place.city,
    admin1: item.admin1 ?? null,
    country: item.country ?? null,
    coords: { lat: item.latitude, lng: item.longitude },
  }))
}
