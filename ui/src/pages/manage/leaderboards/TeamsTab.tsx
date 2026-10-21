import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Box, IconButton, MenuItem } from '@mui/material'
import SwapVertIcon from '@mui/icons-material/SwapVert'
import { isAxiosError } from 'axios'
import { Input } from '../../../components/Input'
import type { LeaderboardFilters, SortDirection } from '../../../api/leaderboardApi'
import { useTeamStatsTable } from '../../../api/teamStatsApi'
import type { TeamStatsColumn, TeamStatsCompetition } from '../../../api/teamStatsApi'
import { useDebouncedValue } from '../../../hooks/useDebouncedValue'
import { TeamStandingsTable } from './TeamStandingsTable'

export const DEFAULT_TEAM_SORT = 'won'

export interface TeamsTabProps {
  clubId: string
  filters: LeaderboardFilters
  competition: TeamStatsCompetition | null
  hasFilters: boolean
  onClearFilters: () => void
  enabled: boolean
}

// docs/specs/116-team-stats.md (The Teams tab): the Sort by select, the reverse button and the Teams table. The columns come from
// the response, so ?sort= is validated by the server: a sort that is not a team column (a carried player sort) answers 400 and
// falls back to the default Wins. ?dir= is sent only together with a ?sort=.
export function TeamsTab({ clubId, filters, competition, hasFilters, onClearFilters, enabled }: TeamsTabProps) {
  const [searchParams, setSearchParams] = useSearchParams()
  const sortParam = searchParams.get('sort')
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
  const badSort = Boolean(sortParam) && query.isError && !first && isAxiosError(query.error) && query.error.response?.status === 400
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

  return (
    <>
      {columns.length > 0 && (
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
            sx={{ flexShrink: 0, width: { xs: 44, sm: 40 }, height: { xs: 44, sm: 40 }, p: 0, border: 1, borderColor: 'divider', borderRadius: 1, color: effectiveDirection !== naturalDirection ? 'primary.dark' : 'text.secondary' }}
          >
            <SwapVertIcon />
          </IconButton>
        </Box>
      )}
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
      />
    </>
  )
}
