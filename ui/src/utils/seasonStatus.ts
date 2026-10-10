import type { RecordCardBadge } from '../components/RecordCard'
import type { Season } from '../api/seasonApi'

// docs/specs/094-club-structure-and-seasons.md (B): what a season is "right now", derived from its dates, its Active flag
// and today. Nothing here is stored. Every function takes `today` (a local YYYY-MM-DD string, see localToday) so a test
// can pin it.
//
// This is deliberately not utils/defaultSeason.ts's pickDefaultSeasonId, whose semantics stay as they are (UTC date, and
// it ignores `active`): that picks one season for a picker, this describes every season for the Seasons page.

export type SeasonStatus = 'current' | 'upcoming' | 'past' | 'inactive'
// The date-only phase of an active or inactive season alike.
export type SeasonPhase = 'current' | 'upcoming' | 'past'

type SeasonDates = Pick<Season, 'startDate' | 'endDate'>

const DAY_MS = 86_400_000
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
// Amber on the time strip when a season starts or ends within this many days.
export const SEASON_SOON_DAYS = 7

// Today as the browser's LOCAL calendar date (not toISOString, which is UTC and would flip a few hours early or late).
export function localToday(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

function parts(date: string): [number, number, number] {
  const [year, month, day] = date.split('-').map(Number)
  return [year, month, day]
}

// A calendar date as a whole day number, immune to daylight saving.
function dayNumber(date: string): number {
  const [year, month, day] = parts(date)
  return Math.round(Date.UTC(year, month - 1, day) / DAY_MS)
}

// Whole days from `from` to `to` (negative when `to` is earlier).
function daysBetween(from: string, to: string): number {
  return dayNumber(to) - dayNumber(from)
}

export function seasonPhase(season: SeasonDates, today: string): SeasonPhase {
  if (season.startDate > today) return 'upcoming'
  if (season.endDate < today) return 'past'
  return 'current'
}

// An inactive season is "Inactive" and never also "Current" (or anything else).
export function seasonStatus(season: Pick<Season, 'startDate' | 'endDate' | 'active'>, today: string = localToday()): SeasonStatus {
  return season.active ? seasonPhase(season, today) : 'inactive'
}

const STATUS_BADGES: Record<SeasonStatus, RecordCardBadge> = {
  current: { label: 'Current', tone: 'positive' },
  upcoming: { label: 'Upcoming', tone: 'neutral' },
  past: { label: 'Past', tone: 'muted' },
  inactive: { label: 'Inactive', tone: 'muted' },
}

// The one status badge of a season (card, row and the season page).
export function seasonBadge(season: Pick<Season, 'startDate' | 'endDate' | 'active'>, today: string = localToday()): RecordCardBadge {
  return STATUS_BADGES[seasonStatus(season, today)]
}

function plural(count: number, unit: string): string {
  return `${count} ${unit}${count === 1 ? '' : 's'}`
}

// "1 Sep 2026" (UK style, no leading zero, three-letter month written out here so it never depends on the ICU locale data).
export function formatSeasonDate(date: string): string {
  const [year, month, day] = parts(date)
  return `${day} ${MONTH_NAMES[month - 1]} ${year}`
}

// "1 Sep 2026 to 31 Mar 2027"
export function formatSeasonRange(season: SeasonDates): string {
  return `${formatSeasonDate(season.startDate)} to ${formatSeasonDate(season.endDate)}`
}

// Inclusive number of days the season spans (a one-day season is 1).
export function seasonTotalDays(season: SeasonDates): number {
  return Math.max(1, daysBetween(season.startDate, season.endDate) + 1)
}

// "7 months", "3 weeks", "12 days". Whole calendar months from the start to the day after the end, rounded to the nearest
// month (15 days or more rounds up); under a month it is weeks from 14 days (rounded) and days below that.
export function seasonLength(season: SeasonDates): string {
  const totalDays = seasonTotalDays(season)
  const [startYear, startMonth, startDay] = parts(season.startDate)
  const endExclusive = new Date((dayNumber(season.endDate) + 1) * DAY_MS)
  const endYear = endExclusive.getUTCFullYear()
  const endMonth = endExclusive.getUTCMonth() + 1
  const endDay = endExclusive.getUTCDate()
  let months = (endYear - startYear) * 12 + (endMonth - startMonth)
  let remainderDays: number
  if (endDay >= startDay) {
    remainderDays = endDay - startDay
  } else {
    months -= 1
    // Days from the start day in the previous month of the exclusive end to the end day.
    const daysInPreviousMonth = new Date(Date.UTC(endYear, endMonth - 1, 0)).getUTCDate()
    remainderDays = daysInPreviousMonth - startDay + endDay
  }
  if (months >= 1) {
    return plural(remainderDays >= 15 ? months + 1 : months, 'month')
  }
  return totalDays >= 14 ? plural(Math.round(totalDays / 7), 'week') : plural(totalDays, 'day')
}

// A span looking back ("3 months ago"), coarser as it grows: days under 14, weeks under 60 days, then months, then years.
function spanAgoText(days: number): string {
  if (days < 14) return plural(days, 'day')
  if (days < 60) return plural(Math.round(days / 7), 'week')
  if (days < 365) return plural(Math.round(days / 30.4375), 'month')
  return plural(Math.floor(days / 365.25), 'year')
}

// A span looking forward ("41 days", "1 day"): days up to 99 (a manager counts down to a start or an end in days), then
// months, then years.
function spanAheadText(days: number): string {
  if (days < 100) return plural(days, 'day')
  if (days < 365) return plural(Math.round(days / 30.4375), 'month')
  return plural(Math.floor(days / 365.25), 'year')
}

export interface SeasonTimeStrip {
  // The two halves CardTimeStrip shows ("Ends in" then "41 days" in bold) and the whole sentence.
  label: string
  value: string
  text: string
  // Amber within SEASON_SOON_DAYS of the start or the end of an Active season; an inactive one is never amber.
  tone: 'neutral' | 'warning'
}

function strip(label: string, value: string, tone: 'neutral' | 'warning'): SeasonTimeStrip {
  return { label, value, text: `${label} ${value}`, tone }
}

// "Ends in 41 days" (current), "Starts in 12 days" (upcoming), "Ended 3 months ago" (past). A season ending today reads
// "Ends today"; one starting today is already current and says how long is left. An inactive season reads by its dates in
// the same words, never amber.
export function seasonTimeStrip(season: Pick<Season, 'startDate' | 'endDate' | 'active'>, today: string = localToday()): SeasonTimeStrip {
  const phase = seasonPhase(season, today)
  const canWarn = season.active
  if (phase === 'upcoming') {
    const days = daysBetween(today, season.startDate)
    return strip('Starts in', spanAheadText(days), canWarn && days <= SEASON_SOON_DAYS ? 'warning' : 'neutral')
  }
  if (phase === 'past') {
    return strip('Ended', `${spanAgoText(daysBetween(season.endDate, today))} ago`, 'neutral')
  }
  const days = daysBetween(today, season.endDate)
  if (days === 0) {
    return strip('Ends', 'today', canWarn ? 'warning' : 'neutral')
  }
  return strip('Ends in', spanAheadText(days), canWarn && days <= SEASON_SOON_DAYS ? 'warning' : 'neutral')
}

export interface SeasonProgress {
  // 1 on the first day.
  dayNumber: number
  totalDays: number
}

// "Day 172 of 212", for the current season only (an inactive season has no progress, as it is not current); null otherwise.
export function seasonProgress(season: Pick<Season, 'startDate' | 'endDate' | 'active'>, today: string = localToday()): SeasonProgress | null {
  if (seasonStatus(season, today) !== 'current') return null
  return { dayNumber: daysBetween(season.startDate, today) + 1, totalDays: seasonTotalDays(season) }
}
