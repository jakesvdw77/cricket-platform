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
// a copy-pasted formatter in each.
export function formatBracketLabel(windowDate: string, dayPart: DayPart): string {
  const formattedDate = new Date(windowDate).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
  return `${formattedDate} - ${DAY_PART_LABEL[dayPart]}`
}
