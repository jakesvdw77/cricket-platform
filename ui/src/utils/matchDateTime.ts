// "Sat, 3 Oct, 10:00": a match's kickoff, shared by the Match View, the poll screens and the
// selection dialog (docs/specs/076-team-selection.md).
export function formatMatchDateTime(matchDate: string): string {
  return new Date(matchDate).toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}
