export const LEAGUE_EDIT_TABS = [
  { value: 'details', label: 'Details' },
  { value: 'teams', label: 'Teams' },
  { value: 'schedule', label: 'Schedule' },
  { value: 'conditions', label: 'Playing conditions' },
  { value: 'contacts', label: 'Contacts' },
] as const

export type LeagueEditTab = (typeof LEAGUE_EDIT_TABS)[number]['value']

// A missing or unknown ?tab= value is Details.
export function resolveLeagueEditTab(param: string | null): LeagueEditTab {
  return LEAGUE_EDIT_TABS.find((tab) => tab.value === param)?.value ?? 'details'
}
