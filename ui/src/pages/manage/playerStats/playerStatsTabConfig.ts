export const PLAYER_STATS_TABS = [
  { value: 'batting', label: 'Batting' },
  { value: 'bowling', label: 'Bowling' },
  { value: 'fielding', label: 'Fielding' },
  { value: 'awards', label: 'Awards & record' },
  { value: 'matches', label: 'Matches' },
] as const

export type PlayerStatsTab = (typeof PLAYER_STATS_TABS)[number]['value']

// A missing or unknown ?tab= value is Batting.
export function resolvePlayerStatsTab(param: string | null): PlayerStatsTab {
  return PLAYER_STATS_TABS.find((tab) => tab.value === param)?.value ?? 'batting'
}
