import { useMemo, useState } from 'react'
import { Alert, Box, CircularProgress } from '@mui/material'
import { BrandIcon } from '../../../components/BrandIcon'
import { EmptyState, EmptyStateLink } from '../../../components/EmptyState'
import { ToolbarCard } from '../../../components/ToolbarCard'
import { useLocation, useNavigate } from 'react-router-dom'
import { currentOrigin, withReturnTo } from '../../../utils/returnTo'
import { useTeamSelectionHub } from './hubContext'
import { Legend } from '../playerAvailability/Legend'
import { SlotNavigator } from '../playerAvailability/SlotNavigator'
import { PlayersGrid } from './PlayersGrid'
import { TeamSelectionFilterBar } from './TeamSelectionFilterBar'
import { usePlayerPick } from './usePlayerPick'

// docs/specs/093-team-selection-hub.md: the Players view. A grid of players by match where a click picks or unpicks
// under the spec 076 rules, each cell shows the player's availability answer with the picked state on top, and a muted
// cell says why the player cannot be picked.
export default function PlayersView() {
  const { clubId, overview, showPast, search } = useTeamSelectionHub()
  const navigate = useNavigate()
  const location = useLocation()
  const picker = usePlayerPick(clubId as string)
  const [scrollBox, setScrollBox] = useState<HTMLElement | null>(null)

  const data = overview.data
  const term = search.trim().toLowerCase()
  const players = useMemo(
    () => (data?.players ?? []).filter((player) => !term || `${player.firstName} ${player.lastName}`.toLowerCase().includes(term)),
    [data, term],
  )

  const matches = data?.matches ?? []

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 1.5, md: 2 } }}>
      <ToolbarCard>
        <TeamSelectionFilterBar searchPlaceholder="Search players" />
      </ToolbarCard>

      {overview.isPending && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress aria-label="Loading team selection" />
        </Box>
      )}

      {overview.isError && (
        <EmptyState title="Couldn't load team selection" description="Something went wrong loading the players. Please try again." />
      )}

      {data?.truncated && (
        <Alert severity="info">
          Showing the first {matches.length} matches and {data.players.length} players. Narrow the filters (league, section or team) to see the rest.
        </Alert>
      )}

      {picker.error && (
        <Alert severity="error" onClose={picker.clearError}>
          {picker.error}
        </Alert>
      )}

      {data && matches.length === 0 && (
        <EmptyState
          icon={<BrandIcon name="nav/upcoming-matches" size={48} />}
          title={showPast ? 'No matches' : 'No upcoming matches'}
          description="Nothing to pick a team for. Turn on View Entire Season to see earlier fixtures."
          action={<EmptyStateLink onClick={() => navigate(withReturnTo('/manage/fixtures/matches/new', currentOrigin(location), 'Team Selection'))}>Create New Match</EmptyStateLink>}
        />
      )}

      {data && matches.length > 0 && (
        <>
          {/* docs/specs/137: the slot navigator belongs to the game columns, so it sits at the right of the legend row. */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', columnGap: 2, rowGap: 1 }}>
            <Legend />
            <SlotNavigator scrollBox={scrollBox} />
          </Box>
          <PlayersGrid
            matches={matches}
            players={players}
            busy={picker.busy}
            onScrollBox={setScrollBox}
            onToggle={(picked, target) => (picked ? picker.unpick(target) : picker.pick(target))}
          />
        </>
      )}
    </Box>
  )
}
