import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { AvailabilityStatus } from '../../../api/matchAvailabilityApi'
import { setPlayerStatus } from '../../../api/matchAvailabilityApi'
import { invalidatePollAnswers } from '../../../api/availabilitySummaryApi'
import type { GameColumn, PlayerRow } from '../../../api/playerAvailabilityApi'
import { setRoundPlayerStatus } from '../../../api/sectionAvailabilityApi'
import { errorDetail } from '../../../utils/errorDetail'
import { MissingWindowError, useRoundWindowIds } from './useRoundWindowIds'

// docs/specs/085 (F): what the grid and the phone lists need to change one answer.
export interface ChangeAnswerHandlers {
  // Keys (`${playerProfileId}:${matchId}`) of the answers being saved, so only those cells are disabled; saves on
  // different cells can overlap.
  pendingKeys: ReadonlySet<string>
  // Resolves true once saved, false if it failed (the error is surfaced through the hook's `error`).
  onChange: (player: PlayerRow, game: GameColumn, status: AvailabilityStatus) => Promise<boolean>
}

export const answerKey = (player: Pick<PlayerRow, 'playerProfileId'>, game: Pick<GameColumn, 'matchId'>) =>
  `${player.playerProfileId}:${game.matchId}`

const SAVE_FAILED = 'Something went wrong saving that answer. Please try again.'
const MISSING_WINDOW = 'This game changed since the grid loaded. Refresh the page and try again.'

export function useChangeAnswer(clubId: string | undefined) {
  const queryClient = useQueryClient()
  const windowIdFor = useRoundWindowIds(clubId)
  const [pendingKeys, setPendingKeys] = useState<ReadonlySet<string>>(new Set())
  // Its own state (cleared on the next attempt), so an overlapping save cannot hide or replace it.
  const [error, setError] = useState<string | null>(null)

  const save = async (player: PlayerRow, game: GameColumn, status: AvailabilityStatus) => {
    if (game.pollType === 'SQUAD' && game.pollId) {
      await setPlayerStatus(clubId as string, game.matchId, game.pollId, player.playerProfileId, status)
    } else if (game.pollType === 'GROUP' && (game.roundId ?? game.pollId)) {
      const roundId = (game.roundId ?? game.pollId) as string
      const windowId = await windowIdFor(roundId, game.matchId)
      await setRoundPlayerStatus(clubId as string, roundId, player.playerProfileId, windowId, status)
    } else {
      throw new Error('This game has no poll to change')
    }
  }

  const handlers: ChangeAnswerHandlers = {
    pendingKeys,
    onChange: async (player, game, status) => {
      const key = answerKey(player, game)
      setError(null)
      setPendingKeys((current) => new Set(current).add(key))
      try {
        await save(player, game, status)
        queryClient.invalidateQueries({ queryKey: ['managed-club', clubId, 'player-availability'] })
        invalidatePollAnswers(queryClient, clubId)
        return true
      } catch (caught) {
        setError(caught instanceof MissingWindowError ? MISSING_WINDOW : errorDetail(caught, SAVE_FAILED))
        return false
      } finally {
        setPendingKeys((current) => {
          const next = new Set(current)
          next.delete(key)
          return next
        })
      }
    },
  }
  return { handlers, error }
}
