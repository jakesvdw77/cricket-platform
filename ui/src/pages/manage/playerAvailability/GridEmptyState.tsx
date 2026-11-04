import { BrandIcon } from '../../../components/BrandIcon'
import { EmptyState } from '../../../components/EmptyState'
import type { GameColumn } from '../../../api/playerAvailabilityApi'
import { AddPollAction } from '../availability/AddPollAction'

// docs/specs/068: what replaces the grid (and, from 085, the phone lists) when there is nothing to show: no games match
// the filters, or no game has a poll yet. Renders nothing else; callers check hasNothingToShow first.
export function GridEmptyState({ games }: { games: GameColumn[] }) {
  const icon = <BrandIcon name="nav/availability-polls" size={48} />
  if (games.length === 0) {
    return (
      <EmptyState
        icon={icon}
        title="No games match these filters"
        description="Try a different season, league, section or team, or turn on View entire season."
      />
    )
  }
  if (games.every((game) => game.pollType === null)) {
    return (
      <EmptyState
        icon={icon}
        title="No polls opened yet for these games"
        description="Open an availability poll and the answers will appear here."
        action={<AddPollAction />}
      />
    )
  }
  return null
}
