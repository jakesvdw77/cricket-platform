// docs/specs/031-jersey-numbers.md's display convention — "#{jersey} {name}" when a squad member
// has a squadJerseyNumber, otherwise just their name. Originally a private helper inside
// MatchAvailabilityTab.tsx; pulled out here per docs/specs/034-availability-polls-dashboard.md's
// Rollout Notes so AvailabilityRespondentAvatars can reuse it verbatim rather than a second,
// copy-pasted formatter.
export interface SquadDisplayNameInput {
  firstName: string
  lastName: string
  squadJerseyNumber: number | null
}

export function squadDisplayName(row: SquadDisplayNameInput): string {
  const name = `${row.firstName} ${row.lastName}`
  return row.squadJerseyNumber != null ? `#${row.squadJerseyNumber} ${name}` : name
}
