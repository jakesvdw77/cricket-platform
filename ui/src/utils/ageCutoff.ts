import type { AgeReference } from '../api/leagueApi'
// docs/specs/110-league-age-cutoff-day-and-month.md: a league's age cut-off is a day and month with no year, and
// the server judges ages on that day in the calendar year the league starts. These helpers hold the pure rules the
// form and the league page share; the server stays authoritative.

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// The school-age rule most leagues use (docs/specs/110): filled in when an age limit is first entered.
export const DEFAULT_CUTOFF = { month: 12, day: 31 } as const

// Days in a month for a cut-off: February is allowed 29 because the cut-off carries no year.
export function maxDayInMonth(month: number): number {
  if (month === 2) return 29
  return [4, 6, 9, 11].includes(month) ? 30 : 31
}

export type CutoffError = 'pair' | 'day'

// null when the pair is fine: both empty, or both set and the day exists in the month.
export function cutoffError(month: number | null, day: number | null): CutoffError | null {
  if (month == null && day == null) return null
  if (month == null || day == null) return 'pair'
  if (day < 1 || day > maxDayInMonth(month)) return 'day'
  return null
}

// "31 Dec 2026" from a yyyy-MM-dd string, without a time-zone shift.
export function formatReferenceDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number)
  return `${day} ${MONTH_SHORT[month - 1]} ${year}`
}

// The wording for a looked-up reference date: the source phrase ("the cut-off", "the league's start date") and the date.
// docs/specs/111: with no cut-off, the league's start is its entered season dates, else the day the league starts.
export function ageReferenceWording(data: AgeReference): { date: string; source: string; sentence: string } {
  const leagueStart = data.leagueStartSource === 'LEAGUE_SEASON_DATES' ? "the league's start date" : 'the day the league starts'
  const source = data.source === 'CUTOFF' ? 'the cut-off' : leagueStart
  const date = formatReferenceDate(data.referenceDate)
  return { date, source, sentence: `Ages are judged on ${date} (${source})` }
}
