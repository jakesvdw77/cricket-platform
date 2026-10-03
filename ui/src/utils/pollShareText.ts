// Shared building blocks for the WhatsApp-style availability invite messages (PollShareDialog for a
// squad poll, SectionAvailabilityShareDialog for a group poll). WhatsApp renders *text* as bold.

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// e.g. "Fri 2 Oct, 20:00" in the viewer's local time zone, 24-hour clock.
export function formatShareCloseTime(date: Date): string {
  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}, ${time}`
}

// The highlighted deadline line, or null when the poll has no automatic close time (so the caller
// omits it rather than promising a deadline that does not exist).
export function closeTimeLine(autoClose?: boolean, scheduledCloseAt?: string | null): string | null {
  if (!autoClose || !scheduledCloseAt) {
    return null
  }
  const date = new Date(scheduledCloseAt)
  if (Number.isNaN(date.getTime())) {
    return null
  }
  return `⏰ *Please reply by ${formatShareCloseTime(date)}*`
}
