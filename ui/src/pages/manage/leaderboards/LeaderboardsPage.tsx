import { useState } from 'react'
import type { ReactNode } from 'react'
import { useOutletContext, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Box, Button as MuiButton, ListSubheader, MenuItem, Skeleton } from '@mui/material'
import EmojiEventsOutlinedIcon from '@mui/icons-material/EmojiEventsOutlined'
import { EmptyState } from '../../../components/EmptyState'
import { FilterBar } from '../../../components/FilterBar'
import { Input } from '../../../components/Input'
import { ManageScreenHeader } from '../../../components/ManageScreenHeader'
import { NameModeToggle } from '../../../components/NameModeToggle'
import { getManagedClubProfile } from '../../../api/clubApi'
import { catalogueBoards, useLeaderboardCatalogue } from '../../../api/leaderboardApi'
import type { LeaderboardBoardInfo } from '../../../api/leaderboardApi'
import { useDebouncedValue } from '../../../hooks/useDebouncedValue'
import { useDocumentTitle } from '../../../hooks/useDocumentTitle'
import { scopeFilterText } from '../../../utils/availabilityScope'
import { AwardsView } from './AwardsView'
import { BoardPanel } from './BoardPanel'
import { LeaderboardTabs } from './LeaderboardTabs'
import { resolveLeaderboardTab } from './leaderboardTabConfig'
import { useLeaderboardFilters } from './useLeaderboardFilters'

const DEFAULT_BOARD = 'MOST_RUNS'

// The board to show: ?board= if the catalogue lists it, else Most runs, else the first listed (a board the catalogue does not
// list is never offered).
function resolveBoard(catalogue: LeaderboardBoardInfo[], param: string | null): LeaderboardBoardInfo | undefined {
  return catalogue.find((board) => board.code === param) ?? catalogue.find((board) => board.code === DEFAULT_BOARD) ?? catalogue[0]
}

// docs/specs/103-player-stats.md (The Leaderboards page, mockup boards 2, 3 and 8): /manage/leaderboards. A title with the filled
// Awards action, the name toggle, a Standings | Awards strip bound to ?tab=, a compact FilterBar (Season defaulting to the current
// season, League, Section, Team; all saved per club and narrowed to values that have counted data), and either one board at a time
// (chosen from the Board select, ?board=) or the Awards view. Every filter and the paging are backend parameters.
export default function LeaderboardsPage() {
  const { clubId } = useOutletContext<{ clubId?: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = resolveLeaderboardTab(searchParams.get('tab'))
  useDocumentTitle('Leaderboards')

  const filterState = useLeaderboardFilters(clubId)
  const { filters, ready, hasFilters } = filterState
  const catalogueQuery = useLeaderboardCatalogue(clubId)
  const catalogue = catalogueBoards(catalogueQuery.data)
  const board = resolveBoard(catalogue, searchParams.get('board'))
  const profileQuery = useQuery({
    queryKey: ['managed-club', clubId, 'profile'],
    queryFn: () => getManagedClubProfile(clubId as string),
    enabled: Boolean(clubId) && tab === 'awards',
  })

  // The optional minimum of a rate board: per visit, never saved; cleared when the board or the filters change.
  const [minimum, setMinimum] = useState<number | null>(null)
  const appliedMinimum = useDebouncedValue(minimum, 400)
  const filterKey = JSON.stringify(filters)

  if (!clubId) {
    return <EmptyState title="Not authorized" description="No club is associated with your account." />
  }

  const setBoard = (code: string) => {
    const next = new URLSearchParams(searchParams)
    next.set('board', code)
    setSearchParams(next, { replace: true })
    setMinimum(null)
  }
  const clearFilters = () => {
    filterState.clearAll()
    setMinimum(null)
  }
  const showAwards = () => {
    const next = new URLSearchParams(searchParams)
    next.set('tab', 'awards')
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

  // Boards grouped Batting, Bowling, Fielding, Awards, in the catalogue's own order.
  const boardItems: ReactNode[] = []
  for (const { group, label, boards } of catalogueQuery.data?.groups ?? []) {
    if (boards.length === 0) continue
    boardItems.push(<ListSubheader key={`group-${group}`}>{label}</ListSubheader>)
    boards.forEach((entry) =>
      boardItems.push(
        <MenuItem key={entry.code} value={entry.code}>
          {entry.label}
        </MenuItem>,
      ),
    )
  }

  let content: ReactNode
  if (!ready || catalogueQuery.isLoading) {
    content = (
      <Box aria-busy="true" aria-label="Loading leaderboards" sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Skeleton variant="rounded" height={44} />
        <Skeleton variant="rounded" height={220} />
      </Box>
    )
  } else if (catalogueQuery.isError || !board) {
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
  } else if (tab === 'awards') {
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
  } else {
    content = (
      <>
        <Box sx={{ maxWidth: { sm: 320 } }}>
          <Input select label="Board" value={board.code} onChange={(event) => setBoard(event.target.value)}>
            {boardItems}
          </Input>
        </Box>
        <BoardPanel
          key={`${board.code}`}
          clubId={clubId}
          board={board}
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
          tab === 'standings' ? (
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
