import { useState } from 'react'
import { isAxiosError } from 'axios'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createMatchSide, removeMatchSidePlayer } from '../../../api/matchSideApi'
import { applySelection } from '../../../api/matchSelectionApi'
import type { SelectionEntryRequest, SelectionRejectedBody } from '../../../api/matchSelectionApi'
import { invalidateTeamSelection } from '../../../api/teamSelectionApi'
import type { TeamSelectionCell, TeamSelectionMatch, TeamSelectionSide } from '../../../api/teamSelectionApi'
import { errorDetail } from '../../../utils/errorDetail'

export interface PickTarget {
  match: TeamSelectionMatch
  side: TeamSelectionSide
  cell: TeamSelectionCell
  playerId: string
}

// The 409 of a refused pick: the rule's own message for this player, else the response detail.
function refusalMessage(error: unknown, playerId: string): string {
  if (isAxiosError(error) && error.response?.status === 409) {
    const body = (error.response.data ?? {}) as SelectionRejectedBody
    const own = body.rejections?.find((rejection) => rejection.playerProfileId === playerId)
    return own?.message ?? body.detail ?? body.rejections?.[0]?.message ?? "This player can't be picked."
  }
  return errorDetail(error, "Couldn't save the selection. Please try again.")
}

// docs/specs/093-team-selection-hub.md: click-to-pick on the Players grid. Pick = the spec 076 apply endpoint with the
// side's current players kept and this one added at the next batting position (creating the club's side first when it
// does not exist yet); unpick = the remove endpoint. Every write refreshes the overview all four views read.
export function usePlayerPick(clubId: string) {
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)

  const refresh = () => invalidateTeamSelection(queryClient, clubId)

  const pickMutation = useMutation({
    mutationFn: async ({ match, side, cell, playerId }: PickTarget) => {
      let sideId = cell.sideId ?? side.sideId
      if (!sideId) {
        // A side created here exists even if the pick below is refused, so the overview must be refreshed either way.
        sideId = (await createMatchSide(clubId, match.matchId, cell.teamId)).id
        await refresh()
      }
      const kept: SelectionEntryRequest[] = side.picks.map((pick) => ({ playerProfileId: pick.playerId }))
      const highest = Math.max(0, ...side.picks.map((pick) => pick.battingOrder ?? 0))
      const next = highest + 1
      const added: SelectionEntryRequest =
        next <= side.limits.battingPlaces ? { playerProfileId: playerId, battingOrder: next } : { playerProfileId: playerId }
      return applySelection(clubId, match.matchId, sideId, { players: [...kept, added] })
    },
    onMutate: () => setError(null),
    onSuccess: refresh,
    onError: (err, target) => setError(refusalMessage(err, target.playerId)),
  })

  const unpickMutation = useMutation({
    mutationFn: ({ match, side, cell, playerId }: PickTarget) =>
      removeMatchSidePlayer(clubId, match.matchId, (cell.sideId ?? side.sideId) as string, playerId),
    onMutate: () => setError(null),
    onSuccess: refresh,
    onError: (err) => setError(errorDetail(err, "Couldn't remove this player. Please try again.")),
  })

  return {
    pick: (target: PickTarget) => pickMutation.mutate(target),
    unpick: (target: PickTarget) => unpickMutation.mutate(target),
    busy: pickMutation.isPending || unpickMutation.isPending,
    error,
    clearError: () => setError(null),
  }
}
