import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listSeasons } from '../api/seasonApi'
import { listLeagues } from '../api/leagueApi'
import { listSections } from '../api/sectionApi'
import { listTeamsForClub } from '../api/teamApi'
import { sectionsWithAncestors } from '../utils/sectionAncestors'

// The ids a stats filter-options read offers (player stats and leaderboards share this shape).
export interface OfferedIds {
  seasonIds: string[]
  leagueIds: string[]
  teamIds: string[]
  sectionIds: string[]
}

// docs/specs/103-player-stats.md: the Season, League, Section and Team lookups behind the stats filters, narrowed to the ids the
// server offers (decision 22). Same query keys as the other pages, so the lists come from cache. A manager who cannot read one of
// them simply gets no options for that filter. `unrestricted` skips the narrowing (the options read failed). Until `available`
// loads nothing is offered, unless unrestricted.
export function useStatsFilterLookups(clubId: string | undefined, available: OfferedIds | undefined, unrestricted = false) {
  const enabled = Boolean(clubId)
  const seasonsQuery = useQuery({ queryKey: ['managed-club', clubId, 'seasons'], queryFn: () => listSeasons(clubId as string), enabled })
  const leaguesQuery = useQuery({ queryKey: ['managed-club', clubId, 'leagues'], queryFn: () => listLeagues(clubId as string), enabled })
  const sectionsQuery = useQuery({ queryKey: ['managed-club', clubId, 'sections'], queryFn: () => listSections(clubId as string), enabled })
  const teamsQuery = useQuery({ queryKey: ['managed-club', clubId, 'teams'], queryFn: () => listTeamsForClub(clubId as string), enabled })

  const seasons = useMemo(() => {
    const ids = new Set(available?.seasonIds ?? [])
    return (seasonsQuery.data ?? []).filter((season) => unrestricted || ids.has(season.id)).map((season) => ({ id: season.id, name: season.label }))
  }, [seasonsQuery.data, available, unrestricted])
  const leagues = useMemo(() => {
    const ids = new Set(available?.leagueIds ?? [])
    return (leaguesQuery.data ?? []).filter((league) => unrestricted || ids.has(league.id)).map((league) => ({ id: league.id, name: league.name }))
  }, [leaguesQuery.data, available, unrestricted])
  const teams = useMemo(() => {
    const ids = new Set(available?.teamIds ?? [])
    return (teamsQuery.data ?? []).filter((team) => unrestricted || ids.has(team.id)).map((team) => ({ id: team.id, name: team.name }))
  }, [teamsQuery.data, available, unrestricted])
  // The offered sections plus every ancestor, so the tree select stays connected.
  const sections = useMemo(
    () => (unrestricted ? (sectionsQuery.data ?? []) : sectionsWithAncestors(sectionsQuery.data ?? [], available?.sectionIds ?? [])),
    [sectionsQuery.data, available, unrestricted],
  )

  return {
    seasons,
    leagues,
    teams,
    sections,
    allSeasons: seasonsQuery.data,
    allLeagues: leaguesQuery.data,
    allSections: sectionsQuery.data ?? [],
    loading: seasonsQuery.isLoading || leaguesQuery.isLoading || sectionsQuery.isLoading || teamsQuery.isLoading,
  }
}
