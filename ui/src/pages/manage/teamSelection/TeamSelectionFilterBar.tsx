import type { ReactNode } from 'react'
import { useMediaQuery } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { SortMenu } from '../../../components/ContentControlsLine'
import { FilterBar } from '../../../components/FilterBar'
import { ToolbarSortButton, ToolbarToggle } from '../../../components/ToolbarCard'
import { useTeamSelectionHub } from './hubContext'
import { MATCH_SORT_OPTIONS } from './sortMatches'
import type { MatchSort } from './sortMatches'

export interface TeamSelectionFilterBarProps {
  searchPlaceholder?: string
  // The view's own toggles, after View Entire Season (a chip in the row, a switch in the phone sheet).
  extraControls?: (placement: 'row' | 'sheet') => ReactNode
  // The view's own controls kept at the right end of the row (Cards | List).
  viewControls?: ReactNode
  // The Matches and Time Slots tabs sort by date: a Sort button before the view controls (a quiet menu in the phone sheet).
  sortable?: boolean
}

// The FilterBar wired to the Team Selection hub's shared filters (docs/specs/093, 137): League, Section, Team and search in a flat
// toolbar, with View Entire Season as a toggle chip. The caller puts it in a ToolbarCard (or fuses it into a table). Season is the
// pill in the header.
export function TeamSelectionFilterBar({ searchPlaceholder = 'Search by team or opponent', extraControls, viewControls, sortable = false }: TeamSelectionFilterBarProps) {
  const { filters, setFilters, clearFilters, leagues, sections, teams, search, setSearch, showPast, setShowPast, sort, setSort } = useTeamSelectionHub()
  const phone = useMediaQuery(useTheme().breakpoints.down('sm'), { noSsr: true })
  const onSort = (value: string) => setSort(value as MatchSort)
  const sortControl = !sortable ? null : phone ? <SortMenu value={sort} options={MATCH_SORT_OPTIONS} onChange={onSort} /> : <ToolbarSortButton value={sort} onChange={onSort} options={MATCH_SORT_OPTIONS} />
  return (
    <FilterBar
      bare
      inCard
      viewControlsInline
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
      secondaryControls={(placement) => (
        <>
          <ToolbarToggle placement={placement} checked={showPast} onChange={setShowPast} label="View Entire Season" />
          {extraControls?.(placement)}
        </>
      )}
      // Desktop order (page-anatomy section 3): switches, then Sort, then Cards | List last; a phone sheet: the toggle first.
      viewControls={phone ? <>{viewControls}{sortControl}</> : <>{sortControl}{viewControls}</>}
      onClearAll={() => {
        clearFilters()
        setSearch('')
        setShowPast(false)
      }}
    />
  )
}
