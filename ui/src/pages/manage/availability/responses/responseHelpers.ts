import type { AvailabilityStatus } from '../../../../api/matchAvailabilityApi'
import type {
  SectionAvailabilityRoundBracket,
  SectionAvailabilityRoundMatch,
  SectionAvailabilityRoundResponseRow,
  SectionAvailabilityRoundResponses,
} from '../../../../api/sectionAvailabilityApi'
import { formatBracketLabel } from '../../../../utils/dayPart'

// docs/specs/065-group-poll-responses-view.md: pure helpers behind the responses page's three
// views, kept out of the components so grouping/ordering/search are unit-testable.

// The group order the spec fixes (Available, Unsure, Unavailable), also the override menu's order.
export const STATUS_ORDER: AvailabilityStatus[] = ['AVAILABLE', 'UNSURE', 'UNAVAILABLE']

// The height of a player row in the By time slot lists (the lists grow, the page scrolls: docs/specs/085 C9).
export const ROW_HEIGHT = 32

export type ResponseRow = SectionAvailabilityRoundResponseRow

export interface SlotGroup {
  bracket: SectionAvailabilityRoundBracket
  matches: SectionAvailabilityRoundMatch[]
  available: ResponseRow[]
  unsure: ResponseRow[]
  unavailable: ResponseRow[]
  noResponse: ResponseRow[]
}

export function playerName(row: ResponseRow): string {
  return `${row.firstName} ${row.lastName}`
}

// "Sat 3 Oct · Morning" - the shared bracket formatter with this page's dot separator.
export function slotHeading(bracket: Pick<SectionAvailabilityRoundBracket, 'windowDate' | 'dayPart'>): string {
  return formatBracketLabel(bracket.windowDate, bracket.dayPart, ' · ')
}

// This player's answer for one slot; null when they have not answered it.
export function statusFor(row: ResponseRow, windowId: string): AvailabilityStatus | null {
  return row.statuses.find((entry) => entry.windowId === windowId)?.status ?? null
}

// True when this player's answer for the slot came through the public link (077).
export function viaLinkFor(row: ResponseRow, windowId: string): boolean {
  return row.statuses.find((entry) => entry.windowId === windowId)?.viaLink === true
}

export function hasAnyAnswer(row: ResponseRow): boolean {
  return row.statuses.some((entry) => entry.status !== null)
}

// Case-insensitive match on first or last name (or the full name); a blank query keeps everyone.
export function filterPlayers(rows: ResponseRow[], query: string): ResponseRow[] {
  const needle = query.trim().toLowerCase()
  if (!needle) {
    return rows
  }
  return rows.filter(
    (row) => row.firstName.toLowerCase().includes(needle) || row.lastName.toLowerCase().includes(needle) || playerName(row).toLowerCase().includes(needle),
  )
}

export function sortPlayers(rows: ResponseRow[]): ResponseRow[] {
  return [...rows].sort(
    (a, b) => a.lastName.localeCompare(b.lastName, undefined, { sensitivity: 'base' }) || a.firstName.localeCompare(b.firstName, undefined, { sensitivity: 'base' }),
  )
}

// One group per bracket, ordered by date then Morning before Afternoon, each holding its matches
// and the players split by their answer for that slot (a player can land in different groups in
// different slots). Pass already-filtered rows to apply a search.
export function groupBySlot(
  responses: Pick<SectionAvailabilityRoundResponses, 'brackets' | 'responses'>,
  matches: SectionAvailabilityRoundMatch[],
): SlotGroup[] {
  const brackets = [...responses.brackets].sort(
    (a, b) => a.windowDate.localeCompare(b.windowDate) || (a.dayPart === b.dayPart ? 0 : a.dayPart === 'MORNING' ? -1 : 1),
  )
  const players = sortPlayers(responses.responses)
  return brackets.map((bracket) => {
    const group: SlotGroup = {
      bracket,
      matches: matches
        .filter((match) => match.windowId === bracket.windowId)
        .sort((a, b) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime()),
      available: [],
      unsure: [],
      unavailable: [],
      noResponse: [],
    }
    players.forEach((row) => {
      const status = statusFor(row, bracket.windowId)
      if (status === 'AVAILABLE') group.available.push(row)
      else if (status === 'UNSURE') group.unsure.push(row)
      else if (status === 'UNAVAILABLE') group.unavailable.push(row)
      else group.noResponse.push(row)
    })
    return group
  })
}

// docs/specs/085 (C6): how many players answered every slot, some slots or none. An answer counts for a slot
// only when its windowId is one of the brackets and its status is set (a row's statuses can carry other
// windows, or null answers, so statuses.length is not used). Pass the UNFILTERED rows: a search never changes it.
export function answeredCoverage(
  rows: ResponseRow[],
  brackets: Pick<SectionAvailabilityRoundBracket, 'windowId'>[],
): { all: number; some: number; none: number } {
  const windowIds = new Set(brackets.map((bracket) => bracket.windowId))
  const coverage = { all: 0, some: 0, none: 0 }
  rows.forEach((row) => {
    const answered = new Set(row.statuses.filter((entry) => entry.status !== null && windowIds.has(entry.windowId)).map((entry) => entry.windowId)).size
    if (answered === 0) coverage.none += 1
    else if (answered === windowIds.size) coverage.all += 1
    else coverage.some += 1
  })
  return coverage
}

// What the page hands each view so a tap on a player can set their answer (or not, when closed).
export interface OverrideProps {
  // `${playerProfileId}:${windowId}` of the in-flight override, so only that control is disabled.
  pendingKey: string | null
  // Resolves true once saved, false if it failed, so a view can move focus off a trigger that is
  // about to unmount (the player lands in another group).
  onOverride: (row: ResponseRow, windowId: string, status: AvailabilityStatus) => Promise<boolean>
}
