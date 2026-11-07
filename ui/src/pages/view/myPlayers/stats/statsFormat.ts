import { basedOnText } from '../../../../components/StatsCards'
import type { StatsBasis } from '../../../../components/StatsCards'

// docs/specs/147: formatting only. No figure is computed here: every number is the server's, this turns it into words. A missing value
// (null or undefined) is a dash or "Not recorded", never a zero.
export const DASH = '–'
export const NOT_RECORDED = 'Not recorded'
export const FALLBACK_NAME = 'This Player'

const present = (value: number | null | undefined): value is number => value !== null && value !== undefined && Number.isFinite(value)

// "46", or a dash when there is no figure.
export const formatCount = (value: number | null | undefined): string => (present(value) ? String(value) : DASH)

// A decimal to `digits` places ("61.4"), or a dash.
export const formatDecimal = (value: number | null | undefined, digits = 1): string => (present(value) ? value.toFixed(digits) : DASH)

// "+1.25", "-0.30", "0.00" (a net run rate, a difference); a dash when there is no figure.
export function formatSigned(value: number | null | undefined, digits = 2): string {
  if (!present(value)) return DASH
  const text = Math.abs(value).toFixed(digits)
  if (Number(text) === 0) return text
  return `${value > 0 ? '+' : '-'}${text}`
}

// "54%" from a percentage the server sent (54 or 54.2); a dash when there is no figure.
export const formatPercent = (value: number | null | undefined, digits = 0): string => (present(value) ? `${value.toFixed(digits)}%` : DASH)

// "6 of 7", or a dash when either is missing.
export const nOfM = (counted: number | null | undefined, total: number | null | undefined): string => (present(counted) && present(total) ? `${counted} of ${total}` : DASH)

// "1st", "2nd", "3rd", "11th", "22nd"; a dash when there is no rank.
export function ordinal(rank: number | null | undefined): string {
  if (!present(rank)) return DASH
  const tens = rank % 100
  if (tens >= 11 && tens <= 13) return `${rank}th`
  const suffix = ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[rank % 10] ?? 'th'
  return `${rank}${suffix}`
}

// A score with the not out star: "47*".
export const scoreText = (runs: number | null | undefined, notOut: boolean | null | undefined): string => (present(runs) ? `${runs}${notOut ? '*' : ''}` : DASH)

// "2/21" (wickets for runs).
export const wicketsForRuns = (wickets: number | null | undefined, runs: number | null | undefined): string => (present(wickets) && present(runs) ? `${wickets}/${runs}` : DASH)

// "1 innings" / "2 innings": the caller supplies the plural where it is irregular.
export const plural = (count: number, one: string, many = `${one}s`): string => `${count} ${count === 1 ? one : many}`

// "Based on 6 of 7 results" (the same sentence the card shell draws).
export const basedOn = (basis: StatsBasis | null | undefined): string => (basis ? basedOnText(basis) : '')

// The player's first name for card copy.
export const firstNameOf = (name: string | null | undefined): string => name?.trim() || FALLBACK_NAME


// "1 Nov": the short date a card row or a dot is named by; the raw text when it is not a date.
export function dayText(iso: string | null | undefined): string {
  if (!iso) return DASH
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
