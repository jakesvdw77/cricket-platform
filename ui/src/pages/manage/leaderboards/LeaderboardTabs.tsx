import { useSearchParams } from 'react-router-dom'
import { ViewTabsRow } from '../../../components/ViewTabsRow'
import { LEADERBOARD_TABS, resolveLeaderboardTab } from './leaderboardTabConfig'

// docs/specs/103-player-stats.md and 140: the Batting | Bowling | Fielding | Awards | Teams row, bound to ?tab= (default Batting). A real tab
// row (`ViewTabsRow`, link navigation, no icons, aria-current). Each tab keeps the other parameters (?sort=), the pattern of PlayerStatsTabs.
export function LeaderboardTabs() {
  const [searchParams] = useSearchParams()
  const active = resolveLeaderboardTab(searchParams.get('tab'))

  const searchFor = (value: string) => {
    const next = new URLSearchParams(searchParams)
    next.set('tab', value)
    // The player columns and the team columns differ: a sort never crosses into or out of the Teams tab.
    if (value === 'teams' || active === 'teams') {
      next.delete('sort')
      next.delete('dir')
    }
    return `?${next.toString()}`
  }

  return <ViewTabsRow aria-label="Leaderboards" replace value={active} tabs={LEADERBOARD_TABS.map((tab) => ({ value: tab.value, label: tab.label, to: { search: searchFor(tab.value) } }))} />
}
