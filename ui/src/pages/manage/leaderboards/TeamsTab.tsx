import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { ReactNode } from 'react'
import { isAxiosError } from 'axios'
import type { LeaderboardFilters, SortDirection } from '../../../api/leaderboardApi'
import { useTeamStatsTable } from '../../../api/teamStatsApi'
import type { TeamStatsColumn, TeamStatsCompetition } from '../../../api/teamStatsApi'
import { useDebouncedValue } from '../../../hooks/useDebouncedValue'
import { LeaderboardSortButton } from './LeaderboardSortButton'
import { TeamStandingsTable } from './TeamStandingsTable'

export const DEFAULT_TEAM_SORT = 'won'

// The 15 team column codes (docs/specs/116-team-stats.md). A ?sort= outside this list (a carried player sort, a hand-typed
// address) is dropped before any request, so the server never has to answer 400 for it.
const TEAM_SORT_CODES = ['played', 'won', 'lost', 'tied', 'drawn', 'noResult', 'winPercent', 'runs', 'battingAverage', 'runRate', 'highTotal', 'wicketsTaken', 'bowlingAverage', 'economy', 'netRunRate']

export interface TeamsTabProps {
  clubId: string
  filters: LeaderboardFilters
  competition: TeamStatsCompetition | null
  hasFilters: boolean
  onClearFilters: () => void
  enabled: boolean
  // docs/specs/140: builds the page's toolbar around this tab's own Sort button (the columns and the sort state live here).
  renderToolbar: (sort: ReactNode) => ReactNode
}

// docs/specs/116-team-stats.md (The Teams tab): the Teams table; docs/specs/140: its Sort button sits in the page's toolbar. The columns come from
// the response; ?sort= is checked against the team column codes before the first request, so a sort that is not a team column (a
// carried player sort) is dropped from the address and the default Wins is asked for. ?dir= is sent only together with a ?sort=.
export function TeamsTab({ clubId, filters, competition, hasFilters, onClearFilters, enabled, renderToolbar }: TeamsTabProps) {
  const [searchParams, setSearchParams] = useSearchParams()
  const rawSort = searchParams.get('sort')
  const unknownSort = Boolean(rawSort) && !TEAM_SORT_CODES.includes(rawSort as string)
  const sortParam = unknownSort ? null : rawSort
  const dirParam = searchParams.get('dir')
  const requestedSort = sortParam || DEFAULT_TEAM_SORT
  const requestedDirection: SortDirection | null = sortParam && (dirParam === 'asc' || dirParam === 'desc') ? dirParam : null

  // The optional minimum of a rate sort: per visit, never saved; dropped when the sort or any filter changes.
  const [minimumState, setMinimumState] = useState<{ scope: string; value: number | null }>({ scope: '', value: null })
  const scope = `${requestedSort}|${JSON.stringify(filters)}|${competition}`
  const minimum = minimumState.scope === scope ? minimumState.value : null
  const debouncedMinimum = useDebouncedValue(minimum, 400)
  const appliedMinimum = minimum === null ? null : debouncedMinimum

  // The sorted column decides whether the minimum applies (rate sorts); it is sent only then. Until the columns are known it is not.
  const [columnsSeen, setColumnsSeen] = useState<TeamStatsColumn[]>([])
  const requestedColumn = columnsSeen.find((column) => column.code === requestedSort)
  const sendMinimum = Boolean(requestedColumn && requestedColumn.minimumKind !== 'NONE')
  const query = useTeamStatsTable(
    clubId,
    { ...filters, competition, sort: requestedSort, direction: requestedDirection, minimum: sendMinimum ? appliedMinimum : null },
    enabled,
  )
  const first = query.firstPage
  const columns = first?.columns ?? []
  const sortCode = first?.sort.code ?? requestedSort
  const naturalDirection = columns.find((column) => column.code === sortCode)?.direction ?? 'HIGHEST'
  const effectiveDirection = first?.sort.direction ?? naturalDirection
  if (first && first.columns !== columnsSeen && first.columns.length !== columnsSeen.length) setColumnsSeen(first.columns)

  // A ?sort= the server does not know (a carried player sort) falls back to the default.
  const badSort = unknownSort || (Boolean(sortParam) && query.isError && !first && isAxiosError(query.error) && query.error.response?.status === 400)
  useEffect(() => {
    if (!badSort) return
    const next = new URLSearchParams(searchParams)
    next.delete('sort')
    next.delete('dir')
    setSearchParams(next, { replace: true })
  }, [badSort, searchParams, setSearchParams])

  const selectSort = (code: string) => {
    const next = new URLSearchParams(searchParams)
    next.set('sort', code)
    next.delete('dir')
    setSearchParams(next, { replace: true })
  }
  const reverseSort = () => {
    const next = new URLSearchParams(searchParams)
    next.set('sort', sortCode)
    const reversed = effectiveDirection === 'HIGHEST' ? 'LOWEST' : 'HIGHEST'
    if (reversed === naturalDirection) next.delete('dir')
    else next.set('dir', reversed === 'LOWEST' ? 'asc' : 'desc')
    setSearchParams(next, { replace: true })
  }
  const headingSort = (code: string) => (code === sortCode ? reverseSort() : selectSort(code))

  const sortButton =
    columns.length > 0 ? (
      <LeaderboardSortButton columns={columns} sortCode={sortCode} effectiveDirection={effectiveDirection} onSelect={selectSort} onReverse={reverseSort} />
    ) : null

  return (
    <>
      <TeamStandingsTable
        query={query}
        sortCode={sortCode}
        onSortChange={headingSort}
        filters={filters}
        competition={competition}
        hasFilters={hasFilters}
        onClearFilters={onClearFilters}
        minimum={minimum}
        onMinimumChange={(value) => setMinimumState({ scope, value })}
        appliedMinimum={appliedMinimum}
        toolbar={renderToolbar(sortButton)}
      />
    </>
  )
}
