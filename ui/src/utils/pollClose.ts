// docs/specs/064-unified-availability-polls.md: the shared close/reopen rules for squad and group
// polls. Lives in utils/ (not pages/manage/availability/pollHelpers.ts, which re-exports it) so
// components/** such as PollShareDialog can use it without importing from pages/**.

export function closePollTitle(): string {
  return 'Close this poll?'
}

export function closePollDescription(autoClose: boolean): string {
  return autoClose
    ? 'Players will no longer be able to respond. You can reopen it later by choosing a new close time.'
    : 'Players will no longer be able to respond. You can reopen it at any time.'
}
