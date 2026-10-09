import { Link as RouterLink } from 'react-router-dom'
import { Link } from '@mui/material'
import { EmptyState } from '../../../components/EmptyState'
import type { GameColumn } from '../../../api/playerAvailabilityApi'

// docs/specs/068: what replaces the grid (and, from 085, the phone lists) when there is nothing to show: no games match
// the filters, or no game has a poll yet. Renders nothing else; callers check hasNothingToShow first.
export function GridEmptyState({ games }: { games: GameColumn[] }) {
  if (games.length === 0) {
    return (
      <EmptyState
        title="No games match these filters"
        description="Try a different season, league, section or team, or turn on View entire season."
      />
    )
  }
  if (games.every((game) => game.pollType === null)) {
    return (
      <EmptyState
        title="No polls opened yet for these games"
        description="Open an availability poll and the answers will appear here."
        action={
          <Link component={RouterLink} to="/manage/availability" underline="always">
            Go to Availability Polls
          </Link>
        }
      />
    )
  }
  return null
}
