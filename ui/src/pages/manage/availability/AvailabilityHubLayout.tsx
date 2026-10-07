import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link as RouterLink, Outlet, useLocation, useNavigate, useOutletContext } from 'react-router-dom'
import { Box, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined'
import GridOnOutlinedIcon from '@mui/icons-material/GridOnOutlined'
import JoinInnerOutlinedIcon from '@mui/icons-material/JoinInnerOutlined'
import { Button } from '../../../components/Button'
import { EmptyState } from '../../../components/EmptyState'
import { ManageScreenHeader } from '../../../components/ManageScreenHeader'
import { PageCounters } from '../../../components/PageCounters'
import type { PageCounterItem } from '../../../components/PageCounters'
import { availabilitySummaryKey, getAvailabilitySummary, typeFilterFor } from '../../../api/availabilitySummaryApi'
import type { AvailabilitySummary, AvailabilitySummaryFilters } from '../../../api/availabilitySummaryApi'
import { scopeFilterText } from '../../../utils/availabilityScope'
import { segmentedSwitchSx } from '../../../utils/segmentedSwitch'
import { useAvailabilityHubState } from './hubContext'

type HubView = 'polls' | 'players' | 'coverage'

// docs/specs/073-availability-hub.md: the views of the hub; docs/specs/074 adds Coverage.
const VIEWS: { value: HubView; label: string; to: string; icon: ReactNode }[] = [
  { value: 'polls', label: 'Polls', to: '/manage/availability', icon: <EventAvailableOutlinedIcon fontSize="small" /> },
  { value: 'players', label: 'Players', to: '/manage/availability/players', icon: <GridOnOutlinedIcon fontSize="small" /> },
  { value: 'coverage', label: 'Coverage', to: '/manage/availability/coverage', icon: <JoinInnerOutlinedIcon fontSize="small" /> },
]

// The active view comes from the pathname: ending in /players is Players, /coverage is Coverage,
// anything else is Polls.
function activeView(pathname: string): HubView {
  const path = pathname.replace(/\/+$/, '')
  if (path.endsWith('/players')) return 'players'
  if (path.endsWith('/coverage')) return 'coverage'
  return 'polls'
}

// docs/specs/081: the Polls view counters, with the amber tone on the two that need attention.
function counterItems(summary: AvailabilitySummary, showClosed: boolean): PageCounterItem[] {
  return [
    // With Show closed on the figure counts closed polls too, so it reads "Polls shown".
    { id: 'open-polls', value: summary.openPolls, label: showClosed ? 'Polls shown' : 'Open polls', active: true },
    { id: 'players-responded', value: `${summary.playersResponded} / ${summary.playersInAudience}`, label: 'Players responded' },
    {
      id: 'players-still-to-answer',
      value: summary.playersStillToAnswer,
      label: 'Players still to answer',
      tone: summary.playersStillToAnswer > 0 ? 'warning' : 'default',
    },
    {
      id: 'closing-soon',
      value: summary.closingSoon,
      label: 'Close in 48 hours',
      tone: summary.closingSoon > 0 ? 'warning' : 'default',
    },
  ]
}

// docs/specs/073: the shared layout route of the Polls, Players and Coverage views - the "Availability" header,
// a Polls | Players | Coverage switch that is real navigation, and New poll on Polls only. Forwards the club id
// through its own Outlet context. docs/specs/083: it also owns the shared League/Section/Team filters and the
// default season (saved per club, mirrored in the address) and hands them to the three views through that context.
export default function AvailabilityHubLayout() {
  const { clubId } = useOutletContext<{ clubId?: string }>()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const view = activeView(pathname)
  const hub = useAvailabilityHubState(clubId, view !== 'polls', view !== 'coverage')

  // The counters belong to the Polls view only and describe exactly what its list shows: the shared filters,
  // the poll type toggles and Show closed. A failed request hides the row, the page still works.
  const summaryFilters: AvailabilitySummaryFilters = {
    leagueId: hub.filters.leagueId,
    sectionId: hub.filters.sectionId,
    teamId: hub.validTeamId,
    type: typeFilterFor(hub.showGroup, hub.showSquad),
    includeClosed: hub.showClosed,
  }
  const summaryQuery = useQuery({
    queryKey: availabilitySummaryKey(clubId ?? '', summaryFilters),
    queryFn: () => getAvailabilitySummary(clubId as string, summaryFilters),
    enabled: Boolean(clubId) && view === 'polls' && !hub.teamsLoading && !hub.teamsError,
    retry: false,
  })

  if (!clubId) {
    return <EmptyState title="Not authorized" description="No club is associated with your account." />
  }

  // The caption is built from exactly the filters sent to the summary.
  const scope = scopeFilterText({
    sections: hub.sections,
    sectionId: summaryFilters.sectionId,
    leagues: hub.leagues,
    leagueId: summaryFilters.leagueId,
    teams: hub.teams,
    teamId: summaryFilters.teamId,
  })
  const showCounters = view === 'polls' && !hub.teamsError && !summaryQuery.isError && (summaryQuery.isPending || Boolean(summaryQuery.data))

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <ManageScreenHeader
        title="Availability"
        middle={
          <Box component="nav" aria-label="Availability views" sx={{ display: 'flex', flexDirection: 'column', alignSelf: { xs: 'stretch', sm: 'auto' } }}>
            <ToggleButtonGroup value={view} exclusive size="small" aria-label="Availability views" sx={segmentedSwitchSx}>
              {VIEWS.map((entry) => (
                <ToggleButton
                  key={entry.value}
                  component={RouterLink}
                  to={entry.to}
                  value={entry.value}
                  aria-current={entry.value === view ? 'page' : undefined}
                  sx={{ gap: 0.75 }}
                >
                  {entry.icon}
                  {entry.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>
        }
        action={
          view === 'polls' ? (
            <Button onClick={() => navigate('/manage/availability/new')} sx={{ width: { xs: '100%', sm: 'auto' } }}>
              New poll
            </Button>
          ) : (
            // Reserves the New poll button's width from sm up so the switch stays put when you move between
            // views instead of jumping to the right edge. visibility: hidden keeps it out of the tab order
            // and the accessibility tree, so the button is still effectively absent on Players and Coverage.
            <Box aria-hidden sx={{ visibility: 'hidden', display: { xs: 'none', sm: 'block' } }}>
              <Button tabIndex={-1} disabled>
                New poll
              </Button>
            </Box>
          )
        }
      />

      {showCounters && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <PageCounters
            items={summaryQuery.data ? counterItems(summaryQuery.data, hub.showClosed) : []}
            loading={summaryQuery.isPending}
          />
          {scope && (
            <Typography variant="caption" color="text.secondary" data-testid="counters-scope">
              {`Showing: ${scope}`}
            </Typography>
          )}
        </Box>
      )}

      <Outlet context={hub} />
    </Box>
  )
}
