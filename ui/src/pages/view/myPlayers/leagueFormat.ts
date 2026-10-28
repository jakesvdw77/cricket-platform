import { ageRangeWritten } from '../../../utils/ageRange'
import type { MyLeagueSummaryDto } from '../../../api/myPlayersApi'
import type { LeagueContent } from '../../../utils/share/leagueShareFormats'

// docs/specs/123 (Player Hub leagues): the small pure helpers the league screens share. Pure; no React.

export type LeagueTab = 'details' | 'conditions' | 'teams' | 'schedule' | 'results' | 'dates'

export const LEAGUE_TABS: { id: LeagueTab; label: string; content: LeagueContent }[] = [
  { id: 'details', label: 'Details', content: 'DETAILS' },
  { id: 'conditions', label: 'Playing conditions', content: 'CONDITIONS' },
  { id: 'teams', label: 'Teams', content: 'TEAMS' },
  { id: 'schedule', label: 'Schedule', content: 'SCHEDULE' },
  { id: 'results', label: 'Results', content: 'RESULTS' },
  { id: 'dates', label: 'Key dates', content: 'KEY_DATES' },
]

export const parseLeagueTab = (value: string | null): LeagueTab => LEAGUE_TABS.find((tab) => tab.id === value)?.id ?? 'details'

// "Under 15", "12 to 15 years", "40 and over"; null when no age is set.
export function ageBand(league: Pick<MyLeagueSummaryDto, 'minAge' | 'maxAge'>): string | null {
  return league.minAge == null && league.maxAge == null ? null : ageRangeWritten(league)
}

const pad = (value: number) => String(value).padStart(2, '0')

// A bare yyyy-mm-dd (or an ISO date and time) read as a local calendar date, so it never shifts a day.
function localDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!match) return null
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
}

// "Saturday 17 October 2026"; the raw text when it is not a date.
export function longDate(value: string): string {
  const date = localDate(value)
  return date ? date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : value
}

// "17 Oct 2026".
export function shortDate(value: string): string {
  const date = localDate(value)
  return date ? date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : value
}

export const todayIso = (now: Date = new Date()): string => `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`

export const isPast = (date: string, now?: Date): boolean => date.slice(0, 10) < todayIso(now)

export const timeLabel = (time: string | null | undefined): string => (time ? time.slice(0, 5) : '')

export function isHttps(url: string | null | undefined): url is string {
  return typeof url === 'string' && /^https:\/\//i.test(url.trim())
}

// Rows grouped by date, in the order given.
export function groupByDate<T extends { date: string }>(rows: T[]): { date: string; rows: T[] }[] {
  const groups: { date: string; rows: T[] }[] = []
  for (const row of rows) {
    const key = row.date.slice(0, 10)
    const last = groups[groups.length - 1]
    if (last && last.date === key) last.rows.push(row)
    else groups.push({ date: key, rows: [row] })
  }
  return groups
}

// The Hub league URLs: the list at schedule/leagues, a league one segment deeper; the season and tab are query parameters.
export function hubLeaguePath(playerKey: string, leagueId?: string, params: { season?: string; tab?: LeagueTab } = {}): string {
  const base = `/account/players/${playerKey}/schedule/leagues${leagueId ? `/${leagueId}` : ''}`
  const query = new URLSearchParams()
  if (params.season) query.set('season', params.season)
  if (params.tab && params.tab !== 'details') query.set('tab', params.tab)
  const text = query.toString()
  return text ? `${base}?${text}` : base
}
