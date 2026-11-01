import { FORECAST_DAYS } from '../../api/weatherApi'

const pad = (value: number): string => String(value).padStart(2, '0')

// The local calendar date of an instant as yyyy-mm-dd.
export function localDateIso(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

// Whole calendar days from today to the match day: 0 today, 1 tomorrow, negative in the past. NaN for an unusable date.
export function daysUntil(matchDate: string, now: Date = new Date()): number {
  const match = new Date(matchDate)
  if (Number.isNaN(match.getTime())) return Number.NaN
  const a = Date.UTC(match.getFullYear(), match.getMonth(), match.getDate())
  const b = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((a - b) / 86_400_000)
}

// docs/specs/131: a forecast exists only for today and the next six days; never for a past date or further out.
export function inForecastRange(matchDate: string, now: Date = new Date()): boolean {
  const days = daysUntil(matchDate, now)
  return Number.isFinite(days) && days >= 0 && days < FORECAST_DAYS
}
