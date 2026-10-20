import { useState } from 'react'
import type { ReactNode } from 'react'
import { useOutletContext, useSearchParams } from 'react-router-dom'
import { Box, Button as MuiButton, IconButton, MenuItem, Skeleton } from '@mui/material'
import SwapVertIcon from '@mui/icons-material/SwapVert'
import EmojiEventsOutlinedIcon from '@mui/icons-material/EmojiEventsOutlined'
import { EmptyState } from '../../../components/EmptyState'
import { FilterBar } from '../../../components/FilterBar'
import { Input } from '../../../components/Input'
import { ManageScreenHeader } from '../../../components/ManageScreenHeader'
import { NameModeToggle } from '../../../components/NameModeToggle'
import { DEFAULT_SORT, catalogueBoards, useLeaderboardCatalogue } from '../../../api/leaderboardApi'
import type { LeaderboardColumn, SortDirection, StandingsGroup } from '../../../api/leaderboardApi'
import { useManagedClubProfile } from '../../../hooks/useManagedClubProfile'
import { useDebouncedValue } from '../../../hooks/useDebouncedValue'
import { useDocumentTitle } from '../../../hooks/useDocumentTitle'
import { scopeFilterText } from '../../../utils/availabilityScope'
import { AwardsView } from './AwardsView'
import { LeaderboardTabs } from './LeaderboardTabs'
import { resolveLeaderboardTab } from './leaderboardTabConfig'
import { StandingsTable } from './StandingsTable'
import { useLeaderboardFilters } from './useLeaderboardFilters'

// The sort column: ?sort= if the group's catalogue lists it as sortable, else the group's default (runs, wickets or total).
function resolveSort(columns: LeaderboardColumn[], param: string | null, fallback: string): string {
  const sortable = columns.filter((column) => column.sortable)
  return sortable.find((column) => column.code === param)?.code ?? sortable.find((column) => column.code === fallback)?.code ?? sortable[0]?.code ?? fallback
}

// The requested direction: ?dir=asc|desc, only when the sort column is real for this group (otherwise both are dropped) and
// only when it differs from the column's natural direction.
function resolveDirection(columns: LeaderboardColumn[], sortParam: string | null, sortCode: string, dirParam: string | null): SortDirection | null {
  if (dirParam !== 'asc' && dirParam !== 'desc') return null
  const column = columns.find((entry) => entry.sortable && entry.code === sortCode)
  if (!column || sortParam !== sortCode) return null
  return (column.direction === 'LOWEST' ? 'asc' : 'desc') === dirParam ? null : dirParam
}

