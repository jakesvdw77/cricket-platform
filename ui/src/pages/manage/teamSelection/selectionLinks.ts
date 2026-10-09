// docs/specs/093-team-selection-hub.md: where "Select players" and a row of the Matches view lead. For now the
// existing Edit Match Playing XI tab; slice 3 (the Select team page) swaps this one helper.
export function selectTeamPath(matchId: string, _sideId?: string | null): string {
  return `/manage/fixtures/matches/${matchId}/edit?tab=playing-xi`
}
