export const LEADERBOARD_TABS = [
  { value: 'standings', label: 'Standings' },
  { value: 'awards', label: 'Awards' },
] as const

export type LeaderboardTab = (typeof LEADERBOARD_TABS)[number]['value']

// A missing or unknown ?tab= value is Standings.
export function resolveLeaderboardTab(param: string | null): LeaderboardTab {
  return LEADERBOARD_TABS.find((tab) => tab.value === param)?.value ?? 'standings'
}
