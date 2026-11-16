// docs/specs/115-player-match-list.md: an ISO instant (a match date and time) written as a date, in the browser's own zone, with the
// same en-GB options formatDateOfBirth uses for a plain date: "14 Mar 2026". `long` spells the month for an accessible name.
export function formatInstantDate(value: string | null | undefined, long = false): string {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString('en-GB', { day: 'numeric', month: long ? 'long' : 'short', year: 'numeric' })
}

// docs/specs/157-photo-gallery.md: an ISO instant as "Mon 16 Nov, 23:32" (weekday, day, month, 24 hour time) in the browser's own zone.
export function formatInstantDateTime(value: string | null | undefined): string {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}
