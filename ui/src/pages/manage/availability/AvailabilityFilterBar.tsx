import type { ReactNode } from 'react'
import { FilterBar } from '../../../components/FilterBar'
import type { FilterBarChip } from '../../../components/FilterBar'
import { useAvailabilityHub } from './hubContext'

export interface AvailabilityFilterBarProps {
  // Which shared filters this view shows.
  show: { league?: boolean; section?: boolean; team?: boolean }
  // Team options and the (validated) chosen team, for the views that show Team.
  teams?: { id: string; name: string }[]
  teamId?: string | null
  teamAllLabel?: string
  searchValue?: string
  onSearchChange?: (value: string) => void
  searchPlaceholder?: string
  viewControls?: ReactNode
  extraChips?: FilterBarChip[]
  // Runs after the shared filters are cleared (the sheet's "Clear all"), to reset the view's own choices.
  onClearedAll?: () => void
}

// The FilterBar wired to the hub's shared filters, leagues and sections, so the three views don't each
// repeat that wiring (docs/specs/083).
export function AvailabilityFilterBar({ show, teams, teamId, onClearedAll, ...rest }: AvailabilityFilterBarProps) {
  const { filters, setFilters, clearFilters, leagues, sections } = useAvailabilityHub()
  return (
    <FilterBar
      {...rest}
      density="compact"
      leagues={show.league ? leagues : undefined}
      sections={show.section ? sections : undefined}
      teams={show.team ? (teams ?? []) : undefined}
      leagueId={filters.leagueId}
      sectionId={filters.sectionId}
      teamId={teamId !== undefined ? teamId : filters.teamId}
      onLeagueChange={show.league ? (value) => setFilters({ leagueId: value }) : undefined}
      // setFilters clears the team when the section changes (a team belongs to one section).
      onSectionChange={show.section ? (value) => setFilters({ sectionId: value }) : undefined}
      onTeamChange={show.team ? (value) => setFilters({ teamId: value }) : undefined}
      onClearAll={() => {
        clearFilters()
        onClearedAll?.()
      }}
    />
  )
}
