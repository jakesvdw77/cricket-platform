import type { TeamSelectionPick } from '../../../api/teamSelectionApi'

// A side's picks in batting order; the 12th man and any pick without a position follow, in the server's order.
export function sortedPicks(picks: TeamSelectionPick[]): TeamSelectionPick[] {
  const rank = (pick: TeamSelectionPick) => (pick.battingOrder != null ? pick.battingOrder : pick.twelfthMan ? 1000 : 1001)
  return picks
    .map((pick, index) => ({ pick, index }))
    .sort((a, b) => rank(a.pick) - rank(b.pick) || a.index - b.index)
    .map(({ pick }) => pick)
}
