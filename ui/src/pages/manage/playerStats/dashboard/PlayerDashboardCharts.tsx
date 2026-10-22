import { CardGrid } from '../statsParts'
import type { PlayerDashboard } from '../../../../api/playerDashboardApi'
import { RunsPerInningsCard } from './RunsPerInningsCard'
import { DismissalsCard } from './DismissalsCard'
import { BattingTrendCard } from './BattingTrendCard'
import { WicketsPerMatchCard } from './WicketsPerMatchCard'
import { WicketsByTypeCard } from './WicketsByTypeCard'
import { EconomyRateCard } from './EconomyRateCard'

export interface PlayerDashboardChartsProps {
  data: PlayerDashboard
  backTo: string
  // the previous figures kept on screen while a filter change loads
  dimmed: boolean
}

// docs/specs/117-stats-dashboard.md (decision 20): the six chart cards in their final order, which is also the DOM order: Runs per innings
// (full width), How you were dismissed and Batting trend, Wickets per match (full width), Wickets by type and Economy rate. Batting and
// bowling follow the same pattern. This module (and so @mui/x-charts) is its own chunk, loaded with React.lazy.
export default function PlayerDashboardCharts({ data, backTo, dimmed }: PlayerDashboardChartsProps) {
  return (
    <CardGrid>
      <RunsPerInningsCard data={data} backTo={backTo} dimmed={dimmed} />
      <DismissalsCard data={data} dimmed={dimmed} />
      <BattingTrendCard data={data} backTo={backTo} dimmed={dimmed} />
      <WicketsPerMatchCard data={data} backTo={backTo} dimmed={dimmed} />
      <WicketsByTypeCard data={data} dimmed={dimmed} />
      <EconomyRateCard data={data} backTo={backTo} dimmed={dimmed} />
    </CardGrid>
  )
}
