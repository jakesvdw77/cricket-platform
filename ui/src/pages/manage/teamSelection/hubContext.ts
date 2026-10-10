import { useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import { usePersistedListFilters } from '../../../hooks/usePersistedListFilters'
import { listLeagues } from '../../../api/leagueApi'
import type { League } from '../../../api/leagueApi'
import { listSeasons } from '../../../api/seasonApi'
import type { Season } from '../../../api/seasonApi'
import { listSections } from '../../../api/sectionApi'
import type { Section } from '../../../api/sectionApi'
import { listTeamsForClub } from '../../../api/teamApi'
import type { Team } from '../../../api/teamApi'
import { useTeamSelection } from '../../../api/teamSelectionApi'
import type { TeamSelectionOverview } from '../../../api/teamSelectionApi'
import { pickDefaultSeasonId } from '../../../utils/defaultSeason'
import { scopeFilterText } from '../../../utils/availabilityScope'

// docs/specs/093-team-selection-hub.md: the filters the four views share, saved per club.
export type TeamSelectionFilters = {
  seasonId: string
  leagueId: string | null
  sectionId: string | null
  teamId: string | null
}

const FILTER_DEFAULTS: TeamSelectionFilters = { seasonId: '', leagueId: null, sectionId: null, teamId: null }

export const teamSelectionFiltersKey = (clubId: string | undefined) => `teamSelection:filters:${clubId}`

// What the Team selection hub layout hands its views through the Outlet context: the club id, the shared filters,
// the one overview query every view reads (so they cannot disagree), Show past and the search text.
export interface TeamSelectionHubContext {
  clubId?: string
  filters: TeamSelectionFilters
  setFilters: (next: Partial<TeamSelectionFilters>) => void
  clearFilters: () => void
  seasons: Season[]
  // The chosen season (a saved one that no longer exists falls back to the default), '' until seasons load.
  seasonId: string
  leagues: League[]
  sections: Section[]
  teams: Team[]
  // The chosen team, or null when it is not one of the section's teams.
  validTeamId: string | null
  showPast: boolean
  setShowPast: (value: boolean) => void
  // Per visit, never saved.
  search: string
  setSearch: (value: string) => void
  overview: UseQueryResult<TeamSelectionOverview>
  scopeText: () => string
}

// Owned by the hub layout; also used by test stand-ins for it.
export function useTeamSelectionHubState(clubId: string | undefined): TeamSelectionHubContext {
  const [saved, setSaved] = usePersistedListFilters<TeamSelectionFilters>(teamSelectionFiltersKey(clubId), FILTER_DEFAULTS)
  const [showPast, setShowPast] = useState(false)
  const [search, setSearch] = useState('')

  const seasonsQuery = useQuery({
    queryKey: ['managed-club', clubId, 'seasons'],
    queryFn: () => listSeasons(clubId as string),
    enabled: Boolean(clubId),
  })
  const leaguesQuery = useQuery({
    queryKey: ['managed-club', clubId, 'leagues'],
    queryFn: () => listLeagues(clubId as string),
    enabled: Boolean(clubId),
  })
  const sectionsQuery = useQuery({
    queryKey: ['managed-club', clubId, 'sections'],
    queryFn: () => listSections(clubId as string),
    enabled: Boolean(clubId),
  })
  const teamsQuery = useQuery({
    queryKey: ['managed-club', clubId, 'teams', { sectionId: saved.sectionId }],
    queryFn: () => listTeamsForClub(clubId as string, { sectionId: saved.sectionId ?? undefined }),
    enabled: Boolean(clubId),
  })

  const seasons = useMemo(() => seasonsQuery.data ?? [], [seasonsQuery.data])
  const leagues = useMemo(() => leaguesQuery.data ?? [], [leaguesQuery.data])
  const sections = useMemo(() => sectionsQuery.data ?? [], [sectionsQuery.data])
  const teams = useMemo(() => teamsQuery.data ?? [], [teamsQuery.data])
  const seasonId = useMemo(
    () => (seasons.some((season) => season.id === saved.seasonId) ? saved.seasonId : (pickDefaultSeasonId(seasons) ?? '')),
    [seasons, saved.seasonId],
  )
  const validTeamId = saved.teamId && teams.some((team) => team.id === saved.teamId) ? saved.teamId : null

  const overview = useTeamSelection(
    clubId,
    { seasonId, leagueId: saved.leagueId, sectionId: saved.sectionId, teamId: validTeamId, includePast: showPast },
    // Wait for the seasons so the first request already carries the season, and for the teams so a stale team is dropped.
    !seasonsQuery.isLoading && !teamsQuery.isLoading,
  )

  const setFilters = (next: Partial<TeamSelectionFilters>) => {
    // A team belongs to one section, so changing the section clears it.
    setSaved('sectionId' in next && next.sectionId !== saved.sectionId ? { teamId: null, ...next } : next)
  }

  return {
    clubId,
    filters: { ...saved, teamId: validTeamId },
    setFilters,
    clearFilters: () => setSaved({ leagueId: null, sectionId: null, teamId: null }),
    seasons,
    seasonId,
    leagues,
    sections,
    teams,
    validTeamId,
    showPast,
    setShowPast,
    search,
    setSearch,
    overview,
    scopeText: () =>
      [
        scopeFilterText({ sections, sectionId: saved.sectionId, leagues, leagueId: saved.leagueId, teams, teamId: validTeamId }),
        seasons.find((season) => season.id === seasonId)?.label,
      ]
        .filter(Boolean)
        .join(' · '),
  }
}

export function useTeamSelectionHub(): TeamSelectionHubContext {
  return useOutletContext<TeamSelectionHubContext>()
}
