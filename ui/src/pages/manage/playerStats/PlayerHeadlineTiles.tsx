import { PageCounters } from '../../../components/PageCounters'
import type { PlayerStats } from '../../../api/playerStatsApi'
import { NOT_ON_FILE } from '../../../utils/playerFormat'

const figure = (value: number | null | undefined) => (value === null || value === undefined ? NOT_ON_FILE : String(value))

// docs/specs/115, 117 (decision 14) and 141: the Matches, Runs, Wickets, Catches figures of a player's statistics, taken from the PlayerStats the page holds,
// as the same static compact `PageCounters` row every page shows directly under its title row (page-anatomy section 1: title, figures, tabs, toolbar, data). The page
// renders them once, above the tabs, so they are the same on every tab; the basis sentence is the Matches card's info icon, not a line of its own.
export function PlayerHeadlineTiles({ stats, basis }: { stats: PlayerStats; basis?: string }) {
  return (
    <PageCounters
      density="compact"
      items={[
        { id: 'matches', testId: 'tile-matches', label: 'Matches', value: figure(stats.basis.matchesCounted), info: basis },
        { id: 'runs', testId: 'tile-runs', label: 'Runs', value: figure(stats.batting.runs) },
        { id: 'wickets', testId: 'tile-wickets', label: 'Wickets', value: figure(stats.bowling.wickets) },
        { id: 'catches', testId: 'tile-catches', label: 'Catches', value: figure(stats.fielding.catches) },
      ]}
    />
  )
}
