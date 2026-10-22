import { DashboardGrid } from '../../../../components/DashboardCard'
import type { TeamCardProps } from './teamDashboardParts'
import { ResultsCard } from './ResultsCard'
import { RunsScoredCard } from './RunsScoredCard'
import { RunRateTrendCard } from './RunRateTrendCard'
import { ExtrasConcededCard } from './ExtrasConcededCard'
import { DotBallsCard } from './DotBallsCard'

// docs/specs/117-stats-dashboard.md (decision 12, mockup "Team"): the five chart cards in a two-column grid from md: Results and Runs scored
// v conceded, Run rate trend full width, then Extras conceded and Dot balls. This module (and so @mui/x-charts) is its own chunk.
export default function TeamDashboardCharts({ data, backTo, dimmed }: TeamCardProps) {
  return (
    <DashboardGrid>
      <ResultsCard data={data} dimmed={dimmed} />
      <RunsScoredCard data={data} backTo={backTo} dimmed={dimmed} />
      <RunRateTrendCard data={data} backTo={backTo} dimmed={dimmed} />
      <ExtrasConcededCard data={data} backTo={backTo} dimmed={dimmed} />
      <DotBallsCard data={data} backTo={backTo} dimmed={dimmed} />
    </DashboardGrid>
  )
}
