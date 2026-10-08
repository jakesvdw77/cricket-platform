import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getRoundMatches } from '../../../api/sectionAvailabilityApi'

const ROUND_MATCHES_STALE_MS = 5 * 60_000

// docs/specs/085 (F): a group poll game's answer is saved per window, but the Players grid's GameColumn has no window id.
// This looks it up from the round's matches (matchId -> windowId) through React Query: fetched the first time it is needed
// for a round, then served from the cache.
// The round has no window for the match (it changed since the grid loaded): a different problem from a failed save.
export class MissingWindowError extends Error {
  constructor(roundId: string, matchId: string) {
    super(`No window found for match ${matchId} in round ${roundId}`)
    this.name = 'MissingWindowError'
  }
}

export function useRoundWindowIds(clubId: string | undefined) {
  const queryClient = useQueryClient()
  return useCallback(
    async (roundId: string, matchId: string): Promise<string> => {
      const matches = await queryClient.fetchQuery({
        queryKey: ['managed-club', clubId, 'round-matches', roundId],
        queryFn: () => getRoundMatches(clubId as string, roundId),
        staleTime: ROUND_MATCHES_STALE_MS,
      })
      const windowId = matches.find((match) => match.matchId === matchId)?.windowId
      if (!windowId) throw new MissingWindowError(roundId, matchId)
      return windowId
    },
    [queryClient, clubId],
  )
}
