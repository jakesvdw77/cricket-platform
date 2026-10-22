import { Tab, Tabs } from '@mui/material'
import { Link as RouterLink, useSearchParams } from 'react-router-dom'
import { PLAYER_STATS_TABS, resolvePlayerStatsTab } from './playerStatsTabConfig'
import { VIEW_TABS_PROPS, viewTabsSx, viewTabSx } from '../../../utils/viewTabs'

// docs/specs/103-player-stats.md: the Dashboard | Batting | Bowling | Fielding | Awards & record | Matches strip of the breakdown page. The active tab lives in
// ?tab= (default Dashboard), each tab a router link that replaces the history entry and keeps the other parameters; the
// same convention as LeagueEditTabs.
export function PlayerStatsTabs() {
  const [searchParams] = useSearchParams()
  const active = resolvePlayerStatsTab(searchParams.get('tab'))

  const searchFor = (value: string) => {
    const next = new URLSearchParams(searchParams)
    next.set('tab', value)
    return `?${next.toString()}`
  }

  return (
    <Tabs value={active} aria-label="Statistics" {...VIEW_TABS_PROPS} sx={viewTabsSx}>
      {PLAYER_STATS_TABS.map((tab) => (
        <Tab
          key={tab.value}
          value={tab.value}
          label={tab.label}
          component={RouterLink}
          to={{ search: searchFor(tab.value) }}
          replace
          sx={viewTabSx}
        />
      ))}
    </Tabs>
  )
}
