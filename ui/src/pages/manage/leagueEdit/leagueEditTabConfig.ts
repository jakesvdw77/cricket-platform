export const LEAGUE_EDIT_TABS = [
  { value: 'details', label: 'Details' },
  { value: 'branding', label: 'Branding' },
  { value: 'conditions', label: 'Playing Conditions' },
  { value: 'contacts', label: 'Contacts' },
] as const

export type LeagueEditTab = (typeof LEAGUE_EDIT_TABS)[number]['value']

// A missing or unknown ?tab= value is Details, including the retired teams and schedule tabs (docs/specs/128): old links open Details.
export function resolveLeagueEditTab(param: string | null): LeagueEditTab {
  return LEAGUE_EDIT_TABS.find((tab) => tab.value === param)?.value ?? 'details'
}

// The edit tab that matches each league page view (the view's last path segment), so the header Edit link opens the tab the
// user is looking at. Schedule and Teams are managed on the league page, so they and any other view map to no tab (Details).
const EDIT_TAB_FOR_VIEW: Record<string, LeagueEditTab> = {
  conditions: 'conditions',
}

export function editTabForView(segment: string | undefined): LeagueEditTab | null {
  return (segment && EDIT_TAB_FOR_VIEW[segment]) || null
}
