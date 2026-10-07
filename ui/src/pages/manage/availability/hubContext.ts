import { useMemo } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAvailabilityFilters } from '../../../hooks/useAvailabilityFilters'
import type { AvailabilityFilters } from '../../../hooks/useAvailabilityFilters'
import { useAvailabilitySeason } from '../../../hooks/useAvailabilitySeason'
import { listLeagues } from '../../../api/leagueApi'
import type { League } from '../../../api/leagueApi'
import { listSections } from '../../../api/sectionApi'
import type { Section } from '../../../api/sectionApi'
import { scopeFilterText } from '../../../utils/availabilityScope'

// docs/specs/083: what the Availability hub layout hands its three views through the Outlet context -
// the club id (as before), the shared filters, the default season, and the club's leagues and sections
// the shared filter bar and the "Showing ..." text are built from (loaded once here, not per view).
export interface AvailabilityHubContext {
  clubId?: string
  filters: AvailabilityFilters
  setFilters: (next: Partial<AvailabilityFilters>) => void
  clearFilters: () => void
  // The default season the Players and Coverage views use; undefined until the seasons load.
  seasonId: string | undefined
  seasonsLoading: boolean
  leagues: League[]
  leaguesLoading: boolean
  leaguesError: boolean
  sections: Section[]
  // The set shared filters as text for the scope line, e.g. "Vets › Over 40 · Over 40 League"; pass the
  // teams in view to include the chosen team's name.
  scopeText: (teams?: { id: string; name: string }[]) => string
}

// Owned by the hub layout; also used by test stand-ins for it.
export function useAvailabilityHubState(clubId: string | undefined, seasonsEnabled: boolean): AvailabilityHubContext {
  const { filters, setFilters, clearFilters } = useAvailabilityFilters(clubId)
  const { seasonId, seasonsLoading } = useAvailabilitySeason(clubId, seasonsEnabled)
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
  const leagues = useMemo(() => leaguesQuery.data ?? [], [leaguesQuery.data])
  const sections = useMemo(() => sectionsQuery.data ?? [], [sectionsQuery.data])
  return {
    clubId,
    filters,
    setFilters,
    clearFilters,
    seasonId,
    seasonsLoading,
    leagues,
    leaguesLoading: leaguesQuery.isLoading,
    leaguesError: leaguesQuery.isError,
    sections,
    scopeText: (teams) =>
      scopeFilterText({ sections, sectionId: filters.sectionId, leagues, leagueId: filters.leagueId, teams, teamId: filters.teamId }),
  }
}

export function useAvailabilityHub(): AvailabilityHubContext {
  return useOutletContext<AvailabilityHubContext>()
}
