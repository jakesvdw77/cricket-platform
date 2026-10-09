// docs/specs/088: the date of birth and age text shared by the player card and the Player page.

// The "–" shown where nothing is on file, so every card has the same rows.
export const NOT_ON_FILE = '–'

export function formatDateOfBirth(value: string | null): string {
  if (!value) return NOT_ON_FILE
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// Completed years on `now`; null when there is no (valid) date of birth.
export function ageFromDateOfBirth(value: string | null, now: Date = new Date()): number | null {
  if (!value) return null
  const born = new Date(`${value}T00:00:00`)
  if (Number.isNaN(born.getTime())) return null
  let age = now.getFullYear() - born.getFullYear()
  const birthdayPassed =
    now.getMonth() > born.getMonth() || (now.getMonth() === born.getMonth() && now.getDate() >= born.getDate())
  if (!birthdayPassed) age -= 1
  return age < 0 ? null : age
}
