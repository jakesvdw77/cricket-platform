import type { DailyForecast } from '../../api/weatherApi'

// docs/specs/131-match-sharing.md (Weather): WMO weather codes mapped to words and an icon kind. Words always carry the
// meaning; the icon is decoration.
export type WeatherIconKind = 'sunny' | 'partly' | 'cloudy' | 'fog' | 'rain' | 'snow' | 'storm'

export function describeWeatherCode(code: number): { label: string; icon: WeatherIconKind } {
  if (code === 0) return { label: 'Sunny', icon: 'sunny' }
  if (code === 1) return { label: 'Mostly sunny', icon: 'sunny' }
  if (code === 2) return { label: 'Partly cloudy', icon: 'partly' }
  if (code === 3) return { label: 'Cloudy', icon: 'cloudy' }
  if (code === 45 || code === 48) return { label: 'Fog', icon: 'fog' }
  if (code >= 51 && code <= 57) return { label: 'Drizzle', icon: 'rain' }
  if (code >= 61 && code <= 67) return { label: 'Rain', icon: 'rain' }
  if (code >= 71 && code <= 77) return { label: 'Snow', icon: 'snow' }
  if (code >= 80 && code <= 82) return { label: 'Showers', icon: 'rain' }
  if (code === 85 || code === 86) return { label: 'Snow showers', icon: 'snow' }
  if (code >= 95 && code <= 99) return { label: 'Thunderstorms', icon: 'storm' }
  return { label: 'Mixed weather', icon: 'cloudy' }
}

export interface WeatherSummary {
  label: string
  icon: WeatherIconKind
  tempMin: number
  tempMax: number
  rainChance: number | null
  // "Mostly sunny, 14 to 27 degrees, 20% rain": the accessible name and the text in posters and messages.
  text: string
  // "14 to 27 degrees, 20% rain" for tight places.
  short: string
}

export function summariseForecast(forecast: DailyForecast): WeatherSummary {
  const { label, icon } = describeWeatherCode(forecast.code)
  const tempMin = Math.round(forecast.tempMin)
  const tempMax = Math.round(forecast.tempMax)
  const rain = forecast.rainChance === null ? null : Math.round(forecast.rainChance)
  const temps = `${tempMin} to ${tempMax} degrees`
  const short = rain === null ? temps : `${temps}, ${rain}% rain`
  return { label, icon, tempMin, tempMax, rainChance: rain, text: `${label}, ${short}`, short }
}
