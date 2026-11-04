import { Box } from '@mui/material'
import { KeyFigureTile } from '../../../components/KeyFigureTile'
import type { PlayerStats } from '../../../api/playerStatsApi'
import { NOT_ON_FILE } from '../../../utils/playerFormat'

const tileValue = (value: number | null | undefined) => (value === null || value === undefined ? NOT_ON_FILE : String(value))

// docs/specs/115-player-match-list.md, 117-stats-dashboard.md (decision 14) and 141: the Matches, Runs, Wickets, Catches strip of a player's statistics, taken from
// the PlayerStats the page already holds, as the compact counters every page uses (no icons, page-anatomy section 2). One shared part: the Matches tab and the
// Overview tab render it, so both show the same figures with the same `tile-*` test ids.
export function PlayerHeadlineTiles({ stats }: { stats: PlayerStats }) {
  return (
    <Box data-testid="stat-tiles" sx={{ display: 'grid', gap: 0.75, gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' } }}>
      <KeyFigureTile counter testId="tile-matches" label="Matches" value={tileValue(stats.basis.matchesCounted)} />
      <KeyFigureTile counter testId="tile-runs" label="Runs" value={tileValue(stats.batting.runs)} />
      <KeyFigureTile counter testId="tile-wickets" label="Wickets" value={tileValue(stats.bowling.wickets)} />
      <KeyFigureTile counter testId="tile-catches" label="Catches" value={tileValue(stats.fielding.catches)} />
    </Box>
  )
}
