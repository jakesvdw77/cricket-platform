import { useMemo, useState } from 'react'
import { Alert, Box, CircularProgress } from '@mui/material'
import { CompactSwitch } from '../../../components/CompactSwitch'
import { ContentControlsLine } from '../../../components/ContentControlsLine'
import { EmptyState } from '../../../components/EmptyState'
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
  const { clubId, overview, showPast, setShowPast, search } = useTeamSelectionHub()
  const picker = usePlayerPick(clubId as string)
  const [scrollBox, setScrollBox] = useState<HTMLElement | null>(null)

  const data = overview.data
  const term = search.trim().toLowerCase()
  const players = useMemo(
    () => (data?.players ?? []).filter((player) => !term || `${player.firstName} ${player.lastName}`.toLowerCase().includes(term)),
    [data, term],
  )

  const pastToggle = <CompactSwitch checked={showPast} onChange={setShowPast} label="View entire season" />
  const matches = data?.matches ?? []
  const scope = data
    ? `Showing ${players.length} ${players.length === 1 ? 'player' : 'players'} · ${matches.length} ${matches.length === 1 ? 'match' : 'matches'}`
    : ''

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <TeamSelectionFilterBar searchPlaceholder="Search players" viewControls={pastToggle} />

      <ContentControlsLine scope={scope} controls={pastToggle} pinned={<SlotNavigator scrollBox={scrollBox} />} />

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
          title={showPast ? 'No matches' : 'No upcoming matches'}
          description="Nothing to pick a team for. Turn on View entire season to see earlier fixtures."
        />
      )}

      {data && matches.length > 0 && (
        <>
          <Legend />
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
