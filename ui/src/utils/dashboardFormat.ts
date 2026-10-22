import type { DashboardTrendDirection } from '../api/playerDashboardApi'
import { NOT_ON_FILE } from './playerFormat'

// docs/specs/117-stats-dashboard.md: display helpers only, shared by the player and the team Dashboard. Every figure, share, average,
// reference value and trend hint is the server's; these functions choose decimals, build a sentence from fields the response
// carries and turn null into a dash or "Not recorded". Nothing here computes a statistic.

export const NOT_RECORDED = 'Not recorded'

// A short axis date: "6 Sep" (the browser's own zone, like formatInstantDate).
export function shortDate(value: string | null | undefined): string {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

// "v Riverside CC", or "Internal match" for a derby (the opponent is null there, spec 115).
export function opponentText(opponentName: string | null | undefined, derby: boolean): string {
  if (derby) return 'Internal match'
  return opponentName || NOT_ON_FILE
}

// "6 Sep v Riverside CC": the tooltip title of a match point.
export function matchTitle(date: string | null | undefined, opponentName: string | null | undefined, derby: boolean): string {
  const when = shortDate(date)
  const who = derby ? 'internal match' : opponentName ? `v ${opponentName}` : ''
  return [when, who].filter(Boolean).join(' ')
}

// A share as the server sent it (it rounds to 1 decimal): always one decimal ("36.0%", "28.6%"); a dash for null.
export function percentText(value: number | null | undefined): string {
  if (value === null || value === undefined) return NOT_ON_FILE
  return `${value.toFixed(1)}%`
}

// The same share where a missing value reads "Not recorded" (a table cell or tooltip row), never 0.
export function percentOrNotRecorded(value: number | null | undefined): string {
  return value === null || value === undefined ? NOT_RECORDED : `${value.toFixed(1)}%`
}

// A figure to a fixed number of decimals, or "Not recorded" for null (never 0).
export function figureOrNotRecorded(value: number | null | undefined, places = 0): string {
  return value === null || value === undefined ? NOT_RECORDED : value.toFixed(places)
}

// A figure to a fixed number of decimals, or null for a missing value: a chart's value label, which then draws nothing.
export function figureOrNull(value: number | null | undefined, places = 0): string | null {
  return value === null || value === undefined ? null : value.toFixed(places)
}

// "Average 37.50", or undefined for a missing value: a chart's reference-line label.
export function labelledFigure(prefix: string, value: number | null | undefined, places = 2): string | undefined {
  return value === null || value === undefined ? undefined : `${prefix} ${value.toFixed(places)}`
}

const DIRECTION_PHRASE: Record<DashboardTrendDirection, string> = { UP: 'up from', DOWN: 'down from', FLAT: 'level with' }

export interface TrendHint {
  recent: number | null | undefined
  earlier: number | null | undefined
  direction: DashboardTrendDirection | null | undefined
}

// "Last 5 matches: 5.10 runs per over, down from 6.00 in the 5 before." The sentence is only built when the server sent all three
// hint fields (it sends none below three matches per half); the direction is also in words, with no good or bad judgement.
export function trendSentence(hint: TrendHint, kind: 'economy' | 'dots'): string | null {
  const { recent, earlier, direction } = hint
  if (recent === null || recent === undefined || earlier === null || earlier === undefined || !direction) return null
  const phrase = DIRECTION_PHRASE[direction]
  if (kind === 'economy') return `Last 5 matches: ${recent.toFixed(2)} runs per over, ${phrase} ${earlier.toFixed(2)} in the 5 before.`
  return `Last 5 matches: ${recent.toFixed(1)}% dot balls, ${phrase} ${earlier.toFixed(1)}% in the 5 before.`
}

// "Last 30 of 52 innings; the Runs tile counts all 52." (null when every point is shown)
export function windowCaption(shown: number, total: number, noun: string, tile: string): string | null {
  if (total <= shown) return null
  return `Last ${shown} of ${total} ${noun}; the ${tile} tile counts all ${total}.`
}

// "Since 3 Mar 2024": under a truncated trend.
export function sinceCaption(truncated: boolean, since: string | null | undefined, formatted: string): string | null {
  return truncated && since ? `Since ${formatted}.` : null
}
