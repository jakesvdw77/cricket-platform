import { Tab, Tabs } from '@mui/material'
import { Link as RouterLink, useSearchParams } from 'react-router-dom'
import { LEADERBOARD_TABS, resolveLeaderboardTab } from './leaderboardTabConfig'
import { VIEW_TABS_PROPS, viewTabsSx, viewTabSx } from '../../../utils/viewTabs'

// docs/specs/103-player-stats.md: the Batting | Bowling | Fielding | Awards strip, bound to ?tab= (default Batting). Each tab is a router link
// that replaces the history entry and keeps the other parameters (?sort=), the pattern of PlayerStatsTabs.
export function LeaderboardTabs() {
  const [searchParams] = useSearchParams()
  const active = resolveLeaderboardTab(searchParams.get('tab'))

  const searchFor = (value: string) => {
    const next = new URLSearchParams(searchParams)
    next.set('tab', value)
    return `?${next.toString()}`
  }

  return (
    <Tabs value={active} aria-label="Leaderboards" {...VIEW_TABS_PROPS} sx={viewTabsSx}>
      {LEADERBOARD_TABS.map((tab) => (
        <Tab key={tab.value} value={tab.value} label={tab.label} component={RouterLink} to={{ search: searchFor(tab.value) }} replace sx={viewTabSx} />
      ))}
    </Tabs>
  )
}