// docs/specs/103-player-stats.md (decision 26, mockup boards 12 and 13): /manage/leaderboards. A title, a Batting | Bowling |
// Fielding | Awards strip bound to ?tab=, a compact FilterBar (Season defaulting to the current season, League, Section, Team; all
// saved per club and narrowed to values that have counted data), and either a standings table (ranked by the column chosen in the
// Sort by select, ?sort=, or by tapping a heading) or the Awards view. Every filter, the sort and the paging are backend parameters.
export default function LeaderboardsPage() {
  const { clubId } = useOutletContext<{ clubId?: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = resolveLeaderboardTab(searchParams.get('tab'))
  useDocumentTitle('Leaderboards')

  const filterState = useLeaderboardFilters(clubId)
  const { filters, ready, hasFilters } = filterState
  const catalogueQuery = useLeaderboardCatalogue(clubId)
  const catalogue = catalogueBoards(catalogueQuery.data)
  const isAwardsTab = tab === 'awards'
  const group = isAwardsTab ? undefined : (tab as StandingsGroup)
  const catalogueGroup = catalogueQuery.data?.groups.find((entry) => entry.code === group)
  const columns = catalogueGroup?.columns ?? []
  const sortCode = group ? resolveSort(columns, searchParams.get('sort'), catalogueGroup?.defaultSort ?? DEFAULT_SORT[group]) : ''
  const sortDirection = group ? resolveDirection(columns, searchParams.get('sort'), sortCode, searchParams.get('dir')) : null
  const sortColumn = columns.find((column) => column.code === sortCode)
  const naturalDirection = sortColumn?.direction ?? 'HIGHEST'
  const effectiveDirection = sortDirection ? (sortDirection === 'asc' ? 'LOWEST' : 'HIGHEST') : naturalDirection
  const profileQuery = useManagedClubProfile(clubId, isAwardsTab)

  // The optional minimum of a rate sort: per visit, never saved; it belongs to one tab, sort and set of filters and is dropped
  // when any of them changes.
  const filterKey = JSON.stringify(filters)
  const minimumScope = `${tab}|${sortCode}|${filterKey}`
  const [minimumState, setMinimumState] = useState<{ scope: string; value: number | null }>({ scope: minimumScope, value: null })
  const minimum = minimumState.scope === minimumScope ? minimumState.value : null
  const setMinimum = (value: number | null) => setMinimumState({ scope: minimumScope, value })
  const debouncedMinimum = useDebouncedValue(minimum, 400)
  const appliedMinimum = minimum === null ? null : debouncedMinimum

  if (!clubId) {
    return <EmptyState title="Not authorized" description="No club is associated with your account." />
  }

  // Selecting a column (heading or Sort by select) always starts from its natural direction.
  const selectSort = (code: string) => {
    const next = new URLSearchParams(searchParams)
    next.set('sort', code)
    next.delete('dir')
    setSearchParams(next, { replace: true })
  }
  // Reversing keeps the column; coming back to the natural direction drops ?dir=.
  const reverseSort = () => {
    const next = new URLSearchParams(searchParams)
    next.set('sort', sortCode)
    const reversed = effectiveDirection === 'HIGHEST' ? 'LOWEST' : 'HIGHEST'
    if (reversed === naturalDirection) next.delete('dir')
    else next.set('dir', reversed === 'LOWEST' ? 'asc' : 'desc')
    setSearchParams(next, { replace: true })
  }
  // A heading: the current column reverses, another column is selected.
  const headingSort = (code: string) => (code === sortCode ? reverseSort() : selectSort(code))
  const clearFilters = () => {
    filterState.clearAll()
  }
  const showAwards = () => {
    const next = new URLSearchParams(searchParams)
    next.set('tab', 'awards')
    next.delete('sort')
    next.delete('dir')
    setSearchParams(next, { replace: true })
  }

  const seasonName = filterState.seasons.find((season) => season.id === filters.seasonId)?.name
  const titleText = [profileQuery.data?.name, seasonName ? `${seasonName} season` : 'All seasons'].filter(Boolean).join(', ')
  const scopeText = scopeFilterText({
    sections: filterState.allSections,
    sectionId: filters.sectionId,
    leagues: filterState.leagues,
    leagueId: filters.leagueId,
    teams: filterState.teams,
    teamId: filters.teamId,
  })

  let content: ReactNode
  if (!ready || catalogueQuery.isLoading) {
    content = (
      <Box aria-busy="true" aria-label="Loading leaderboards" sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Skeleton variant="rounded" height={44} />
        <Skeleton variant="rounded" height={220} />
      </Box>
    )
  } else if (catalogueQuery.isError || (!isAwardsTab && !catalogueGroup)) {
    content = (
      <EmptyState
        title="Could not load the leaderboards"
        description="Check your connection and try again."
        action={
          <MuiButton variant="outlined" onClick={() => catalogueQuery.refetch()} sx={{ minHeight: 44 }}>
            Try again
          </MuiButton>
        }
      />
    )
  } else if (isAwardsTab) {
    content = (
      <AwardsView
        key={filterKey}
        clubId={clubId}
        filters={filters}
        hasFilters={hasFilters}
        onClearFilters={clearFilters}
        catalogue={catalogue}
        titleText={titleText}
        scopeText={scopeText}
        enabled={ready}
      />
    )
  } else if (group && catalogueGroup) {
    content = (
      <>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1 }}>
          <Box sx={{ flex: { xs: 1, sm: '0 0 220px' }, minWidth: 0 }}>
          <Input select size="small" label="Sort by" value={sortCode} onChange={(event) => selectSort(event.target.value)}>
            {columns
              .filter((column) => column.sortable)
              .map((column) => (
                <MenuItem key={column.code} value={column.code}>
                  {column.longLabel ?? column.label}
                </MenuItem>
              ))}
          </Input>
          </Box>
          <IconButton
            aria-label="Reverse order"
            title="Reverse order"
            onClick={reverseSort}
            sx={{ flexShrink: 0, width: { xs: 44, sm: 40 }, height: { xs: 44, sm: 40 }, p: 0, border: 1, borderColor: 'divider', borderRadius: 1, color: sortDirection ? 'primary.dark' : 'text.secondary' }}
          >
            <SwapVertIcon />
          </IconButton>
        </Box>
        <StandingsTable
          key={group}
          clubId={clubId}
          group={group}
          title={catalogueGroup.label}
          columns={columns}
          sortCode={sortCode}
          sortDirection={sortDirection}
          onSortChange={headingSort}
          filters={filters}
          hasFilters={hasFilters}
          onClearFilters={clearFilters}
          minimum={minimum}
          onMinimumChange={setMinimum}
          appliedMinimum={appliedMinimum}
          enabled={ready}
        />
      </>
    )
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <ManageScreenHeader
        title="Leaderboards"
        action={
          !isAwardsTab ? (
            <MuiButton variant="contained" startIcon={<EmojiEventsOutlinedIcon />} onClick={showAwards} sx={{ minHeight: 44 }}>
              Awards
            </MuiButton>
          ) : undefined
        }
      />

      <LeaderboardTabs />

      <Box sx={{ display: 'flex', justifyContent: { xs: 'stretch', sm: 'flex-end' } }}>
        <Box sx={{ width: { xs: '100%', sm: 'auto' } }}>
          <NameModeToggle />
        </Box>
      </Box>

      <FilterBar
        density="compact"
        seasons={filterState.seasons.length > 0 ? filterState.seasons : undefined}
        leagues={filterState.leagues.length > 0 ? filterState.leagues : undefined}
        sections={filterState.sections.length > 0 ? filterState.sections : undefined}
        teams={filterState.teams.length > 0 ? filterState.teams : undefined}
        seasonId={filters.seasonId}
        leagueId={filters.leagueId}
        sectionId={filters.sectionId}
        teamId={filters.teamId}
        onSeasonChange={filterState.setSeason}
        onLeagueChange={filterState.setLeague}
        onSectionChange={filterState.setSection}
        onTeamChange={filterState.setTeam}
        onClearAll={clearFilters}
      />

      {content}
    </Box>
  )
}
