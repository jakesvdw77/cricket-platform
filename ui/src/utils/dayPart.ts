import type { DayPart } from '../api/sectionAvailabilityApi'

// docs/specs/063-section-availability-and-flexible-squads.md's fixed two-value DayPart vocabulary
// - shared display label between the admin availability polls list, the public
// PublicSectionAvailabilityRound page, and MatchFormPage's group-poll-covered side panels, rather
// than a copy-pasted map in each.
export const DAY_PART_LABEL: Record<DayPart, string> = {
  MORNING: 'Morning',
  AFTERNOON: 'Afternoon',
}

// e.g. "Sat 4 Oct - Morning" - one specific bracket's own date + day-part, since a round can now
// own however many windows its selected matches actually resolved to (docs/specs/063's
// fixture-group-selection revision), no longer a fixed Morning/Afternoon pair sharing one implied
// date. Shared between the admin round list/responses view and the public round page rather than
// a copy-pasted formatter in each. `separator` defaults to ' - ' so every existing caller is
// unchanged; docs/specs/065's responses views pass ' · ' to match the rest of that page.
export function formatBracketLabel(windowDate: string, dayPart: DayPart, separator = ' - '): string {
  const formattedDate = new Date(windowDate).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
  return `${formattedDate}${separator}${DAY_PART_LABEL[dayPart]}`
}

// The browser-side twin of the backend's SectionAvailabilityMatchResolverImpl.dayPartOf: a match
// whose local time-of-day is before 12:00 noon is MORNING, noon and later is AFTERNOON. The backend
// splits the kickoff Instant using ZoneId.systemDefault() (the server's zone - no per-club time
// zone concept yet); here the same split uses the browser's local zone via Date's local getters,
// which matches whenever the manager's browser is in the server's zone (the single-zone clubs this
// product serves today). docs/specs/066-poll-close-time-and-unified-cards.md.
export function dayPartForDate(date: Date): DayPart {
  return date.getHours() < 12 ? 'MORNING' : 'AFTERNOON'
}
