import type { ReactNode } from 'react'
import { FilterBar } from '../../../components/FilterBar'
import { useTeamSelectionHub } from './hubContext'

export interface TeamSelectionFilterBarProps {
  searchPlaceholder?: string
  // The view's own controls (Show past, ...), shown in the Filters sheet on a phone.
  viewControls?: ReactNode
}

// The FilterBar wired to the Team selection hub's shared filters (docs/specs/093): League, Section, Team and search.
// Season is the pill in the header.
export function TeamSelectionFilterBar({ searchPlaceholder = 'Search by team or opponent', viewControls }: TeamSelectionFilterBarProps) {
  const { filters, setFilters, clearFilters, leagues, sections, teams, search, setSearch, setShowPast } = useTeamSelectionHub()
  return (
    <FilterBar
      density="compact"
      leagues={leagues}
      sections={sections}
      teams={teams.map((team) => ({ id: team.id, name: team.name }))}
      leagueId={filters.leagueId}
      sectionId={filters.sectionId}
      teamId={filters.teamId}
      onLeagueChange={(value) => setFilters({ leagueId: value })}
      onSectionChange={(value) => setFilters({ sectionId: value })}
      onTeamChange={(value) => setFilters({ teamId: value })}
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder={searchPlaceholder}
      viewControls={viewControls}
      onClearAll={() => {
        clearFilters()
        setSearch('')
        setShowPast(false)
      }}
    />
  )
}
