import { Suspense, lazy } from 'react'
import { Box, Typography } from '@mui/material'
import { DashboardCard } from '../../../../components/DashboardCard'
import type { PlayerStats } from '../../../../api/playerStatsApi'
import type { PlayerDashboard } from '../../../../api/playerDashboardApi'
import { PlayerHeadlineTiles } from '../PlayerHeadlineTiles'
import { DashboardSkeleton } from './DashboardSkeleton'
import { loadPlayerDashboardCharts } from './playerDashboardChunk'

const PlayerDashboardCharts = lazy(loadPlayerDashboardCharts)

const SKELETON_CARDS = [
  { testId: 'runs-per-innings', title: 'Runs per innings', subtitle: 'Batting', fullWidth: true },
  { testId: 'dismissals', title: 'How you were dismissed', subtitle: 'Batting' },
  { testId: 'batting-trend', title: 'Batting trend', subtitle: 'Batting' },
  { testId: 'wickets-per-match', title: 'Wickets per match', subtitle: 'Bowling', fullWidth: true },
  { testId: 'wickets-by-type', title: 'Wickets by type', subtitle: 'Bowling' },
  { testId: 'economy-rate', title: 'Economy rate', subtitle: 'Bowling' },
]

export interface PlayerDashboardTabProps {
  stats: PlayerStats
  // the page's own dashboard read (hoisted so it runs in parallel with the stats read)
  dashboard: { data: PlayerDashboard | undefined; isError: boolean; isPlaceholderData: boolean; refetch: () => unknown }
  backTo: string
}

// docs/specs/117-stats-dashboard.md (decision 14): the first tab. The same four-tile strip as the Matches tab (the shared
// PlayerHeadlineTiles), then the six chart cards. The tab adds no filter bar, basis line or tab strip: those are the page's own.
// The tiles never wait for the charts; a failed read is one "Couldn't load the dashboard" card and the tiles stay.
export function PlayerDashboardTab({ stats, dashboard, backTo }: PlayerDashboardTabProps) {
  const { data, isError, isPlaceholderData, refetch } = dashboard

  let content
  if (isError && !data) {
    content = <DashboardCard testId="dashboard" title="Dashboard" fullWidth error={{ onRetry: () => void refetch() }} />
  } else if (!data) {
    content = <DashboardSkeleton cards={SKELETON_CARDS} label="Loading the dashboard" />
  } else {
    content = (
      <Suspense fallback={<DashboardSkeleton cards={SKELETON_CARDS} label="Loading the dashboard" />}>
        <PlayerDashboardCharts data={data} backTo={backTo} dimmed={isPlaceholderData} />
      </Suspense>
    )
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }} data-testid="dashboard-tab">
      <PlayerHeadlineTiles stats={stats} />
      {content}
      <Typography sx={{ fontSize: '0.8125rem', color: 'text.secondary' }}>Ball-by-ball and partnership charts are not available: that data is not captured yet.</Typography>
    </Box>
  )
}
