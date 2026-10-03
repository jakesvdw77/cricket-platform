import type { ReactNode } from 'react'
import { Link as RouterLink, Outlet, useLocation, useNavigate, useOutletContext } from 'react-router-dom'
import { Box, ToggleButton, ToggleButtonGroup } from '@mui/material'
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined'
import GridOnOutlinedIcon from '@mui/icons-material/GridOnOutlined'
import JoinInnerOutlinedIcon from '@mui/icons-material/JoinInnerOutlined'
import { Button } from '../../../components/Button'
import { EmptyState } from '../../../components/EmptyState'
import { ManageScreenHeader } from '../../../components/ManageScreenHeader'
import { segmentedSwitchSx } from '../../../utils/segmentedSwitch'

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

// docs/specs/073: the shared layout route of the Polls, Players and Coverage views - the "Availability" header,
// a Polls | Players | Coverage switch that is real navigation, and New poll on Polls only. Forwards the club id
// through its own Outlet context so each view keeps its existing useOutletContext hook.
export default function AvailabilityHubLayout() {
  const { clubId } = useOutletContext<{ clubId?: string }>()
  const { pathname } = useLocation()
  const navigate = useNavigate()

  if (!clubId) {
    return <EmptyState title="Not authorized" description="No club is associated with your account." />
  }

  const view = activeView(pathname)

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
          ) : undefined
        }
      />

      <Outlet context={{ clubId }} />
    </Box>
  )
}
