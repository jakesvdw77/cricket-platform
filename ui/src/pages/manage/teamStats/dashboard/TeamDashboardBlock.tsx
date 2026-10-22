import { Suspense, lazy, useId } from 'react'
import { Box, Button as MuiButton, Typography } from '@mui/material'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { DashboardCard } from '../../../../components/DashboardCard'
import type { TeamDashboard } from '../../../../api/teamDashboardApi'
import { DashboardSkeleton } from '../../playerStats/dashboard/DashboardSkeleton'
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
// before the existing cards. A header row with the title and a Hide / Show control (44 px, aria-expanded, aria-controls), then five
// chart cards that follow the page's filters. Hidden, it renders only the header and the page makes no request.
export function TeamDashboardBlock({ shown, onToggle, dashboard, backTo }: TeamDashboardBlockProps) {
  const contentId = useId()
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
    <Box component="section" aria-label="Overview" data-testid="team-dashboard" sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, borderBottom: 1, borderColor: 'divider', pb: 0.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.25, minWidth: 0, flexWrap: 'wrap' }}>
          <Typography component="h2" sx={{ fontSize: '1rem', fontWeight: 700 }}>
            Overview
          </Typography>
          <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>{shown ? 'Same filters as above · 5 charts' : 'Results, runs, run rate, extras and dot balls'}</Typography>
        </Box>
        <MuiButton
          variant="outlined"
          size="small"
          onClick={onToggle}
          aria-expanded={shown}
          aria-controls={contentId}
          data-testid="team-dashboard-toggle"
          startIcon={shown ? <ExpandLessIcon aria-hidden /> : <ExpandMoreIcon aria-hidden />}
          sx={{ minHeight: 44, flex: 'none' }}
        >
          {shown ? 'Hide overview' : 'Show overview'}
        </MuiButton>
      </Box>
      <Box id={contentId} hidden={!shown} sx={{ display: shown ? 'flex' : 'none', flexDirection: 'column', gap: 1 }}>
        {shown && content}
        {shown && <Typography sx={{ fontSize: '0.8125rem', color: 'text.secondary' }}>Ball-by-ball and partnership charts are not available: that data is not captured yet.</Typography>}
      </Box>
    </Box>
  )
}
