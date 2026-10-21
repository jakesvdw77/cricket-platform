// docs/specs/115-player-match-list.md: an ISO instant (a match date and time) written as a date, in the browser's own zone, with the
// same en-GB options formatDateOfBirth uses for a plain date: "14 Mar 2026". `long` spells the month for an accessible name.
export function formatInstantDate(value: string | null | undefined, long = false): string {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString('en-GB', { day: 'numeric', month: long ? 'long' : 'short', year: 'numeric' })
}
