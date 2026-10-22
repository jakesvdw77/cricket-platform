import SportsCricketOutlinedIcon from '@mui/icons-material/SportsCricketOutlined'
import SportsBaseballOutlinedIcon from '@mui/icons-material/SportsBaseballOutlined'
import PanToolOutlinedIcon from '@mui/icons-material/PanToolOutlined'
import SportsScoreOutlinedIcon from '@mui/icons-material/SportsScoreOutlined'
import type { PlayerStats } from '../../../api/playerStatsApi'
import { NOT_ON_FILE } from '../../../utils/playerFormat'
import { StatTile, StatTileStrip } from './statsParts'

const tileValue = (value: number | null | undefined) => (value === null || value === undefined ? NOT_ON_FILE : String(value))

// docs/specs/115-player-match-list.md and docs/specs/117-stats-dashboard.md (decision 14): the Matches, Runs, Wickets, Catches strip
// of a player's statistics, taken from the PlayerStats the page already holds. One shared part: the Matches tab and the Dashboard tab
// render it, so both show the same tiles with the same `tile-*` test ids.
export function PlayerHeadlineTiles({ stats }: { stats: PlayerStats }) {
  return (
    <StatTileStrip>
      <StatTile testId="tile-matches" icon={<SportsScoreOutlinedIcon />} label="Matches" value={tileValue(stats.basis.matchesCounted)} />
      <StatTile testId="tile-runs" icon={<SportsCricketOutlinedIcon />} label="Runs" value={tileValue(stats.batting.runs)} />
      <StatTile testId="tile-wickets" tone="success" icon={<SportsBaseballOutlinedIcon />} label="Wickets" value={tileValue(stats.bowling.wickets)} />
      <StatTile testId="tile-catches" icon={<PanToolOutlinedIcon />} label="Catches" value={tileValue(stats.fielding.catches)} />
    </StatTileStrip>
  )
}
