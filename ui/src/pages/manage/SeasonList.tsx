import { useMemo, useState } from 'react'
import { Box } from '@mui/material'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import EventOutlinedIcon from '@mui/icons-material/EventOutlined'
import { RecordCard } from '../../components/RecordCard'
import type { RecordCardBadge } from '../../components/RecordCard'
import { ListToolbar } from '../../components/ListToolbar'
import { EmptyState } from '../../components/EmptyState'
import { ManageScreenHeader } from '../../components/ManageScreenHeader'
import { listSeasons } from '../../api/seasonApi'
import type { Season } from '../../api/seasonApi'

const SORT_OPTIONS = [{ value: 'label,asc', label: 'Label' }]

// Exported for SeasonDetailPage.tsx (docs/specs/036-view-first-record-detail-screens.md) so the
// new read-only view screen's badge matches this card's exactly, rather than a second copy.
export function badgeFor(season: Season): RecordCardBadge | undefined {
  if (!season.active) {
    return { label: 'Inactive', tone: 'muted' }
  }
  return undefined
}

// One RecordCard per season — Deactivate/Reactivate now lives on SeasonFormPage's own actions bar
// (docs/specs/038-move-deactivate-to-edit-screen.md), not here; this card is a read-only summary
// with "View" as its only footer action.
function SeasonCard({ season }: { season: Season }) {
  return (
    <RecordCard
      title={season.label}
      avatar={{ fallback: <EventOutlinedIcon fontSize="small" />, shape: 'rounded' }}
      badge={badgeFor(season)}
      fields={[
        { label: 'Start date', value: season.startDate },
        { label: 'End date', value: season.endDate },
      ]}
      viewTo={`/manage/fixtures/seasons/${season.id}`}
    />
  )
}

// Reads clubId from ManagerHome's Outlet context, same guard pattern as every other /manage list.
// Deliberately no pagination state — a club's own seasons are a small, bounded list (one per
// year/period), matching League/Team/Sponsor's own posture (docs/specs/029-league-management.md).
export default function SeasonList() {
  const { clubId } = useOutletContext<{ clubId?: string }>()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState(SORT_OPTIONS[0].value)

  const {
    data: seasons,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['managed-club', clubId, 'seasons'],
    queryFn: () => listSeasons(clubId as string),
    enabled: Boolean(clubId),
  })

  const visibleSeasons = useMemo(() => {
    if (!seasons) {
      return []
    }

    const term = search.trim().toLowerCase()
    const filtered = term ? seasons.filter((season) => season.label.toLowerCase().includes(term)) : seasons

    const [, direction] = sort.split(',') as ['label', 'asc' | 'desc']
    const sorted = [...filtered].sort((a, b) => a.label.localeCompare(b.label))

    return direction === 'desc' ? sorted.reverse() : sorted
  }, [seasons, search, sort])

  if (!clubId) {
    return <EmptyState title="Not authorized" description="No club is associated with your account." />
  }

  if (isLoading) {
    return null
  }

  if (isError || !seasons) {
    return (
      <EmptyState
        title="Couldn't load seasons"
        description="Something went wrong loading your club's seasons. Please try again."
      />
    )
  }

  const hasSeasons = seasons.length > 0
  const isSearching = search.trim().length > 0

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <ManageScreenHeader title="Seasons" backTo="/manage/fixtures" backLabel="Back to Fixtures" />

      <ListToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by label"
        sortValue={sort}
        sortOptions={SORT_OPTIONS}
        onSortChange={setSort}
        createLabel="Add Season"
        onCreate={() => navigate('/manage/fixtures/seasons/new')}
      />

      {visibleSeasons.length > 0 && (
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
          }}
        >
          {visibleSeasons.map((season) => (
            <SeasonCard key={season.id} season={season} />
          ))}
        </Box>
      )}

      {visibleSeasons.length === 0 && isSearching && (
        <EmptyState
          title="No matching seasons"
          description={`No seasons match "${search.trim()}". Try a different search.`}
        />
      )}

      {!hasSeasons && !isSearching && (
        <EmptyState title="No seasons yet" description="Create your club's first season to get started." />
      )}
    </Box>
  )
}
