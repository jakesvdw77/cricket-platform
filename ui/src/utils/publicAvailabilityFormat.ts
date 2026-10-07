// Display helpers for the public availability screens (docs/specs/077), kept apart so the
// components stay presentational and the wording is unit-tested once.

const DATE_TIME: Intl.DateTimeFormatOptions = {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
}

// "Wed 14 Oct, 07:15" in the viewer's own locale and zone.
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, DATE_TIME)
}

export function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
}

// "in 15 minutes" style retry hint; null when the server gave no time.
export function formatRetryIn(seconds: number | null | undefined): string | null {
  if (seconds == null || !Number.isFinite(seconds)) return null
  if (seconds <= 60) return 'in less than a minute'
  const minutes = Math.ceil(seconds / 60)
  if (minutes < 60) return `in ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`
  const hours = Math.ceil(minutes / 60)
  return `in ${hours} ${hours === 1 ? 'hour' : 'hours'}`
}

export function initialsOf(name: string): string {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('')
  return letters || 'A'
}
