// docs/specs/093-team-selection-hub.md: where "Select players", "Select team" and a row of the Matches view lead - the
// Select team page of one side of a match. A side that does not exist yet has no id, so the path carries the
// placeholder "home" or "away"; the page resolves it (and creates the side on first use, as the Edit Match tabs did).
export const SIDE_PLACEHOLDERS = ['home', 'away'] as const

export function selectTeamPath(matchId: string, sideId?: string | null, home = true): string {
  return `/manage/team-selection/matches/${matchId}/sides/${sideId ?? (home ? 'home' : 'away')}`
}
