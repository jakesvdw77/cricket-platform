// docs/specs/064-unified-availability-polls.md: the shared close/reopen rules for squad and group
// polls. Lives in utils/ (not pages/manage/availability/pollHelpers.ts, which re-exports it) so
// components/** such as MatchAvailabilityTab can use it without importing from pages/**.

interface ClosablePoll {
  autoClose: boolean
  scheduledCloseAt: string | null
}

// A closed poll can be reopened any time when Autoclose is off, and only until its automatic close
// time when it is on - the backend answers 409 for a reopen at/after scheduledCloseAt.
export function canReopen(poll: ClosablePoll, now: Date = new Date()): boolean {
  if (!poll.autoClose || !poll.scheduledCloseAt) {
    return true
  }
  return now.getTime() < new Date(poll.scheduledCloseAt).getTime()
}

export const CANNOT_REOPEN_MESSAGE = 'Closed. Can no longer be reopened.'

export function closePollTitle(): string {
  return 'Close this poll?'
}

export function closePollDescription(autoClose: boolean): string {
  return autoClose
    ? 'Players will no longer be able to respond. You can reopen it until its automatic close time.'
    : 'Players will no longer be able to respond. You can reopen it at any time.'
}
