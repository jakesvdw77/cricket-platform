import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  copyLeagueTeams,
  createLeagueTeam,
  deactivateLeagueTeam,
  leagueTeamsQueryKey,
  reactivateLeagueTeam,
  removeLeagueTeam,
  updateLeagueTeam,
} from '../../../api/leagueTeamApi'
import type { CopyLeagueTeamsPayload, LeagueTeamPayload } from '../../../api/leagueTeamApi'

// docs/specs/070-league-teams.md: every write invalidates this league+season's league-team list; an
// update (and a remove, which may deactivate) also invalidates the matches lists, because a
// rename or logo change propagates to every match that uses the team.
export function useLeagueTeamMutations(clubId: string, leagueId: string, seasonId: string) {
  const queryClient = useQueryClient()
  const invalidateTeams = () => queryClient.invalidateQueries({ queryKey: leagueTeamsQueryKey(clubId, leagueId, seasonId) })
  // The matches list/detail caches, plus the league page's own fixtures cache
  // (['managed-club', clubId, 'leagues', leagueId, 'matches', seasonId]) which is not under the first key.
  const invalidateMatches = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['managed-club', clubId, 'matches'] }),
      queryClient.invalidateQueries({ queryKey: ['managed-club', clubId, 'leagues', leagueId, 'matches'] }),
    ])

  const create = useMutation({
    mutationFn: (payload: LeagueTeamPayload) => createLeagueTeam(clubId, leagueId, seasonId, payload),
    onSuccess: invalidateTeams,
  })

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: LeagueTeamPayload }) =>
      updateLeagueTeam(clubId, leagueId, seasonId, id, payload),
    onSuccess: () => Promise.all([invalidateTeams(), invalidateMatches()]),
  })

  const deactivate = useMutation({
    mutationFn: (id: string) => deactivateLeagueTeam(clubId, leagueId, seasonId, id),
    onSuccess: invalidateTeams,
  })

  const reactivate = useMutation({
    mutationFn: (id: string) => reactivateLeagueTeam(clubId, leagueId, seasonId, id),
    onSuccess: invalidateTeams,
  })

  const remove = useMutation({
    mutationFn: (id: string) => removeLeagueTeam(clubId, leagueId, seasonId, id),
    onSuccess: () => Promise.all([invalidateTeams(), invalidateMatches()]),
  })

  const copy = useMutation({
    mutationFn: (payload: CopyLeagueTeamsPayload) => copyLeagueTeams(clubId, leagueId, seasonId, payload),
    onSuccess: invalidateTeams,
  })

  return { create, update, deactivate, reactivate, remove, copy }
}
