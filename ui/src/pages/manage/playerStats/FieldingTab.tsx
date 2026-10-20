import SportsHandballOutlinedIcon from '@mui/icons-material/SportsHandballOutlined'
import BarChartOutlinedIcon from '@mui/icons-material/BarChartOutlined'
import PanToolOutlinedIcon from '@mui/icons-material/PanToolOutlined'
import DirectionsRunOutlinedIcon from '@mui/icons-material/DirectionsRunOutlined'
import FunctionsOutlinedIcon from '@mui/icons-material/FunctionsOutlined'
import { InfoCard } from '../../../components/InfoCard'
import type { PlayerStats } from '../../../api/playerStatsApi'
import { CardGrid, NotCapturedPanel, StatTile, StatTileStrip } from './statsParts'
import { decimals, notCapturedFor } from './statsFormat'

// docs/specs/103-player-stats.md, the Fielding tab: the three counts and dismissals per match as tiles, then the
// Fielding card and the Not captured yet panel (Awards and Record while playing live on the Awards & record tab).
export function FieldingTab({ stats }: { stats: PlayerStats }) {
  const { fielding } = stats
  return (
    <>
      <StatTileStrip>
        <StatTile testId="tile-catches" icon={<PanToolOutlinedIcon />} label="Catches" value={String(fielding.catches)} />
        <StatTile testId="tile-stumpings" icon={<SportsHandballOutlinedIcon />} label="Stumpings" value={String(fielding.stumpings)} />
        <StatTile testId="tile-run-outs" icon={<DirectionsRunOutlinedIcon />} label="Run-outs" value={String(fielding.runOuts)} />
        <StatTile testId="tile-per-match" icon={<FunctionsOutlinedIcon />} label="Dismissals per match" value={decimals(fielding.dismissalsPerMatch, 2)} />
      </StatTileStrip>

      <CardGrid>
        <InfoCard fieldSize="large"
          title="Fielding"
          icon={<BarChartOutlinedIcon />}
          fields={[
            { label: 'Catches', value: String(fielding.catches) },
            { label: 'Stumpings', value: String(fielding.stumpings) },
            { label: 'Run-outs', value: String(fielding.runOuts) },
            { label: 'Dismissals', value: String(fielding.dismissals) },
          ]}
        />
      </CardGrid>

      <NotCapturedPanel items={notCapturedFor(stats.notCaptured, 'fielding')} />
    </>
  )
}
