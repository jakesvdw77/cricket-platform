import { useMemo, useState } from 'react'
import { Box } from '@mui/material'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import ToggleOffOutlinedIcon from '@mui/icons-material/ToggleOffOutlined'
import ToggleOnOutlinedIcon from '@mui/icons-material/ToggleOnOutlined'
import EmojiEventsOutlinedIcon from '@mui/icons-material/EmojiEventsOutlined'
import { RecordCard } from '../../components/RecordCard'
import type { RecordCardBadge, RecordCardField } from '../../components/RecordCard'
import { ListToolbar } from '../../components/ListToolbar'
import { EmptyState } from '../../components/EmptyState'
import { ManageScreenHeader } from '../../components/ManageScreenHeader'
import { listLeagues, deactivateLeague, reactivateLeague } from '../../api/leagueApi'
import type { League } from '../../api/leagueApi'

const SORT_OPTIONS = [{ value: 'name,asc', label: 'Name' }]

function badgeFor(league: League): RecordCardBadge | undefined {
  if (!league.active) {
    return { label: 'Inactive', tone: 'muted' }
  }
  return undefined
}

function leagueRecordFields(league: League): RecordCardField[] {
  const fields: RecordCardField[] = [{ label: 'Playing XI size', value: league.maxPlayingXiSize }]
  if (league.minAge != null || league.maxAge != null) {
    fields.push({
      label: 'Age range',
      value: `${league.minAge ?? 'Any'}–${league.maxAge ?? 'Any'}`,
    })
  }
  return fields
}

function leagueChips(league: League): string[] {
  const chips: string[] = []
  if (league.allowSubstitutions) {
    chips.push('Substitutions allowed')
  }
  return chips
}

// One RecordCard per league, each with its own deactivate/reactivate mutation — mirrors
// SponsorList.tsx's SponsorCard pattern, so one card's pending state never leaks onto another's.
function LeagueCard({ clubId, league }: { clubId: string; league: League }) {
  const queryClient = useQueryClient()

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['managed-club', clubId, 'leagues'] })

  const deactivate = useMutation({
    mutationFn: () => deactivateLeague(clubId, league.id),
    onSuccess: invalidate,
  })

  const reactivate = useMutation({
    mutationFn: () => reactivateLeague(clubId, league.id),
    onSuccess: invalidate,
  })

  const toggle = league.active ? deactivate : reactivate

  return (
    <RecordCard
      title={league.name}
      avatar={{ fallback: <EmojiEventsOutlinedIcon fontSize="small" />, shape: 'rounded' }}
      badge={badgeFor(league)}
      fields={leagueRecordFields(league)}
      chips={leagueChips(league)}
      editLabel="Edit"
      editTo={`/manage/fixtures/leagues/${league.id}/edit`}
      secondaryAction={{
        label: league.active ? 'Deactivate' : 'Reactivate',
        pendingLabel: league.active ? 'Deactivating…' : 'Reactivating…',
        pending: toggle.isPending,
        onClick: () => toggle.mutate(),
        icon: league.active ? <ToggleOffOutlinedIcon fontSize="small" /> : <ToggleOnOutlinedIcon fontSize="small" />,
      }}
    />
  )
}

// Reads clubId from ManagerHome's Outlet context, same guard pattern as every other /manage list.
// Deliberately no pagination state — a club's own leagues are a small, bounded list, matching
// Section/Team/Sponsor's own posture (docs/specs/029-league-management.md).
export default function LeagueList() {
  const { clubId } = useOutletContext<{ clubId?: string }>()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState(SORT_OPTIONS[0].value)

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
    const filtered = term ? leagues.filter((league) => league.name.toLowerCase().includes(term)) : leagues

    const [, direction] = sort.split(',') as ['name', 'asc' | 'desc']
    const sorted = [...filtered].sort((a, b) => a.name.localeCompare(b.name))

    return direction === 'desc' ? sorted.reverse() : sorted
  }, [leagues, search, sort])

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

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <ManageScreenHeader title="Leagues" backTo="/manage/fixtures" backLabel="Back to Fixtures & Results" />

      <ListToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by name"
        sortValue={sort}
        sortOptions={SORT_OPTIONS}
        onSortChange={setSort}
        createLabel="Add League"
        onCreate={() => navigate('/manage/fixtures/leagues/new')}
      />

      {visibleLeagues.length > 0 && (
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
          }}
        >
          {visibleLeagues.map((league) => (
            <LeagueCard key={league.id} clubId={clubId} league={league} />
          ))}
        </Box>
      )}

      {visibleLeagues.length === 0 && isSearching && (
        <EmptyState
          title="No matching leagues"
          description={`No leagues match "${search.trim()}". Try a different search.`}
        />
      )}

      {!hasLeagues && !isSearching && (
        <EmptyState title="No leagues yet" description="Create your club's first league to get started." />
      )}
    </Box>
  )
}
