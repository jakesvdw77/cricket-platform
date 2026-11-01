import type { DailyForecast, HourSample } from '../../api/weatherApi'
import { describeWeatherCode } from './wmo'
import type { WeatherSummary } from './wmo'

// docs/specs/135 (Match Brief, owner decision 2026-11-02): the weather for the MATCH HOURS only (start to start plus N hours), as a
// range for the badge and a few plain-language, rule-built lines for its tooltip. Pure; no React, no network. Clock times are the
// field's own local time as the forecast gives them ('yyyy-MM-ddTHH:mm'); the match start is read the same way, so no time zone maths.

// N hours: 4 for a T20, 8 for a one-day (40 to 50 overs) or longer game, else 6 (also when the format is unknown).
export function matchWindowHours(format: string | null | undefined): number {
  if (format === 'T20') return 4
  if (format === 'T45' || format === 'T50' || format === 'ONE_DAY' || format === 'THREE_DAY' || format === 'FIVE_DAY') return 8
  return 6
}

const DEFAULT_START_MINUTES = 9 * 60

// Minutes after midnight of the 'THH:mm' in a start; 09:00 when the start has no time part (spec 135, open question 6).
export function startMinutes(start: string): number {
  const found = /T(\d{2}):(\d{2})/.exec(start)
  return found ? Number(found[1]) * 60 + Number(found[2]) : DEFAULT_START_MINUTES
}

const minutesOf = (time: string): number => {
  const found = /T(\d{2}):(\d{2})/.exec(time)
  return found ? Number(found[1]) * 60 + Number(found[2]) : Number.NaN
}

const hourLabel = (minutes: number): string => `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:00`
const clock = (time: string): string => {
  const found = /T(\d{2}:\d{2})/.exec(time)
  return found ? found[1] : ''
}

// The hours of the day from the start's hour up to start + N hours (the end hour included when it starts on the hour).
export function hoursInWindow(hours: HourSample[], start: string, windowHours: number): HourSample[] {
  const from = Math.floor(startMinutes(start) / 60) * 60
  const to = startMinutes(start) + windowHours * 60
  return hours.filter((hour) => {
    const at = minutesOf(hour.time)
    return at >= from && at <= to
  })
}

const values = (hours: HourSample[], pick: (hour: HourSample) => number | null): number[] =>
  hours.map(pick).filter((value): value is number => value !== null)
const maxOf = (list: number[]): number | null => (list.length ? Math.max(...list) : null)
const minOf = (list: number[]): number | null => (list.length ? Math.min(...list) : null)
const meanOf = (list: number[]): number | null => (list.length ? list.reduce((sum, value) => sum + value, 0) / list.length : null)

const isWet = (hour: HourSample): boolean => (hour.rainChance ?? 0) >= 40 || (hour.rainMm ?? 0) >= 0.5

