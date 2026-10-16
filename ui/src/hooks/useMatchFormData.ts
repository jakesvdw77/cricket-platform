import { useCallback, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createMatch } from '../api/matchApi'
import type { Match, MatchPayload } from '../api/matchApi'
import { listTeamsForClub } from '../api/teamApi'
import { listSeasons } from '../api/seasonApi'
import { listLeagues } from '../api/leagueApi'
import { listSections } from '../api/sectionApi'
import { listLeagueAffiliations } from '../api/leagueAffiliationApi'
import { leagueTeamsQueryKey, listLeagueTeams } from '../api/leagueTeamApi'
import { activateSession } from '../api/meApi'

// The data MatchForm needs besides the match itself, shared by the Add/Edit Match page and the Add match dialog (the import
// wizard's Match step). Spread `formProps` onto <MatchForm>. Query keys are the page's own, so the dialog shares its cache.
export function useMatchFormData(clubId: string | undefined) {
  const teamsQuery = useQuery({
    queryKey: ['managed-club', clubId, 'teams'],
    queryFn: () => listTeamsForClub(clubId as string),
    enabled: Boolean(clubId),
  })

  const seasonsQuery = useQuery({
    queryKey: ['managed-club', clubId, 'seasons'],
    queryFn: () => listSeasons(clubId as string),
    enabled: Boolean(clubId),
  })

  // Only to say which section each of the club's teams is in; the picker works without it.
  const sectionsQuery = useQuery({
    queryKey: ['managed-club', clubId, 'sections'],
    queryFn: () => listSections(clubId as string),
    enabled: Boolean(clubId),
  })

  const leaguesQuery = useQuery({
    queryKey: ['managed-club', clubId, 'leagues'],
    queryFn: () => listLeagues(clubId as string),
    enabled: Boolean(clubId),
  })

  // docs/specs/029-league-management.md: every LeagueAffiliation for the club, fetched once per already-loaded League
  // (the affiliations endpoints are nested under their League) and narrowed client-side by MatchForm.
  const affiliationsQuery = useQuery({
    queryKey: ['managed-club', clubId, 'leagues', 'affiliations', (leaguesQuery.data ?? []).map((l) => l.id)],
    queryFn: () =>
      Promise.all((leaguesQuery.data ?? []).map((l) => listLeagueAffiliations(clubId as string, l.id))).then(
        (results) => results.flat(),
      ),
    enabled: Boolean(clubId) && Boolean(leaguesQuery.data),
  })

  // docs/specs/070-league-teams.md: the League team option (and its list endpoint) is club-admin only. MeAccess.clubAdminClubIds
  // holds only CLUB-scope CLUB_ADMIN assignments, so a section manager never matches. Same query key ManagerHome uses.
  const meQuery = useQuery({ queryKey: ['me', 'activate'], queryFn: activateSession })
  const canUseLeagueTeams = Boolean(
    clubId && meQuery.data && (meQuery.data.platformAdmin || meQuery.data.clubAdminClubIds.includes(clubId)),
  )

  // MatchForm owns the chosen League/Season; it reports them so the matching league teams can be fetched here.
  const [formScope, setFormScope] = useState({ leagueId: '', seasonId: '' })
  const onScopeChange = useCallback(
    (leagueId: string, seasonId: string) =>
      setFormScope((prev) => (prev.leagueId === leagueId && prev.seasonId === seasonId ? prev : { leagueId, seasonId })),
    [],
  )
  const leagueTeamsQuery = useQuery({
    queryKey: leagueTeamsQueryKey(clubId as string, formScope.leagueId, formScope.seasonId),
    queryFn: () => listLeagueTeams(clubId as string, formScope.leagueId, formScope.seasonId),
    enabled: Boolean(clubId) && canUseLeagueTeams && Boolean(formScope.leagueId) && Boolean(formScope.seasonId),
  })

  const formProps = {
    teams: teamsQuery.data ?? [],
    sections: sectionsQuery.data ?? [],
    seasons: seasonsQuery.data ?? [],
    leagues: leaguesQuery.data ?? [],
    affiliations: affiliationsQuery.data ?? [],
    leagueTeams: leagueTeamsQuery.data ?? [],
    leagueTeamsLoading: leagueTeamsQuery.isFetching,
    canUseLeagueTeams,
    onScopeChange,
  }
  // loading: true until the lists the pickers need have loaded (a prefill that reads seasons waits for this).
  return { formProps, loading: teamsQuery.isPending || seasonsQuery.isPending || leaguesQuery.isPending }
}

// Create a match and refresh the matches lists (prefix-matches the list's paginated query and a single record's).
export function useCreateMatch(clubId: string, onCreated?: (match: Match) => void) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: MatchPayload) => createMatch(clubId, payload),
    onSuccess: (match) => {
      void queryClient.invalidateQueries({ queryKey: ['managed-club', clubId, 'matches'] })
      onCreated?.(match)
    },
  })
}
