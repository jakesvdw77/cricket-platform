import { useQuery } from '@tanstack/react-query'
import { getMatch } from '../../../api/matchApi'

// docs/specs/137: the Team Selection overview does not carry the match's field position, so a card reads the match itself (the same cached
// query the Select Team page uses) to get directions and the forecast. Only when the match has a venue; cached for five minutes.
export function useSelectionMatch(clubId: string | undefined, matchId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['managed-club', clubId, 'matches', matchId],
    queryFn: () => getMatch(clubId as string, matchId),
    enabled: enabled && Boolean(clubId),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: false,
  }).data
}
