import { ageRangeLabel } from './ageRange'

export interface BirthDateWindow {
  // yyyy-MM-dd, or null when there is no lower bound (no maximum age).
  earliest: string | null
  // yyyy-MM-dd; the cut-off date without a minimum age, never after today.
  latest: string
  // The league's age cut-off date when that was the reference date, otherwise null (the reference was today).
  cutoff: string | null
  minAge: number | null
  maxAge: number | null
}

type AgeLimits = { minAge?: number | null; maxAge?: number | null }
type LeagueAge = AgeLimits & { ageCutoffDate?: string | null }

const iso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

// Today minus whole years; 29 February in a year without one becomes 28 February.
function yearsBefore(today: Date, years: number): Date {
  const year = today.getFullYear() - years
  const month = today.getMonth()
  const lastDay = new Date(year, month + 1, 0).getDate()
  return new Date(year, month, Math.min(today.getDate(), lastDay))
}

const parseIso = (value: string) => {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

// docs/specs/104-match-results-import-adaptors.md (the New player tab): the birth dates that fit the age rule of a player's
// league or section. The reference date is the league's age cut-off date when it has one, otherwise today. The limits are the
// league's minimum and maximum age when it sets either, otherwise the section's. "Under N" (maxAge) means younger than N on
// the reference date, so the earliest birth date is the day after the reference minus N years; a minimum age M gives the
// latest, the reference minus M years; without one the latest is the reference. The latest is never after today. Null when
// neither has an age limit. Guidance only: the form never blocks a date outside it.
export function birthDateWindow({
  section,
  league,
  today = new Date(),
}: {
  section?: AgeLimits | null
  league?: LeagueAge | null
  today?: Date
}): BirthDateWindow | null {
  const leagueSetsLimits = league != null && (league.minAge != null || league.maxAge != null)
  const limits: AgeLimits | null | undefined = leagueSetsLimits ? league : section
  const minAge = limits?.minAge ?? null
  const maxAge = limits?.maxAge ?? null
  if (minAge === null && maxAge === null) return null

  const cutoff = league?.ageCutoffDate ? league.ageCutoffDate : null
  const reference = cutoff ? parseIso(cutoff) : today
  let earliest: string | null = null
  if (maxAge !== null) {
    const start = yearsBefore(reference, maxAge)
    earliest = iso(new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1))
  }
  const latestRaw = minAge !== null ? iso(yearsBefore(reference, minAge)) : iso(reference)
  const latest = latestRaw > iso(today) ? iso(today) : latestRaw
  return { earliest, latest, cutoff, minAge, maxAge }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
// "13 Nov 2011", the same in every browser locale.
const written = (isoDate: string) => {
  const [year, month, day] = isoDate.split('-').map(Number)
  return `${day} ${MONTHS[month - 1]} ${year}`
}

// "Under 15: born on or after 13 Nov 2011" (cut-off today), "Under 15 on 1 Sep 2026: born on or after 2 Sep 2011" (the
// league's cut-off), "40+: born on or before 13 Nov 1986", "12–15: born between ... and ...".
export function birthDateWindowText(window: BirthDateWindow): string {
  const range = ageRangeLabel({ minAge: window.minAge, maxAge: window.maxAge }) ?? ''
  const label = window.cutoff ? `${range} on ${written(window.cutoff)}` : range
  if (window.earliest && window.minAge !== null) return `${label}: born between ${written(window.earliest)} and ${written(window.latest)}`
  if (window.earliest) return `${label}: born on or after ${written(window.earliest)}`
  return `${label}: born on or before ${written(window.latest)}`
}

export function isOutsideWindow(window: BirthDateWindow, dateOfBirth: string): boolean {
  return Boolean(dateOfBirth) && ((window.earliest !== null && dateOfBirth < window.earliest) || dateOfBirth > window.latest)
}
