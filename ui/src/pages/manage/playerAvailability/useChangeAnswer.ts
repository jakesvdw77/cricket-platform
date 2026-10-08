import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { AvailabilityStatus } from '../../../api/matchAvailabilityApi'
import { setPlayerStatus } from '../../../api/matchAvailabilityApi'
import { invalidateAvailabilityCounters } from '../../../api/availabilitySummaryApi'
import type { GameColumn, PlayerRow } from '../../../api/playerAvailabilityApi'
import { setRoundPlayerStatus } from '../../../api/sectionAvailabilityApi'
import { errorDetail } from '../../../utils/errorDetail'
import { useRoundWindowIds } from './useRoundWindowIds'

// docs/specs/085 (F): what the grid and the phone lists need to change one answer.
export interface ChangeAnswerHandlers {
  // `${playerProfileId}:${matchId}` of the answer being saved, so only that cell is disabled.
  pendingKey: string | null
  // Resolves true once saved, false if it failed (the error is surfaced through the hook's `error`).
  onChange: (player: PlayerRow, game: GameColumn, status: AvailabilityStatus) => Promise<boolean>
}

export const answerKey = (player: Pick<PlayerRow, 'playerProfileId'>, game: Pick<GameColumn, 'matchId'>) =>
  `${player.playerProfileId}:${game.matchId}`

export function useChangeAnswer(clubId: string | undefined) {
  const queryClient = useQueryClient()
  const windowIdFor = useRoundWindowIds(clubId)
  const [pendingKey, setPendingKey] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: async ({ player, game, status }: { player: PlayerRow; game: GameColumn; status: AvailabilityStatus }) => {
      if (game.pollType === 'SQUAD' && game.pollId) {
        await setPlayerStatus(clubId as string, game.matchId, game.pollId, player.playerProfileId, status)
      } else if (game.pollType === 'GROUP') {
        const roundId = game.roundId ?? game.pollId
        if (!roundId) throw new Error('This game has no poll to change')
        const windowId = await windowIdFor(roundId, game.matchId)
        await setRoundPlayerStatus(clubId as string, roundId, player.playerProfileId, windowId, status)
      } else {
        throw new Error('This game has no poll to change')
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['managed-club', clubId, 'player-availability'] })
      invalidateAvailabilityCounters(queryClient, clubId)
    },
    onSettled: () => setPendingKey(null),
  })

  const handlers: ChangeAnswerHandlers = {
    pendingKey,
    onChange: async (player, game, status) => {
      setPendingKey(answerKey(player, game))
      try {
        await mutation.mutateAsync({ player, game, status })
        return true
      } catch {
        return false
      }
    },
  }
  const error = mutation.isError ? errorDetail(mutation.error, 'Something went wrong saving that answer. Please try again.') : null
  return { handlers, error }
}
