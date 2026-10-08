import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getRoundMatches } from '../../../api/sectionAvailabilityApi'

const ROUND_MATCHES_STALE_MS = 5 * 60_000

// docs/specs/085 (F): a group poll game's answer is saved per window, but the Players grid's GameColumn has no window id.
// This looks it up from the round's matches (matchId -> windowId) through React Query: fetched the first time it is needed
// for a round, then served from the cache.
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
      if (!windowId) throw new Error(`No window found for match ${matchId} in round ${roundId}`)
      return windowId
    },
    [queryClient, clubId],
  )
}
