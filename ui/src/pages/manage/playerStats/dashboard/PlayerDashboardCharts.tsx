import { DashboardGrid } from '../../../../components/DashboardCard'
import type { PlayerDashboard } from '../../../../api/playerDashboardApi'
import { RunsPerInningsCard } from './RunsPerInningsCard'
import { DismissalsCard } from './DismissalsCard'
import { BattingTrendCard } from './BattingTrendCard'
import { WicketsPerMatchCard } from './WicketsPerMatchCard'
import { WicketsByTypeCard } from './WicketsByTypeCard'
import { EconomyRateCard } from './EconomyRateCard'

export type PlayerDashboardGroupKey = 'batting' | 'bowling'

export interface PlayerDashboardChartsProps {
  data: PlayerDashboard
  backTo: string
  // which group's cards to draw; each expanded group loads this module and draws only its own three
  group: PlayerDashboardGroupKey
  // the previous figures kept on screen while a filter change loads
  dimmed: boolean
}

// docs/specs/117-stats-dashboard.md (decisions 20 and 25): one group's cards in their final order, which is also the DOM order. Batting: Runs per
// innings (full width), How you were dismissed and Batting trend. Bowling: Wickets per match (full width), Wickets by type and Economy rate.
// A collapsed group never mounts this module. This module (and so @mui/x-charts) is its own chunk, loaded with React.lazy.
export default function PlayerDashboardCharts({ data, backTo, group, dimmed }: PlayerDashboardChartsProps) {
  if (group === 'batting') {
    return (
      <DashboardGrid>
        <RunsPerInningsCard data={data} backTo={backTo} dimmed={dimmed} />
        <DismissalsCard data={data} dimmed={dimmed} />
        <BattingTrendCard data={data} backTo={backTo} dimmed={dimmed} />
      </DashboardGrid>
    )
  }
  return (
    <DashboardGrid>
      <WicketsPerMatchCard data={data} backTo={backTo} dimmed={dimmed} />
      <WicketsByTypeCard data={data} dimmed={dimmed} />
      <EconomyRateCard data={data} backTo={backTo} dimmed={dimmed} />
    </DashboardGrid>
  )
}
