import type { Player } from '../api/playerApi'

export interface SquadPickerFilters {
  search: string
  // '' means every section of the club
  sectionId: string
}

// docs/specs/142-teams-revamp.md (Add Players to the squad): the candidates the squad picker lists. Search matches any part of the
// first or last name; a section filter keeps players tagged to that section. Sorted by last then first name so duplicates sit together.
// Age is a label, never a rule: a player outside the section is still addable by clearing the filter.
export function filterSquadCandidates(players: Player[], { search, sectionId }: SquadPickerFilters): Player[] {
  const needle = search.trim().toLowerCase()
  return players
    .filter((player) => !sectionId || player.sectionIds.includes(sectionId))
    .filter((player) => !needle || `${player.firstName} ${player.lastName}`.toLowerCase().includes(needle))
    .sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName))
}
