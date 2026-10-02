// HTML <input type="datetime-local"> has no timezone of its own - treated as the browser's local
// time on both read and write, converted to/from a real ISO Instant string (e.g. Match.matchDate,
// a poll's scheduledCloseAt) at the form's edges only. Lifted out of MatchForm.tsx (docs/specs/
// 066-poll-close-time-and-unified-cards.md) so the poll close-time fields share it.
export function toDatetimeLocal(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function fromDatetimeLocal(value: string): string {
  return new Date(value).toISOString()
}
