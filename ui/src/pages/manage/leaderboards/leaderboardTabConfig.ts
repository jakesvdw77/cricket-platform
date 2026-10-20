export const LEADERBOARD_TABS = [
  { value: 'batting', label: 'Batting' },
  { value: 'bowling', label: 'Bowling' },
  { value: 'fielding', label: 'Fielding' },
  { value: 'awards', label: 'Awards' },
] as const

export type LeaderboardTab = (typeof LEADERBOARD_TABS)[number]['value']

// A missing or unknown ?tab= value is Batting.
export function resolveLeaderboardTab(param: string | null): LeaderboardTab {
  return LEADERBOARD_TABS.find((tab) => tab.value === param)?.value ?? 'batting'
}
