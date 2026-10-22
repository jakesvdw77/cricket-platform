import { Suspense, lazy, useState } from 'react'
import { Box, Typography } from '@mui/material'
import { DashboardCard, DashboardSkeleton } from '../../../../components/DashboardCard'
import { CollapsibleSection } from '../../../../components/CollapsibleSection'
import type { PlayerStats } from '../../../../api/playerStatsApi'
import type { PlayerDashboard } from '../../../../api/playerDashboardApi'
import { PlayerHeadlineTiles } from '../PlayerHeadlineTiles'
import { loadPlayerDashboardCharts } from './playerDashboardChunk'
import type { PlayerDashboardGroupKey } from './PlayerDashboardCharts'

const PlayerDashboardCharts = lazy(loadPlayerDashboardCharts)

const GROUPS: { key: PlayerDashboardGroupKey; title: string; defaultOpen: boolean; cards: { testId: string; title: string; subtitle: string; fullWidth?: boolean; wide?: boolean }[] }[] = [
  {
    key: 'batting',
    title: 'Batting',
    defaultOpen: true,
    cards: [
      { testId: 'runs-per-innings', title: 'Runs per innings', subtitle: 'Batting', fullWidth: true },
      { testId: 'dismissals', title: 'How you were dismissed', subtitle: 'Batting' },
      { testId: 'batting-trend', title: 'Batting trend', subtitle: 'Batting', wide: true },
    ],
  },
  {
    key: 'bowling',
    title: 'Bowling',
    defaultOpen: false,
    cards: [
      { testId: 'wickets-per-match', title: 'Wickets per match', subtitle: 'Bowling', fullWidth: true },
      { testId: 'wickets-by-type', title: 'Wickets by type', subtitle: 'Bowling' },
      { testId: 'economy-rate', title: 'Economy rate', subtitle: 'Bowling', wide: true },
    ],
  },
]

export interface PlayerDashboardTabProps {
  stats: PlayerStats
  // the page's own overview read (hoisted so it runs in parallel with the stats read)
  dashboard: { data: PlayerDashboard | undefined; isError: boolean; isPlaceholderData: boolean; refetch: () => unknown }
  backTo: string
}

interface GroupProps {
  group: (typeof GROUPS)[number]
  dashboard: PlayerDashboardTabProps['dashboard']
  backTo: string
}

// A collapsible group: the shared CollapsibleSection (title, 44 px Hide / Show button), then its three cards. Collapsed, nothing below the
// header is rendered, so the chart chunk is not needed. State is per visit.
function DashboardGroup({ group, dashboard, backTo }: GroupProps) {
  const [open, setOpen] = useState(group.defaultOpen)
  const { data, isPlaceholderData } = dashboard
  const skeleton = <DashboardSkeleton cards={group.cards} label="Loading the overview" />
  return (
    <CollapsibleSection title={group.title} testId={`dashboard-group-${group.key}`} open={open} onToggle={() => setOpen((value) => !value)}>
      {data ? (
        <Suspense fallback={skeleton}>
          <PlayerDashboardCharts data={data} backTo={backTo} group={group.key} dimmed={isPlaceholderData} />
        </Suspense>
      ) : (
        skeleton
      )}
    </CollapsibleSection>
  )
}

// docs/specs/117-stats-dashboard.md (decisions 14 and 25): the first tab, labelled "Overview". The same four-tile strip as the Matches tab (the
// shared PlayerHeadlineTiles), then two collapsible groups: Batting (open) and Bowling (closed) with three chart cards each. The tab adds no
// filter bar, basis line or tab strip: those are the page's own. The tiles never wait for the charts; a failed read is one
// "Couldn't load the overview" card and the tiles stay.
export function PlayerDashboardTab({ stats, dashboard, backTo }: PlayerDashboardTabProps) {
  const { data, isError, refetch } = dashboard

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }} data-testid="dashboard-tab">
      <PlayerHeadlineTiles stats={stats} />
      {isError && !data ? (
        <DashboardCard testId="dashboard" title="Overview" headingLevel="h2" fullWidth error={{ onRetry: () => void refetch() }} />
      ) : (
        GROUPS.map((group) => <DashboardGroup key={group.key} group={group} dashboard={dashboard} backTo={backTo} />)
      )}
      <Typography sx={{ fontSize: '0.8125rem', color: 'text.secondary' }}>Ball-by-ball and partnership charts are not available: that data is not captured yet.</Typography>
    </Box>
  )
}
