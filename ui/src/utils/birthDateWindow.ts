import type { Section } from '../api/sectionApi'
import { ageRangeLabel } from './ageRange'

export interface BirthDateWindow {
  // yyyy-MM-dd, or null when there is no lower bound (no maximum age on the section).
  earliest: string | null
  // yyyy-MM-dd; today when the section has no minimum age.
  latest: string
}

const iso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

// Today minus whole years; 29 February in a year without one becomes 28 February.
function yearsBefore(today: Date, years: number): Date {
  const year = today.getFullYear() - years
  const month = today.getMonth()
  const lastDay = new Date(year, month + 1, 0).getDate()
  return new Date(year, month, Math.min(today.getDate(), lastDay))
}

// docs/specs/104-match-results-import-adaptors.md (the New player tab): the birth dates that fit a section's age limits.
// "Under N" (maxAge) means younger than N, so the earliest birth date is the day after today minus N years; a minimum age M
// gives the latest birth date, today minus M years; without a minimum the latest is today. Null when the section has no age
// limit at all. Guidance only: the form never blocks a date outside it.
export function birthDateWindow(section: Pick<Section, 'minAge' | 'maxAge'> | null | undefined, today: Date = new Date()): BirthDateWindow | null {
  if (!section || (section.minAge == null && section.maxAge == null)) return null
  let earliest: string | null = null
  if (section.maxAge != null) {
    const start = yearsBefore(today, section.maxAge)
    earliest = iso(new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1))
  }
  const latest = section.minAge != null ? iso(yearsBefore(today, section.minAge)) : iso(today)
  return { earliest, latest }
}

const written = (isoDate: string) => {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// "Under 15: born on or after 13 Nov 2011", "40+: born on or before 13 Nov 1986", "12–15: born between ... and ...".
export function birthDateWindowText(section: Pick<Section, 'minAge' | 'maxAge'>, window: BirthDateWindow): string {
  const label = ageRangeLabel(section) ?? ''
  if (window.earliest && section.minAge != null) return `${label}: born between ${written(window.earliest)} and ${written(window.latest)}`
  if (window.earliest) return `${label}: born on or after ${written(window.earliest)}`
  return `${label}: born on or before ${written(window.latest)}`
}

export function isOutsideWindow(window: BirthDateWindow, dateOfBirth: string): boolean {
  return Boolean(dateOfBirth) && ((window.earliest !== null && dateOfBirth < window.earliest) || dateOfBirth > window.latest)
}
