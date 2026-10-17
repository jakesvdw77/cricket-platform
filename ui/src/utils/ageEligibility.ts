export interface AgeLimits {
  minAge?: number | null
  maxAge?: number | null
}

export type AgeProblem = 'NO_DATE_OF_BIRTH' | 'TOO_YOUNG' | 'TOO_OLD'

// The limits that apply: the league's when it sets either, otherwise the section's (as birthDateWindow does). Null when
// neither has a limit, so no age rule applies.
export function effectiveAgeLimits(section?: AgeLimits | null, league?: AgeLimits | null): { minAge: number | null; maxAge: number | null } | null {
  const leagueSets = league != null && (league.minAge != null || league.maxAge != null)
  const limits = leagueSets ? league : section
  const minAge = limits?.minAge ?? null
  const maxAge = limits?.maxAge ?? null
  return minAge === null && maxAge === null ? null : { minAge, maxAge }
}

const parts = (value: string) => value.slice(0, 10).split('-').map(Number)

// Whole years from the date of birth to the reference date (both yyyy-MM-dd), the server's Period.between(...).getYears().
export function ageOn(dateOfBirth: string, referenceDate: string): number {
  const [by, bm, bd] = parts(dateOfBirth)
  const [ry, rm, rd] = parts(referenceDate)
  return ry - by - (rm < bm || (rm === bm && rd < bd) ? 1 : 0)
}

// Mirrors the server's SelectionEligibility.ageProblem: age below minAge is too young, above maxAge too old (both limits
// inclusive); no date of birth cannot be judged and counts as a problem. Null when the player fits.
export function ageProblemOf(dateOfBirth: string | null | undefined, limits: { minAge: number | null; maxAge: number | null }, referenceDate: string): AgeProblem | null {
  if (!dateOfBirth) return 'NO_DATE_OF_BIRTH'
  const age = ageOn(dateOfBirth, referenceDate)
  if (limits.minAge !== null && age < limits.minAge) return 'TOO_YOUNG'
  if (limits.maxAge !== null && age > limits.maxAge) return 'TOO_OLD'
  return null
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
// "14 Nov 2011", the same in every browser locale.
export function writtenDate(isoDate: string): string {
  const [year, month, day] = parts(isoDate)
  return `${day} ${MONTHS[month - 1]} ${year}`
}

// "aged 13 to 15", "aged 40 or over", "aged 15 or under".
export function ageWords(limits: { minAge: number | null; maxAge: number | null }): string {
  if (limits.minAge !== null && limits.maxAge !== null) return `aged ${limits.minAge} to ${limits.maxAge}`
  if (limits.minAge !== null) return `aged ${limits.minAge} or over`
  return `aged ${limits.maxAge} or under`
}

export function todayIso(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}
