import { localDate } from '../leagueFormat'
import type { TickerPart } from '../tickerTypes'

export const HOUR_MS = 3_600_000
export const DAY_MS = 86_400_000

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// A line with the given names picked out as strong parts ("Villagers beat Rovers by 24 runs" -> strong Villagers, text " beat ", ...).
export function highlightNames(line: string, names: Array<string | null | undefined>): TickerPart[] {
  const found = names.filter((name): name is string => Boolean(name?.trim())).sort((a, b) => b.length - a.length)
  if (found.length === 0) return [{ type: 'text', text: line }]
  const pieces = line.split(new RegExp(`(${found.map(escape).join('|')})`))
  return pieces.filter(Boolean).map((piece) => (found.includes(piece) ? { type: 'strong', text: piece } : { type: 'text', text: piece }))
}

// A day or an instant as a Date ("2026-11-07" is that local day, not UTC midnight).
export function dayOf(value: string): Date | null {
  const day = /^\d{4}-\d{2}-\d{2}$/.test(value) ? localDate(value) : new Date(value)
  return day && !Number.isNaN(day.getTime()) ? day : null
}

export const weekday = (date: Date, style: 'short' | 'long' = 'short'): string => date.toLocaleDateString('en-GB', { weekday: style })

export const clock = (date: Date): string => `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`

export const sameDay = (a: Date, b: Date): boolean => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

// "3h 10m", "45m", "5h" from a positive span in milliseconds (never "0m").
export function spanText(ms: number): string {
  const minutes = Math.max(1, Math.floor(ms / 60_000))
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `${rest}m`
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`
}
