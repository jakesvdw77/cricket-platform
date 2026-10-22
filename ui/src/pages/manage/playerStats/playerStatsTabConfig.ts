export const PLAYER_STATS_TABS = [
  { value: 'dashboard', label: 'Overview' },
  { value: 'batting', label: 'Batting' },
  { value: 'bowling', label: 'Bowling' },
  { value: 'fielding', label: 'Fielding' },
  { value: 'awards', label: 'Awards & record' },
  { value: 'matches', label: 'Matches' },
] as const

export type PlayerStatsTab = (typeof PLAYER_STATS_TABS)[number]['value']

// docs/specs/117-stats-dashboard.md (decisions 11 and 13): Dashboard is the first tab, and so the landing tab: a missing or unknown
// ?tab= value is Dashboard (every link without ?tab= lands on it; a link carrying ?tab= is unchanged).
export function resolvePlayerStatsTab(param: string | null): PlayerStatsTab {
  return PLAYER_STATS_TABS.find((tab) => tab.value === param)?.value ?? 'dashboard'
}
