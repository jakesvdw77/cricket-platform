import type { MyMatchDto, MyMatchSelection, MyMatchSummaryDto } from '../../../api/myPlayersApi'
import { localDate, todayIso } from './leagueFormat'
import type { LeagueTab } from './leagueFormat'

// docs/specs/135 (Player Hub match view): the small pure helpers the match screens share. Pure; no React. The server decides phase,
// selection and every figure; this only formats (elapsed time, countdown, labels) and builds the Hub URLs.

// Where a match page was opened from (the `from` query parameter): the Matches list, or a league's Schedule or Results tab.
export type MatchOrigin = { kind: 'matches' } | { kind: 'league'; leagueId: string; tab: LeagueTab }

export function parseFrom(value: string | null | undefined): MatchOrigin {
  const found = /^league:([A-Za-z0-9-]+)(?::(schedule|results))?$/.exec(value ?? '')
  return found ? { kind: 'league', leagueId: found[1], tab: found[2] === 'results' ? 'results' : 'schedule' } : { kind: 'matches' }
}

export const leagueFrom = (leagueId: string, tab: 'schedule' | 'results'): string => `league:${leagueId}${tab === 'results' ? ':results' : ''}`

const base = (playerKey: string, matchId: string) => `/account/players/${playerKey}/schedule/matches/${matchId}`

// The match page, optionally remembering where it was opened from.
export function matchPath(playerKey: string, matchId: string, from?: string | null): string {
  return `${base(playerKey, matchId)}${from ? `?from=${encodeURIComponent(from)}` : ''}`
}

export function watchPath(playerKey: string, matchId: string, from?: string | null): string {
  return `${base(playerKey, matchId)}/watch${from ? `?from=${encodeURIComponent(from)}` : ''}`
}

export const matchTitle = (home: string, away: string): string => `${home} versus ${away}`

// "Started 1h 20m ago", "Started 20m ago", "Started just now"; empty without a start. Whole minutes, from the server's startedAt.
export function elapsedLabel(startedAt: string | null | undefined, now: Date): string {
  if (!startedAt) return ''
  const start = new Date(startedAt).getTime()
  if (Number.isNaN(start)) return ''
  const minutes = Math.max(0, Math.floor((now.getTime() - start) / 60_000))
  if (minutes < 1) return 'Started just now'
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `Started ${rest}m ago`
  return rest === 0 ? `Started ${hours}h ago` : `Started ${hours}h ${rest}m ago`
}

// "today", "tomorrow", "in 3 days" by calendar day; empty for a day that has passed.
export function countdownLabel(date: string, now: Date): string {
  const target = localDate(date)
  const today = localDate(todayIso(now))
  if (!target || !today) return ''
  const days = Math.round((target.getTime() - today.getTime()) / 86_400_000)
  if (days < 0) return ''
  if (days === 0) return 'today'
  return days === 1 ? 'tomorrow' : `in ${days} days`
}

// "Sat 8 Nov".
export function dayLabel(date: string): string {
  const parsed = localDate(date)
  return parsed ? parsed.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : date
}

export const SELECTION_LABELS: Record<MyMatchSelection, string> = {
  SELECTED: 'Selected',
  SELECTED_TWELFTH: 'Selected (12th)',
  NOT_SELECTED: 'Not Selected',
  NOT_ANNOUNCED: 'Waiting For Team Announcement',
}

export const selectionLabel = (selection: MyMatchSelection | null | undefined): string => (selection ? SELECTION_LABELS[selection] : '-')

// The one status badge of the match page (not for a live match, which shows the LIVE badge). A match past its window with no
// result reads Result Pending.
export function statusBadgeLabel(match: Pick<MyMatchDto, 'status' | 'phase'>): string {
  if (match.status === 'PLAYED') return 'Played'
  if (match.status === 'CANCELLED') return 'Cancelled'
  if (match.status === 'POSTPONED') return 'Postponed'
  return match.phase === 'RECENT' ? 'Result Pending' : 'Upcoming'
}

// The one-line description of the held player's answer.
export function answerLabel(answer: 'AVAILABLE' | 'UNAVAILABLE' | 'UNSURE' | null | undefined): string {
  if (answer === 'AVAILABLE') return 'You said Yes.'
  if (answer === 'UNAVAILABLE') return 'You said No.'
  if (answer === 'UNSURE') return 'You said Maybe.'
  return 'No answer yet.'
}

// A recent row's result: the server's published result, else "Result pending".
export const recentResultLine = (row: Pick<MyMatchSummaryDto, 'result'>): string => row.result?.resultLine || 'Result pending'

// Forecast and directions are asked for only inside the forecast window (the weather hook allows 6 days ahead).
export function withinForecastDays(date: string, now: Date, days = 6): boolean {
  const target = localDate(date)
  const today = localDate(todayIso(now))
  if (!target || !today) return false
  const diff = Math.round((target.getTime() - today.getTime()) / 86_400_000)
  return diff >= 0 && diff <= days
}
