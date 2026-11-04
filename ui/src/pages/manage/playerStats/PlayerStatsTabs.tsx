import { useSearchParams } from 'react-router-dom'
import { ViewTabsRow } from '../../../components/ViewTabsRow'
import { PLAYER_STATS_TABS, resolvePlayerStatsTab } from './playerStatsTabConfig'

// docs/specs/103 and 141: the Overview | Batting | Bowling | Fielding | Awards & record | Matches row of the breakdown page, the shared real tab row
// (page-anatomy section 4). The active tab lives in ?tab= (default Overview), each tab a link that replaces the history entry and keeps the other
// parameters, so Back leaves the page rather than stepping through tabs.
export function PlayerStatsTabs() {
  const [searchParams] = useSearchParams()
  const active = resolvePlayerStatsTab(searchParams.get('tab'))
  const searchFor = (value: string) => {
    const next = new URLSearchParams(searchParams)
    next.set('tab', value)
    return `?${next.toString()}`
  }
  return (
    <ViewTabsRow
      aria-label="Statistics"
      value={active}
      replace
      tabs={PLAYER_STATS_TABS.map((tab) => ({ value: tab.value, label: tab.label, to: { search: searchFor(tab.value) } }))}
    />
  )
}
