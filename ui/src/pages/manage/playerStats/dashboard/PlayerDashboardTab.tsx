import { Suspense, lazy, useId, useState } from 'react'
import { Box, Button as MuiButton, Typography } from '@mui/material'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { DashboardCard } from '../../../../components/DashboardCard'
import type { PlayerStats } from '../../../../api/playerStatsApi'
import type { PlayerDashboard } from '../../../../api/playerDashboardApi'
import { PlayerHeadlineTiles } from '../PlayerHeadlineTiles'
import { DashboardSkeleton } from './DashboardSkeleton'
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

// A collapsible group: a header row (title, a 44 px Hide / Show button with aria-expanded and aria-controls),
// then its three cards. Collapsed, nothing below the header is rendered, so the chart chunk is not needed. State is per visit.
function DashboardGroup({ group, dashboard, backTo }: GroupProps) {
  const [open, setOpen] = useState(group.defaultOpen)
  const contentId = useId()
  const { data, isPlaceholderData } = dashboard
  const label = group.title.toLowerCase()
  const skeleton = <DashboardSkeleton cards={group.cards} label="Loading the overview" />
  return (
    <Box component="section" aria-label={group.title} data-testid={`dashboard-group-${group.key}`} sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, minWidth: 0, flexWrap: 'wrap' }}>
          <Typography component="h2" sx={{ fontSize: '1rem', fontWeight: 700 }}>
            {group.title}
          </Typography>
        </Box>
        <MuiButton
          variant="text"
          size="small"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls={contentId}
          data-testid={`dashboard-group-${group.key}-toggle`}
          startIcon={open ? <ExpandLessIcon aria-hidden /> : <ExpandMoreIcon aria-hidden />}
          sx={{ minHeight: 44, flex: 'none' }}
        >
          {open ? `Hide ${label}` : `Show ${label}`}
        </MuiButton>
      </Box>
      <Box id={contentId} hidden={!open}>
        {open &&
          (data ? (
            <Suspense fallback={skeleton}>
              <PlayerDashboardCharts data={data} backTo={backTo} group={group.key} dimmed={isPlaceholderData} />
            </Suspense>
          ) : (
            skeleton
          ))}
      </Box>
    </Box>
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
        <DashboardCard testId="dashboard" title="Overview" fullWidth error={{ onRetry: () => void refetch() }} />
      ) : (
        GROUPS.map((group) => <DashboardGroup key={group.key} group={group} dashboard={dashboard} backTo={backTo} />)
      )}
      <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Ball-by-ball and partnership charts are not available: that data is not captured yet.</Typography>
    </Box>
  )
}
