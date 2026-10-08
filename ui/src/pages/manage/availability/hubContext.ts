import { useMemo, useState } from 'react'
import { useOutletContext, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAvailabilityFilters } from '../../../hooks/useAvailabilityFilters'
import type { AvailabilityFilters } from '../../../hooks/useAvailabilityFilters'
import { useAvailabilitySeason } from '../../../hooks/useAvailabilitySeason'
import { listLeagues } from '../../../api/leagueApi'
import type { League } from '../../../api/leagueApi'
import { listSections } from '../../../api/sectionApi'
import type { Section } from '../../../api/sectionApi'
import { listTeamsForClub } from '../../../api/teamApi'
import type { Team } from '../../../api/teamApi'
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
  // docs/specs/083: the teams of the chosen section (all the club's when none), loaded once here for the Team
  // filter and the "Showing: ..." text. validTeamId is the chosen team, or null when it is not one of those teams
  // (a stored team the section no longer holds counts as "all teams"). teamsLoading holds the requests that carry it.
  teams: Team[]
  teamsLoading: boolean
  // The team list failed to load: the Polls and Players views hold their requests and show their error state.
  teamsError: boolean
  validTeamId: string | null
  // docs/specs/083: the Polls view's poll-type toggles (both on by default) and Show closed polls switch. They
  // live here, not in the Polls page, because the counters (owned by the layout) must describe the same list.
  // Per-visit choices, not persisted; Show closed is preset by a ?showClosed=true link.
  showGroup: boolean
  setShowGroup: (value: boolean) => void
  showSquad: boolean
  setShowSquad: (value: boolean) => void
  showClosed: boolean
  setShowClosed: (value: boolean) => void
  // docs/specs/084: the "Close in 48 hours" quick filter - only open polls whose scheduled close is within the
  // next 48 hours. Per-visit like the toggles above, not persisted, not sent to the summary.
  closingSoon: boolean
  setClosingSoon: (value: boolean) => void
  // The set shared filters as text for the scope line, e.g. "Vets › Over 40 · Over 40 League". The chosen
  // team's name is included only with withTeam, for the views that actually filter by team (Polls, Players).
  scopeText: (options?: { withTeam?: boolean }) => string
  // docs/specs/085 (D2): the Players view registers Jump to today here (null when it should not be shown) and
  // the layout renders it in the header action slot.
  jumpToToday: HubHeaderAction | null
  setJumpToToday: (action: HubHeaderAction | null) => void
}

// docs/specs/085 (D2): the one header action a view can ask the layout to render at the top right (where Polls has
// New poll). Only Players uses it (Jump to today); null means the layout keeps its invisible placeholder.
export interface HubHeaderAction {
  onClick: () => void
  disabled: boolean
}

// Owned by the hub layout; also used by test stand-ins for it.
// Coverage needs neither the season nor the team list, hence the two flags.
export function useAvailabilityHubState(
  clubId: string | undefined,
  seasonsEnabled: boolean,
  teamsEnabled = true,
): AvailabilityHubContext {
  const { filters, setFilters, clearFilters } = useAvailabilityFilters(clubId)
  const { seasonId, seasonsLoading } = useAvailabilitySeason(clubId, seasonsEnabled)
  const [searchParams] = useSearchParams()
  const [showGroup, setShowGroup] = useState(true)
  const [showSquad, setShowSquad] = useState(true)
  const [showClosed, setShowClosed] = useState(() => searchParams.get('showClosed') === 'true')
  const [closingSoon, setClosingSoon] = useState(false)
  const [jumpToToday, setJumpToToday] = useState<HubHeaderAction | null>(null)
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
    queryKey: ['managed-club', clubId, 'teams', { sectionId: filters.sectionId }],
    queryFn: () => listTeamsForClub(clubId as string, { sectionId: filters.sectionId ?? undefined }),
    enabled: Boolean(clubId) && teamsEnabled,
  })
  const teams = useMemo(() => teamsQuery.data ?? [], [teamsQuery.data])
  const validTeamId = filters.teamId && teams.some((team) => team.id === filters.teamId) ? filters.teamId : null
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
    teams,
    teamsLoading: teamsQuery.isLoading,
    teamsError: teamsQuery.isError,
    validTeamId,
    showGroup,
    setShowGroup,
    showSquad,
    setShowSquad,
    showClosed,
    setShowClosed,
    closingSoon,
    setClosingSoon,
    jumpToToday,
    setJumpToToday,
    scopeText: (options) =>
      scopeFilterText({
        sections,
        sectionId: filters.sectionId,
        leagues,
        leagueId: filters.leagueId,
        teams,
        teamId: options?.withTeam ? filters.teamId : null,
      }),
  }
}

export function useAvailabilityHub(): AvailabilityHubContext {
  return useOutletContext<AvailabilityHubContext>()
}
