import type { ReactNode } from 'react'
import { Link as RouterLink, Outlet, useLocation, useOutletContext } from 'react-router-dom'
import { Box, ToggleButton, ToggleButtonGroup } from '@mui/material'
import EventNoteOutlinedIcon from '@mui/icons-material/EventNoteOutlined'
import FormatListNumberedOutlinedIcon from '@mui/icons-material/FormatListNumberedOutlined'
import GridOnOutlinedIcon from '@mui/icons-material/GridOnOutlined'
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined'
import { EmptyState } from '../../../components/EmptyState'
import { HeaderSeasonSelect } from '../../../components/HeaderSeasonSelect'
import { ManageScreenHeader } from '../../../components/ManageScreenHeader'
import { useDocumentTitle } from '../../../hooks/useDocumentTitle'
import { segmentedSwitchSx } from '../../../utils/segmentedSwitch'
import { useTeamSelectionHubState } from './hubContext'

type HubView = 'matches' | 'slots' | 'players' | 'batting'

// docs/specs/093-team-selection-hub.md: the four views of the hub, each its own route under /manage/team-selection.
const VIEWS: { value: HubView; label: string; to: string; icon: ReactNode }[] = [
  { value: 'matches', label: 'Matches', to: '/manage/team-selection/matches', icon: <EventNoteOutlinedIcon fontSize="small" /> },
  { value: 'slots', label: 'Time slots', to: '/manage/team-selection/slots', icon: <ScheduleOutlinedIcon fontSize="small" /> },
  { value: 'players', label: 'Players', to: '/manage/team-selection/players', icon: <GridOnOutlinedIcon fontSize="small" /> },
  { value: 'batting', label: 'Batting order', to: '/manage/team-selection/batting', icon: <FormatListNumberedOutlinedIcon fontSize="small" /> },
]

// The active view comes from the last path segment; anything else is Matches.
function activeView(pathname: string): HubView {
  const last = pathname.replace(/\/+$/, '').split('/').pop()
  return VIEWS.find((entry) => entry.value === last)?.value ?? 'matches'
}

// docs/specs/093: the shared layout route of the Matches, Players, Time slots and Batting order views - the "Team
// selection" header with the Season pill, a switch that is real navigation, and the shared League/Section/Team filters
// (saved per club) and the one overview request, handed to the views through the Outlet context.
export default function TeamSelectionHubLayout() {
  const { clubId } = useOutletContext<{ clubId?: string }>()
  const { pathname } = useLocation()
  const view = activeView(pathname)
  useDocumentTitle(`${VIEWS.find((entry) => entry.value === view)?.label ?? 'Matches'} · Team selection`)
  const hub = useTeamSelectionHubState(clubId)

  if (!clubId) {
    return <EmptyState title="Not authorized" description="No club is associated with your account." />
  }

  const scope = hub.scopeText()

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <ManageScreenHeader
        title="Team selection"
        subtitle={scope ? `Showing: ${scope}` : undefined}
        // Season is a small pill beside the title; there is no "All seasons" (every figure is for one season).
        titleAdornment={
          hub.seasons.length > 0 ? (
            <HeaderSeasonSelect
              seasons={hub.seasons.map((season) => ({ id: season.id, name: season.label }))}
              value={hub.seasonId || null}
              onChange={(next) => hub.setFilters({ seasonId: next ?? '' })}
              showAll={false}
            />
          ) : undefined
        }
        middle={
          <Box component="nav" aria-label="Team selection views" sx={{ display: 'flex', flexDirection: 'column', alignSelf: { xs: 'stretch', sm: 'auto' } }}>
            <ToggleButtonGroup value={view} exclusive size="small" aria-label="Team selection views" sx={segmentedSwitchSx}>
              {VIEWS.map((entry) => (
                <ToggleButton
                  key={entry.value}
                  component={RouterLink}
                  to={entry.to}
                  value={entry.value}
                  aria-current={entry.value === view ? 'page' : undefined}
                  // Four parts at 375 px: no icons, tighter padding and a smaller label that may wrap; the extra
                  // ampersands beat the shared switch's own padding and nowrap.
                  sx={{
                    gap: 0.75,
                    '&&&': { px: { xs: 0.5, sm: 2 }, whiteSpace: { xs: 'normal', sm: 'nowrap' }, fontSize: { xs: '0.75rem', sm: '0.8125rem' }, lineHeight: 1.2 },
                    '& .MuiSvgIcon-root': { display: { xs: 'none', sm: 'block' } },
                  }}
                >
                  {entry.icon}
                  {entry.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>
        }
      />

      <Outlet context={hub} />
    </Box>
  )
}
