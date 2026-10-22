import { Suspense, lazy } from 'react'
import { Typography } from '@mui/material'
import { DashboardCard, DashboardSkeleton } from '../../../../components/DashboardCard'
import { CollapsibleSection } from '../../../../components/CollapsibleSection'
import type { TeamDashboard } from '../../../../api/teamDashboardApi'
import { loadTeamDashboardCharts } from './teamDashboardChunk'

const TeamDashboardCharts = lazy(loadTeamDashboardCharts)

const SKELETON_CARDS = [
  { testId: 'results', title: 'Results' },
  { testId: 'runs-scored', title: 'Runs scored v conceded', wide: true },
  { testId: 'run-rate-trend', title: 'Run rate trend', fullWidth: true },
  { testId: 'extras-conceded', title: 'Extras conceded' },
  { testId: 'dot-balls', title: 'Dot balls', wide: true },
]

export interface TeamDashboardBlockProps {
  // expanded by default; per visit (the page owns it so no request goes out while hidden)
  shown: boolean
  onToggle: () => void
  dashboard: { data: TeamDashboard | undefined; isError: boolean; isPlaceholderData: boolean; refetch: () => unknown }
  backTo: string
}

// docs/specs/117-stats-dashboard.md (decisions 11 and 14): the team page's Dashboard block, directly after the Recent form strip and
// before the existing cards. The shared CollapsibleSection (title and a Hide / Show control), then five
// chart cards that follow the page's filters. Hidden, it renders only the header and the page makes no request.
export function TeamDashboardBlock({ shown, onToggle, dashboard, backTo }: TeamDashboardBlockProps) {
  const { data, isError, isPlaceholderData, refetch } = dashboard

  let content
  if (isError && !data) {
    content = <DashboardCard testId="dashboard" title="Overview" fullWidth error={{ onRetry: () => void refetch() }} />
  } else if (!data) {
    content = <DashboardSkeleton cards={SKELETON_CARDS} label="Loading the overview" />
  } else {
    content = (
      <Suspense fallback={<DashboardSkeleton cards={SKELETON_CARDS} label="Loading the overview" />}>
        <TeamDashboardCharts data={data} backTo={backTo} dimmed={isPlaceholderData} />
      </Suspense>
    )
  }

  return (
    <CollapsibleSection
      title="Overview"
      description={shown ? 'Same filters as above · 5 charts' : 'Results, runs, run rate, extras and dot balls'}
      testId="team-dashboard"
      buttonVariant="outlined"
      open={shown}
      onToggle={onToggle}
    >
      {content}
      <Typography sx={{ fontSize: '0.8125rem', color: 'text.secondary' }}>Ball-by-ball and partnership charts are not available: that data is not captured yet.</Typography>
    </CollapsibleSection>
  )
}
