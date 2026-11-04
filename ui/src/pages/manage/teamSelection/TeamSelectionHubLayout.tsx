import { Outlet, useLocation, useOutletContext } from 'react-router-dom'
import { Box } from '@mui/material'
import { EmptyState } from '../../../components/EmptyState'
import { HeaderSeasonSelect } from '../../../components/HeaderSeasonSelect'
import { ManageScreenHeader } from '../../../components/ManageScreenHeader'
import { ViewTabsRow } from '../../../components/ViewTabsRow'
import { useDocumentTitle } from '../../../hooks/useDocumentTitle'
import { useTeamSelectionHubState } from './hubContext'

type HubView = 'matches' | 'slots' | 'players' | 'batting'

// docs/specs/093-team-selection-hub.md, revamped by docs/specs/137: the four views of the hub, each its own route under
// /manage/team-selection. Title Case labels, no icons (page-anatomy section 4).
const VIEWS: { value: HubView; label: string; path: string }[] = [
  { value: 'matches', label: 'Matches', path: '/manage/team-selection/matches' },
  { value: 'slots', label: 'Time Slots', path: '/manage/team-selection/slots' },
  { value: 'players', label: 'Players', path: '/manage/team-selection/players' },
  { value: 'batting', label: 'Batting Order', path: '/manage/team-selection/batting' },
]

// The active view comes from the last path segment; anything else is Matches.
function activeView(pathname: string): HubView {
  const last = pathname.replace(/\/+$/, '').split('/').pop()
  return VIEWS.find((entry) => entry.value === last)?.value ?? 'matches'
}

// docs/specs/093 and 137: the shared layout route of the Matches, Time Slots, Players and Batting Order views - the "Team Selection"
// title with the Season pill, a tab row that is real navigation (it keeps the address query, so View Entire Season survives a tab
// change), and the shared League/Section/Team filters (saved per club) and the one overview request, handed to the views
// through the Outlet context.
export default function TeamSelectionHubLayout() {
  const { clubId } = useOutletContext<{ clubId?: string }>()
  const { pathname, search } = useLocation()
  const view = activeView(pathname)
  useDocumentTitle(`${VIEWS.find((entry) => entry.value === view)?.label ?? 'Matches'} · Team Selection`)
  const hub = useTeamSelectionHubState(clubId)

  if (!clubId) {
    return <EmptyState title="Not authorized" description="No club is associated with your account." />
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 1.5, md: 2 } }}>
      <ManageScreenHeader
        title="Team Selection"
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
      />

      <ViewTabsRow aria-label="Team Selection views" value={view} tabs={VIEWS.map((entry) => ({ value: entry.value, label: entry.label, to: { pathname: entry.path, search } }))} />

      <Outlet context={hub} />
    </Box>
  )
}
