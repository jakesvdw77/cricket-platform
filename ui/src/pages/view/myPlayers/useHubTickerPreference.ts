import { useHubFlag } from './hubPreferences'

// docs/specs/146: the scoreboard ticker's per-device on/off switch ('off' disables, anything else is on).
export const HUB_TICKER_KEY = 'hub:ticker'

export function useHubTickerPreference() {
  return useHubFlag(HUB_TICKER_KEY)
}
