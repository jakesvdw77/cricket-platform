import { useMemo, useState } from 'react'
import { Box, MenuItem } from '@mui/material'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ListToolbar } from '../../components/ListToolbar'
import { EmptyState } from '../../components/EmptyState'
import { ManageScreenHeader } from '../../components/ManageScreenHeader'
import { Button } from '../../components/Button'
import { Input } from '../../components/Input'
import { listLeagues, LEAGUE_FORMAT_LABELS } from '../../api/leagueApi'
import type { LeagueFormat } from '../../api/leagueApi'
import { usePersistedListFilters } from '../../hooks/usePersistedListFilters'
import { cardGridSx } from '../../utils/cardGrid'
import { LeagueCard } from './leagues/LeagueCard'

const FORMATS = Object.keys(LEAGUE_FORMAT_LABELS) as LeagueFormat[]

function noMatchDescription(term: string, format: string): string {
  const formatLabel = format ? LEAGUE_FORMAT_LABELS[format as LeagueFormat] ?? format : ''
  if (term && formatLabel) {
    return `No ${formatLabel} leagues match "${term}". Try a different search or choose All formats.`
  }
  if (formatLabel) {
    return `No ${formatLabel} leagues found. Choose All formats to see every league.`
  }
  return `No leagues match "${term}". Try a different search.`
}

// Reads clubId from ManagerHome's Outlet context, same guard pattern as every other /manage list.
// Deliberately no pagination state — a club's own leagues are a small, bounded list, matching
// Section/Team/Sponsor's own posture (docs/specs/029-league-management.md).
export default function LeagueList() {
  const { clubId } = useOutletContext<{ clubId?: string }>()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('name,asc')
  // docs/specs/071-league-card-redesign.md: the Format filter is client-side but persisted per club.
  const [{ format }, setFilters] = usePersistedListFilters(`leagueList:filters:${clubId}`, { format: '' })

  const {
    data: leagues,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['managed-club', clubId, 'leagues'],
    queryFn: () => listLeagues(clubId as string),
    enabled: Boolean(clubId),
  })

  const visibleLeagues = useMemo(() => {
    if (!leagues) {
      return []
    }

    const term = search.trim().toLowerCase()
    const byName = term ? leagues.filter((league) => league.name.toLowerCase().includes(term)) : leagues
    const filtered = format ? byName.filter((league) => league.format === format) : byName

    const [, direction] = sort.split(',') as ['name', 'asc' | 'desc']
    const sorted = [...filtered].sort((a, b) => a.name.localeCompare(b.name))

    return direction === 'desc' ? sorted.reverse() : sorted
  }, [leagues, search, sort, format])

  if (!clubId) {
    return <EmptyState title="Not authorized" description="No club is associated with your account." />
  }

  if (isLoading) {
    return null
  }

  if (isError || !leagues) {
    return (
      <EmptyState
        title="Couldn't load leagues"
        description="Something went wrong loading your club's leagues. Please try again."
      />
    )
  }

  const hasLeagues = leagues.length > 0
  const isSearching = search.trim().length > 0
  const isFiltering = isSearching || format !== ''

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <ManageScreenHeader
        title="Leagues"
        action={<Button onClick={() => navigate('/manage/fixtures/leagues/new')}>Add League</Button>}
      />

      <ListToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by name"
        sortToggle={{
          value: sort.endsWith(',asc') ? 'asc' : 'desc',
          ascLabel: 'Name, A to Z',
          descLabel: 'Name, Z to A',
          onToggle: () => setSort(sort.endsWith(',asc') ? 'name,desc' : 'name,asc'),
        }}
        filters={
          <Input select label="Format" value={format} onChange={(event) => setFilters({ format: event.target.value })}>
            <MenuItem value="">All formats</MenuItem>
            {FORMATS.map((value) => (
              <MenuItem key={value} value={value}>
                {LEAGUE_FORMAT_LABELS[value]}
              </MenuItem>
            ))}
          </Input>
        }
      />

      {visibleLeagues.length > 0 && (
        <Box sx={cardGridSx}>
          {visibleLeagues.map((league) => (
            <LeagueCard key={league.id} league={league} />
          ))}
        </Box>
      )}

      {visibleLeagues.length === 0 && hasLeagues && isFiltering && (
        <EmptyState title="No matching leagues" description={noMatchDescription(search.trim(), format)} />
      )}

      {!hasLeagues && (
        <EmptyState title="No leagues yet" description="Create your club's first league to get started." />
      )}
    </Box>
  )
}
