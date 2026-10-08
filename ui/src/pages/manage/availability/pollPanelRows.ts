import type { OpenAvailabilityPoll } from '../../../api/matchAvailabilityApi'
import type { SectionAvailabilityRound } from '../../../api/sectionAvailabilityApi'
import type { Team } from '../../../api/teamApi'
import { groupPollResponsesPath, squadPollResponsesPath } from '../../../utils/pollRoutes'
import { squadPollTitle } from './pollHelpers'

// docs/specs/085 (G): one poll as the polls panel shows it. The Polls page builds these from the lists it already
// loads (so the panel and the list always agree) and hands them to the hub layout through the hub context.
export interface PollPanelRow {
  key: string
  kind: 'GROUP' | 'SQUAD'
  title: string
  open: boolean
  autoClose: boolean
  scheduledCloseAt: string | null
  // "N of M answered". The poll data only has per-slot totals, so a group poll with several slots reports its
  // best-answered slot (`bestSlot`), which the panel labels as such rather than claiming everyone answered every slot.
  answered: number
  total: number
  bestSlot?: boolean
  path: string
}

export function squadPollRow(poll: OpenAvailabilityPoll, open: boolean, teamsById: Map<string, Team>): PollPanelRow {
  const total = poll.availableCount + poll.unsureCount + poll.unavailableCount + poll.noResponseCount
  return {
    key: `squad-${poll.pollId}`,
    kind: 'SQUAD',
    title: squadPollTitle(poll, teamsById),
    open,
    autoClose: poll.autoClose,
    scheduledCloseAt: poll.scheduledCloseAt,
    answered: total - poll.noResponseCount,
    total,
    path: squadPollResponsesPath(poll.matchId, poll.pollId),
  }
}

export function groupPollRow(round: SectionAvailabilityRound): PollPanelRow {
  let answered = 0
  let total = 0
  for (const bracket of round.brackets) {
    const bracketTotal = bracket.availableCount + bracket.unsureCount + bracket.unavailableCount + bracket.noResponseCount
    total = Math.max(total, bracketTotal)
    answered = Math.max(answered, bracketTotal - bracket.noResponseCount)
  }
  return {
    key: `group-${round.id}`,
    kind: 'GROUP',
    title: round.description,
    open: round.open,
    autoClose: round.autoClose,
    scheduledCloseAt: round.scheduledCloseAt,
    answered,
    total,
    bestSlot: round.brackets.length > 1,
    path: groupPollResponsesPath(round.id),
  }
}

// The "N of M answered" text, or null when there is nobody to count (total 0).
export function answeredText(row: PollPanelRow): string | null {
  if (row.total === 0) return null
  return `${row.answered} of ${row.total} answered${row.bestSlot ? ' (best slot)' : ''}`
}

const CLOSING_SOON_MS = 48 * 60 * 60 * 1000

// The rule behind the "Close in 48 hours" counter (the backend's): an open poll with auto-close whose scheduled close is
// after now and not after now + 48 hours.
export function closesWithin48Hours(row: PollPanelRow, now: number): boolean {
  if (!row.open || !row.autoClose || !row.scheduledCloseAt) return false
  const time = new Date(row.scheduledCloseAt).getTime()
  return time > now && time <= now + CLOSING_SOON_MS
}

const closeTime = (row: PollPanelRow) => (row.scheduledCloseAt ? new Date(row.scheduledCloseAt).getTime() : null)

// Open polls first, soonest closing first (a poll with no close time after those that have one); closed polls after
// them, most recently closed first.
export function sortPollRows(rows: PollPanelRow[]): PollPanelRow[] {
  return [...rows].sort((a, b) => {
    if (a.open !== b.open) return a.open ? -1 : 1
    const ta = closeTime(a)
    const tb = closeTime(b)
    if (ta === null && tb === null) return a.title.localeCompare(b.title)
    if (ta === null) return 1
    if (tb === null) return -1
    return a.open ? ta - tb : tb - ta
  })
}

const pollWord = (count: number) => (count === 1 ? 'poll' : 'polls')

// The line under the panel title. "Polls shown" counter (Show closed on): "3 polls shown, 2 open and 1 closed";
// "Open polls" counter (Show closed off): "2 open polls"; "Close in 48 hours": "1 open poll closing within 48 hours".
export function pollsPanelHeader(kind: 'all' | 'closing-soon', rows: PollPanelRow[], showClosed: boolean): string {
  const open = rows.filter((row) => row.open).length
  if (kind === 'closing-soon') return `${rows.length} open ${pollWord(rows.length)} closing within 48 hours`
  if (!showClosed) return `${open} open ${pollWord(open)}`
  const closed = rows.length - open
  return `${rows.length} ${pollWord(rows.length)} shown, ${open} open and ${closed} closed`
}