// The lines of the tooltip, in priority order, at most four; the rain line always comes first.
export function matchHoursLines(window: HourSample[], sunset: string | null | undefined, start: string, windowHours: number): string[] {
  const lines: string[] = []
  const chances = values(window, (hour) => hour.rainChance)
  const maxChance = maxOf(chances) ?? 0
  const firstWet = window.findIndex(isWet)
  const heavy = window.some((hour) => (hour.rainMm ?? 0) >= 2.5)
  if (firstWet < 0) {
    lines.push(maxChance < 20 ? 'Dry for the whole match' : `Small chance of showers (up to ${Math.round(maxChance)}%)`)
  } else if (firstWet === 0) {
    lines.push(`Rain likely from the start${heavy ? '. Heavy at times' : ''}`)
  } else {
    const first = minutesOf(window[firstWet].time)
    lines.push(`Dry until about ${hourLabel(first - 60)}, showers likely after ${hourLabel(first)}${heavy ? '. Heavy at times' : ''}`)
  }

  const gusts = maxOf(values(window, (hour) => hour.gusts))
  if (gusts !== null && gusts >= 40) lines.push(`Windy: gusts up to ${Math.round(gusts)} km/h`)
  else if (gusts !== null && gusts >= 30) lines.push(`Breezy: gusts up to ${Math.round(gusts)} km/h`)

  const hottest = maxOf(values(window, (hour) => hour.temperature))
  const coldest = minOf(values(window, (hour) => hour.temperature))
  if (hottest !== null && hottest >= 35) lines.push(`Very hot: ${Math.round(hottest)} degrees, bring water and take drink breaks`)
  else if (hottest !== null && hottest >= 30) lines.push(`Hot: ${Math.round(hottest)} degrees, bring water`)
  else if (coldest !== null && coldest <= 10) lines.push(`Cold: ${Math.round(coldest)} degrees, bring a warm layer`)

  const uv = maxOf(values(window, (hour) => hour.uv))
  const uvFrom = (threshold: number): string => hourLabel(minutesOf(window.find((hour) => (hour.uv ?? 0) >= threshold)?.time ?? ''))
  if (uv !== null && uv >= 11) lines.push(`Extreme UV from ${uvFrom(11)}, bring sunscreen and a hat`)
  else if (uv !== null && uv >= 8) lines.push(`Very high UV from ${uvFrom(8)}, bring sunscreen`)
  else if (uv !== null && uv >= 6) lines.push(`High UV from ${uvFrom(6)}, bring sunscreen`)

  const sunsetAt = sunset ? minutesOf(sunset) : Number.NaN
  const end = startMinutes(start) + windowHours * 60
  if (Number.isFinite(sunsetAt) && sunsetAt >= Math.floor(startMinutes(start) / 60) * 60 && sunsetAt <= end + 90) lines.push(`Sunset ${clock(sunset as string)}`)

  const humidity = meanOf(values(window, (hour) => hour.humidity))
  if (humidity !== null && humidity >= 80 && hottest !== null && hottest >= 26) lines.push('Humid, expect it to feel warmer')

  const cloud = meanOf(values(window, (hour) => hour.cloud))
  if (cloud !== null && cloud >= 80) lines.push('Mostly overcast')
  else if (cloud !== null && cloud <= 20 && lines.length === 1) lines.push('Clear skies')

  return lines.slice(0, 4)
}

// The badge text: "24-31 degrees, rain 4-39%", "27 degrees, dry". Whole numbers.
function rangeText(window: HourSample[]): { temps: string; short: string; tempMin: number; tempMax: number; rain: number | null } | null {
  const temps = values(window, (hour) => hour.temperature)
  if (temps.length === 0) return null
  const tempMin = Math.round(Math.min(...temps))
  const tempMax = Math.round(Math.max(...temps))
  const degrees = tempMin === tempMax ? `${tempMin} degrees` : `${tempMin}-${tempMax} degrees`
  const chances = values(window, (hour) => hour.rainChance)
  if (chances.length === 0) return { temps: degrees, short: degrees, tempMin, tempMax, rain: null }
  const low = Math.round(Math.min(...chances))
  const high = Math.round(Math.max(...chances))
  const mm = values(window, (hour) => hour.rainMm).reduce((sum, value) => sum + value, 0)
  const rain = high < 10 && mm === 0 ? 'dry' : low === high ? `rain ${low}%` : `rain ${low}-${high}%`
  return { temps: degrees, short: `${degrees}, ${rain}`, tempMin, tempMax, rain: high }
}

// The forecast for the match hours; null when the day has hourly data but fewer than 2 hours of it fall in the window (never a guess).
// A response with no hourly data at all keeps the whole-day summary the forecast gave before.
export function summariseMatchHours(forecast: DailyForecast, start: string, windowHours: number): WeatherSummary | null {
  if (!forecast.hours || forecast.hours.length === 0) return null
  const window = hoursInWindow(forecast.hours, start, windowHours)
  if (window.length < 2) return null
  const range = rangeText(window)
  if (!range) return null
  const { label, icon } = describeWeatherCode(forecast.code)
  return {
    label,
    icon,
    tempMin: range.tempMin,
    tempMax: range.tempMax,
    rainChance: range.rain,
    text: `${label}, ${range.short}`,
    short: range.short,
    lines: matchHoursLines(window, forecast.sunset, start, windowHours),
  }
}
