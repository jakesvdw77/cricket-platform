import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLeaderboardFilterOptions } from '../../../api/leaderboardApi'
import type { LeaderboardFilters } from '../../../api/leaderboardApi'
import { listSeasons } from '../../../api/seasonApi'
import { listLeagues } from '../../../api/leagueApi'
import { listSections } from '../../../api/sectionApi'
import { listTeamsForClub } from '../../../api/teamApi'
import { usePersistedListFilters } from '../../../hooks/usePersistedListFilters'
import { pickDefaultSeasonId } from '../../../utils/defaultSeason'
import { sectionsWithAncestors } from '../../../utils/sectionAncestors'

// Stored in place of a season id when All seasons was chosen on purpose (null means "never chosen": the default season).
const ALL_SEASONS = 'all'

interface SavedFilters extends Record<string, unknown> {
  seasonId: string | null
  leagueId: string | null
  sectionId: string | null
  teamId: string | null
}

// docs/specs/103-player-stats.md (The Leaderboards page): Season (default: the current season, All seasons selectable), League,
// Section and Team, all saved per club under leaderboards:filters:<clubId>. Each list offers only values that have counted data
// (GET /leaderboards/filter-options), sections with their ancestors so the tree stays connected. A saved choice that is no longer
// offered falls back to the default (Season) or All (the rest). If the options read fails the lists are left unrestricted rather
// than hiding the filters. `ready` is false until everything needed to choose the default has loaded, so the page never fetches a
// board twice.
export function useLeaderboardFilters(clubId: string | undefined) {
  const [saved, updateSaved] = usePersistedListFilters<SavedFilters>(`leaderboards:filters:${clubId}`, {
    seasonId: null,
    leagueId: null,
    sectionId: null,
    teamId: null,
  })

  // Same query keys as the other pages, so the lists are shared from cache. A manager who cannot read one of them simply gets no
  // options for that filter.
  const seasonsQuery = useQuery({ queryKey: ['managed-club', clubId, 'seasons'], queryFn: () => listSeasons(clubId as string), enabled: Boolean(clubId) })
  const leaguesQuery = useQuery({ queryKey: ['managed-club', clubId, 'leagues'], queryFn: () => listLeagues(clubId as string), enabled: Boolean(clubId) })
  const sectionsQuery = useQuery({ queryKey: ['managed-club', clubId, 'sections'], queryFn: () => listSections(clubId as string), enabled: Boolean(clubId) })
  const teamsQuery = useQuery({ queryKey: ['managed-club', clubId, 'teams'], queryFn: () => listTeamsForClub(clubId as string), enabled: Boolean(clubId) })
  const optionsQuery = useLeaderboardFilterOptions(clubId)
  const available = optionsQuery.data
  const unrestricted = optionsQuery.isError

  const seasonOptions = useMemo(() => {
    const ids = new Set(available?.seasonIds ?? [])
    return (seasonsQuery.data ?? [])
      .filter((season) => unrestricted || ids.has(season.id))
      .map((season) => ({ id: season.id, name: season.label }))
  }, [seasonsQuery.data, available, unrestricted])
  const leagueOptions = useMemo(() => {
    const ids = new Set(available?.leagueIds ?? [])
    return (leaguesQuery.data ?? []).filter((league) => unrestricted || ids.has(league.id)).map((league) => ({ id: league.id, name: league.name }))
  }, [leaguesQuery.data, available, unrestricted])
  const teamOptions = useMemo(() => {
    const ids = new Set(available?.teamIds ?? [])
    return (teamsQuery.data ?? []).filter((team) => unrestricted || ids.has(team.id)).map((team) => ({ id: team.id, name: team.name }))
  }, [teamsQuery.data, available, unrestricted])
  const sectionOptions = useMemo(
    () => (unrestricted ? (sectionsQuery.data ?? []) : sectionsWithAncestors(sectionsQuery.data ?? [], available?.sectionIds ?? [])),
    [sectionsQuery.data, available, unrestricted],
  )

  const defaultSeasonId = useMemo(() => pickDefaultSeasonId(seasonsQuery.data ?? []), [seasonsQuery.data])
  const offered = (options: { id: string }[], id: string | null) => (id && options.some((option) => option.id === id) ? id : null)

  // Season: All seasons if chosen; else the saved season if it is still offered; else the current season if it has data; else All.
  const seasonId =
    saved.seasonId === ALL_SEASONS
      ? null
      : (offered(seasonOptions, saved.seasonId) ?? offered(seasonOptions, defaultSeasonId ?? null))
  const leagueId = offered(leagueOptions, saved.leagueId)
  const teamId = offered(teamOptions, saved.teamId)
  const sectionId = offered(sectionOptions, saved.sectionId)

  const ready = !seasonsQuery.isLoading && !leaguesQuery.isLoading && !sectionsQuery.isLoading && !teamsQuery.isLoading && !optionsQuery.isLoading

  const filters: LeaderboardFilters = { seasonId, leagueId, teamId, sectionId }
  // Anything narrower than "all time, whole club" (the empty states offer Clear filters).
  const hasFilters = Boolean(seasonId || leagueId || teamId || sectionId)

  return {
    ready,
    filters,
    hasFilters,
    seasons: seasonOptions,
    leagues: leagueOptions,
    sections: sectionOptions,
    teams: teamOptions,
    allSections: sectionsQuery.data ?? [],
    setSeason: (id: string | null) => updateSaved({ seasonId: id ?? ALL_SEASONS }),
    setLeague: (id: string | null) => updateSaved({ leagueId: id }),
    setSection: (id: string | null) => updateSaved({ sectionId: id }),
    setTeam: (id: string | null) => updateSaved({ teamId: id }),
    clearAll: () => updateSaved({ seasonId: ALL_SEASONS, leagueId: null, sectionId: null, teamId: null }),
  }
}
