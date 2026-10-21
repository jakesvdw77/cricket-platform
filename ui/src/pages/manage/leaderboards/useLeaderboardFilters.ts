import { useMemo } from 'react'
import { useLeaderboardFilterOptions } from '../../../api/leaderboardApi'
import { useTeamStatsFilterOptions } from '../../../api/teamStatsApi'
import type { LeaderboardFilters } from '../../../api/leaderboardApi'
import { useStatsFilterLookups } from '../../../hooks/useStatsFilterLookups'
import { usePersistedListFilters } from '../../../hooks/usePersistedListFilters'
import { pickDefaultSeasonId } from '../../../utils/defaultSeason'

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
//
// docs/specs/116-team-stats.md: on the Teams tab (`forTeams`) the lists are narrowed by the TEAM filter options instead (the player
// options and catalogue are not fetched), Team is not offered, and the saved teamId is ignored (and kept for the player tabs).
export function useLeaderboardFilters(clubId: string | undefined, forTeams = false) {
  const [saved, updateSaved] = usePersistedListFilters<SavedFilters>(`leaderboards:filters:${clubId}`, {
    seasonId: null,
    leagueId: null,
    sectionId: null,
    teamId: null,
  })

  const playerOptions = useLeaderboardFilterOptions(clubId, !forTeams)
  const teamOptionsQuery = useTeamStatsFilterOptions(clubId, forTeams)
  const optionsQuery = forTeams ? teamOptionsQuery : playerOptions
  const available = useMemo(
    () => (forTeams ? (teamOptionsQuery.data ? { ...teamOptionsQuery.data, teamIds: [] } : undefined) : playerOptions.data),
    [forTeams, teamOptionsQuery.data, playerOptions.data],
  )
  const lookups = useStatsFilterLookups(clubId, available, optionsQuery.isError)
  const { seasons: seasonOptions, leagues: leagueOptions, teams: teamOptions, sections: sectionOptions } = lookups

  const defaultSeasonId = useMemo(() => pickDefaultSeasonId(lookups.allSeasons ?? []), [lookups.allSeasons])
  const offered = (options: { id: string }[], id: string | null) => (id && options.some((option) => option.id === id) ? id : null)

  // Season: All seasons if chosen; else the saved season if it is still offered; else the current season if it has data; else All.
  const seasonId =
    saved.seasonId === ALL_SEASONS
      ? null
      : (offered(seasonOptions, saved.seasonId) ?? offered(seasonOptions, defaultSeasonId ?? null))
  const leagueId = offered(leagueOptions, saved.leagueId)
  const teamId = forTeams ? null : offered(teamOptions, saved.teamId)
  const sectionId = offered(sectionOptions, saved.sectionId)

  const ready = !lookups.loading && !optionsQuery.isLoading

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
    // the competitions with counted team results (Teams tab only)
    competitions: forTeams ? (teamOptionsQuery.data?.competitions ?? []) : [],
    allSections: lookups.allSections,
    setSeason: (id: string | null) => updateSaved({ seasonId: id ?? ALL_SEASONS }),
    setLeague: (id: string | null) => updateSaved({ leagueId: id }),
    setSection: (id: string | null) => updateSaved({ sectionId: id }),
    setTeam: (id: string | null) => updateSaved({ teamId: id }),
    clearAll: () => updateSaved({ seasonId: ALL_SEASONS, leagueId: null, sectionId: null, teamId: null }),
  }
}
