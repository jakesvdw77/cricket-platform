import { useEffect, useState } from 'react'
import { Box, Stack, Typography } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined'
import { RecordCard } from '../../components/RecordCard'
import type { RecordCardBadgeTone } from '../../components/RecordCard'
import { ListToolbar } from '../../components/ListToolbar'
import { Button } from '../../components/Button'
import { EmptyState } from '../../components/EmptyState'
import { listClubs } from '../../api/clubApi'
import type { ClubStatus } from '../../api/clubApi'

const STATUS_LABEL: Record<ClubStatus, string> = {
  ONBOARDING: 'Onboarding',
  ACTIVE: 'Active',
  SUSPENDED: 'Suspended',
}

const STATUS_BADGE_TONE: Record<ClubStatus, RecordCardBadgeTone> = {
  ONBOARDING: 'neutral',
  ACTIVE: 'positive',
  SUSPENDED: 'muted',
}

// Alphabetical by default — matches ClubServiceImpl.list()'s own fallback sort when unsorted
// (docs/plans/010-minimal-club-creation.md Flag #4), the most usable default for "find the
// club I'm looking for."
const SORT_OPTIONS = [
  { value: 'name,asc', label: 'Name' },
  { value: 'createdAt,desc', label: 'Created date' },
]

const SEARCH_DEBOUNCE_MS = 300

export default function ClubList() {
  const navigate = useNavigate()
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [sort, setSort] = useState(SORT_OPTIONS[0].value)

  // Debounced into the query key, not filtered client-side — the API's `search` param does
  // the filtering, per docs/standards/frontend.md's pagination rule.
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(search.trim()), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(handle)
  }, [search])

  useEffect(() => {
    setPage(0)
  }, [debouncedSearch, sort])

  const { data, isLoading, isError } = useQuery({
    queryKey: ['clubs', page, debouncedSearch, sort],
    queryFn: () => listClubs({ page, search: debouncedSearch || undefined, sort }),
  })

  if (isLoading) {
    return null
  }

  if (isError || !data) {
    return (
      <EmptyState
        title="Couldn't load clubs"
        description="Something went wrong loading the club list. Please try again."
      />
    )
  }

  const hasClubs = data.content.length > 0
  const isSearching = debouncedSearch.length > 0

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <ListToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by name or slug"
        sortValue={sort}
        sortOptions={SORT_OPTIONS}
        onSortChange={setSort}
        createLabel="Add Club"
        onCreate={() => navigate('/admin/onboarding/new')}
      />

      {hasClubs && (
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
          }}
        >
          {data.content.map((club) => (
            <RecordCard
              key={club.id}
              title={club.name}
              avatar={{ fallback: <BusinessOutlinedIcon fontSize="small" />, shape: 'rounded' }}
              badge={{
                label: STATUS_LABEL[club.status],
                tone: STATUS_BADGE_TONE[club.status],
              }}
              description={club.slug}
              editLabel="Edit"
              editTo={`/admin/onboarding/${club.id}/edit`}
            />
          ))}
        </Box>
      )}

      {!hasClubs && isSearching && (
        <EmptyState
          title="No matching clubs"
          description={`No clubs match "${debouncedSearch}". Try a different search.`}
        />
      )}

      {!hasClubs && !isSearching && (
        <EmptyState title="No clubs yet" description="Create your first club to get started." />
      )}

      {hasClubs && data.totalPages > 1 && (
        <Stack direction="row" spacing={2} justifyContent="center" alignItems="center">
          <Button variant="secondary" size="sm" disabled={page === 0} onClick={() => setPage((prev) => prev - 1)}>
            Previous
          </Button>
          <Typography variant="body2" color="text.secondary">
            Page {data.number + 1} of {data.totalPages}
          </Typography>
          <Button
            variant="secondary"
            size="sm"
            disabled={page + 1 >= data.totalPages}
            onClick={() => setPage((prev) => prev + 1)}
          >
            Next
          </Button>
        </Stack>
      )}
    </Box>
  )
}
