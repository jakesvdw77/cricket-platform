import { useState } from 'react'
import type { ReactNode } from 'react'
import { useOutletContext, useSearchParams } from 'react-router-dom'
import { Box, Button as MuiButton, Skeleton } from '@mui/material'
import { EmptyState } from '../../../components/EmptyState'
import { FilterBar } from '../../../components/FilterBar'
import { HeaderSeasonSelect } from '../../../components/HeaderSeasonSelect'
import { ToolbarCard } from '../../../components/ToolbarCard'
import { ManageScreenHeader } from '../../../components/ManageScreenHeader'
import { NameModeToggle } from '../../../components/NameModeToggle'
import { DEFAULT_SORT, STANDINGS_GROUPS, catalogueBoards, useLeaderboardCatalogue } from '../../../api/leaderboardApi'
import type { LeaderboardColumn, SortDirection } from '../../../api/leaderboardApi'
import type { TeamStatsCompetition } from '../../../api/teamStatsApi'
import { useDebouncedValue } from '../../../hooks/useDebouncedValue'
import { useDocumentTitle } from '../../../hooks/useDocumentTitle'
import { AwardsView } from './AwardsView'
import { LeaderboardSortButton } from './LeaderboardSortButton'
import { LeaderboardTabs } from './LeaderboardTabs'
import { resolveLeaderboardTab } from './leaderboardTabConfig'
import { StandingsTable } from './StandingsTable'
import { TeamsTab } from './TeamsTab'
import { useLeaderboardFilters } from './useLeaderboardFilters'
import { compactButtonSx } from '../../../components/Button'

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

  const isTeamsTab = tab === 'teams'
  const filterState = useLeaderboardFilters(clubId, isTeamsTab)
  const { filters, ready } = filterState
  // The Teams tab has its own filter options and table; the player catalogue is not needed there.
  const catalogueQuery = useLeaderboardCatalogue(clubId, !isTeamsTab)
  const catalogue = catalogueBoards(catalogueQuery.data)
  const isAwardsTab = tab === 'awards'
  const group = STANDINGS_GROUPS.find((entry) => entry === tab)

  // Competition (Teams tab only): per visit, never saved; only a competition that has counted results is offered.
  const [competitionChoice, setCompetitionChoice] = useState<TeamStatsCompetition | null>(null)
  const competitionOptions = filterState.competitions.filter((value): value is TeamStatsCompetition => value === 'LEAGUE' || value === 'FRIENDLY')
  const competition = isTeamsTab && competitionChoice && competitionOptions.includes(competitionChoice) ? competitionChoice : null
  const hasFilters = filterState.hasFilters || competition !== null
  const catalogueGroup = catalogueQuery.data?.groups.find((entry) => entry.code === group)
  const columns = catalogueGroup?.columns ?? []
  const sortCode = group ? resolveSort(columns, searchParams.get('sort'), catalogueGroup?.defaultSort ?? DEFAULT_SORT[group]) : ''
  const sortDirection = group ? resolveDirection(columns, searchParams.get('sort'), sortCode, searchParams.get('dir')) : null
  const sortColumn = columns.find((column) => column.code === sortCode)
  const naturalDirection = sortColumn?.direction ?? 'HIGHEST'
  const effectiveDirection = sortDirection ? (sortDirection === 'asc' ? 'LOWEST' : 'HIGHEST') : naturalDirection

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
    setCompetitionChoice(null)
  }

  // docs/specs/140 and page-anatomy section 3: ONE flat toolbar: League, Section, Team (Competition on Teams), then the page's Sort button and, last,
  // the Full name | Initials toggle (no person is named on the Teams tab). Fused into the standings card; standalone above everything else.
  const renderBar = (sort: ReactNode, showNames: boolean) => (
    <FilterBar
      bare
      inCard
      viewControlsInline
      density="compact"
      leagues={filterState.leagues.length > 0 ? filterState.leagues : undefined}
      sections={filterState.sections.length > 0 ? filterState.sections : undefined}
      teams={filterState.teams.length > 0 ? filterState.teams : undefined}
      leagueId={filters.leagueId}
      sectionId={filters.sectionId}
      teamId={filters.teamId}
      onLeagueChange={filterState.setLeague}
      onSectionChange={filterState.setSection}
      onTeamChange={filterState.setTeam}
      extraSelects={
        isTeamsTab && competitionOptions.length > 0
          ? [
              {
                key: 'competition',
                label: 'Competition',
                allLabel: 'All Competitions',
                options: competitionOptions.map((value) => ({ value, label: value === 'LEAGUE' ? 'League' : 'Friendlies' })),
                value: competition ?? '',
                onChange: (value) => setCompetitionChoice((value || null) as TeamStatsCompetition | null),
              },
            ]
          : []
      }
      viewControls={
        sort || showNames ? (
          <>
            {sort}
            {showNames && <NameModeToggle inline toolbar />}
          </>
        ) : undefined
      }
      onClearAll={clearFilters}
    />
  )
  const standaloneBar = <ToolbarCard>{renderBar(null, !isTeamsTab)}</ToolbarCard>

  let content: ReactNode
  // Awards, the loading and the error states have no standings card to fuse the toolbar into, so it stands alone above them.
  let standalone = false
  if (!ready || (!isTeamsTab && catalogueQuery.isLoading)) {
    content = (
      <Box aria-busy="true" aria-label="Loading leaderboards" sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Skeleton variant="rounded" height={44} />
        <Skeleton variant="rounded" height={220} />
      </Box>
    )
    standalone = true
  } else if (isTeamsTab) {
    content = <TeamsTab clubId={clubId} filters={filters} competition={competition} hasFilters={hasFilters} onClearFilters={clearFilters} enabled={ready} renderToolbar={(sort) => renderBar(sort, false)} />
  } else if (catalogueQuery.isError || (!isAwardsTab && !catalogueGroup)) {
    content = (
      <EmptyState
        title="Could not load the leaderboards"
        description="Check your connection and try again."
        action={
          <MuiButton variant="outlined" onClick={() => catalogueQuery.refetch()} size="small" sx={compactButtonSx}>
            Try again
          </MuiButton>
        }
      />
    )
    standalone = true
  } else if (isAwardsTab) {
    content = (
      <AwardsView
        key={filterKey}
        clubId={clubId}
        filters={filters}
        hasFilters={hasFilters}
        onClearFilters={clearFilters}
        catalogue={catalogue}
        renderToolbar={(controls) => <ToolbarCard>{renderBar(controls, true)}</ToolbarCard>}
        enabled={ready}
      />
    )
  } else if (group && catalogueGroup) {
    content = (
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
        toolbar={renderBar(
          <LeaderboardSortButton columns={columns} sortCode={sortCode} effectiveDirection={effectiveDirection} onSelect={selectSort} onReverse={reverseSort} />,
          true,
        )}
      />
    )
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 1.5, md: 2 } }}>
      <ManageScreenHeader
        title="Leaderboards"
        // docs/specs/140: the season is the title-row pill (as on the other lists); no button here, Awards is a tab.
        titleAdornment={
          <HeaderSeasonSelect seasons={filterState.seasons} value={filters.seasonId} onChange={filterState.setSeason} allLabel="All Seasons" />
        }
      />

      <LeaderboardTabs />

      {standalone && standaloneBar}

      {content}
    </Box>
  )
}
