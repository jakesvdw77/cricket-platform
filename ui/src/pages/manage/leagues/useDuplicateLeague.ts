import { useMutation, useQueryClient } from '@tanstack/react-query'
import { duplicateLeague } from '../../../api/leagueApi'
import type { DuplicateLeagueRequest } from '../../../api/leagueApi'

// docs/specs/096-duplicate-league.md: the mutation behind the Duplicate league dialog. The league list is refetched and
// AWAITED before the mutation settles, so the caller can navigate straight to the new league's edit page, which finds
// the league in that cached list.
export function useDuplicateLeague(clubId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ leagueId, request }: { leagueId: string; request: DuplicateLeagueRequest }) =>
      duplicateLeague(clubId, leagueId, request),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['managed-club', clubId, 'leagues'] }),
  })
}
