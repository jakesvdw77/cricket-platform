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

// The edit tab that matches each league page view (the view's last path segment), so the header Edit link opens the tab the
// user is looking at. Any other view maps to no tab, which is Details.
const EDIT_TAB_FOR_VIEW: Record<string, LeagueEditTab> = {
  schedule: 'schedule',
  teams: 'teams',
  conditions: 'conditions',
}

export function editTabForView(segment: string | undefined): LeagueEditTab | null {
  return (segment && EDIT_TAB_FOR_VIEW[segment]) || null
}
