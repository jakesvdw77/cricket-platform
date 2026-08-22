import { useEffect, useState } from 'react'
import { Box, Stack, Typography } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { RecordCard } from '../../components/RecordCard'
import type { RecordCardBadgeTone } from '../../components/RecordCard'
import { ListToolbar } from '../../components/ListToolbar'
import { Button } from '../../components/Button'
import { EmptyState } from '../../components/EmptyState'
import { listSubscriptions } from '../../api/subscriptionApi'
import type { SubscriptionStatus } from '../../api/subscriptionApi'

const STATUS_LABEL: Record<SubscriptionStatus, string> = {
  ACTIVE: 'Active',
  CANCELLED: 'Cancelled',
}

const STATUS_BADGE_TONE: Record<SubscriptionStatus, RecordCardBadgeTone> = {
  ACTIVE: 'positive',
  CANCELLED: 'muted',
}

// "club.name" is a real, backend-supported sort value — SubscriptionRepository exposes a
// dedicated searchOrderByClubNameAsc query for it (Subscription.ownerId is a plain UUID column,
// not a JPA relationship, so a generic Pageable sort can't resolve "club.name" against the
// Subscription entity the way "startDate" can — see that query's Javadoc for why a separate
// query, not a Sort translation, was the fix).
const SORT_OPTIONS = [
  { value: 'startDate,desc', label: 'Start date' },
  { value: 'club.name,asc', label: 'Club name' },
]

const SEARCH_DEBOUNCE_MS = 300

export default function SubscriptionList() {
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
    queryKey: ['subscriptions', page, debouncedSearch, sort],
    queryFn: () => listSubscriptions({ page, search: debouncedSearch || undefined, sort }),
  })

  if (isLoading) {
    return null
  }

  if (isError || !data) {
    return (
      <EmptyState
        title="Couldn't load subscriptions"
        description="Something went wrong loading the subscription list. Please try again."
      />
    )
  }

  const hasSubscriptions = data.content.length > 0
  const isSearching = debouncedSearch.length > 0

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <ListToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by club name"
        sortValue={sort}
        sortOptions={SORT_OPTIONS}
        onSortChange={setSort}
        createLabel="Add Subscription"
        onCreate={() => navigate('/admin/billing/new')}
      />

      {hasSubscriptions && (
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
          }}
        >
          {data.content.map((subscription) => (
            <RecordCard
              key={subscription.id}
              title={subscription.club.name}
              badge={{
                label: STATUS_LABEL[subscription.status],
                tone: STATUS_BADGE_TONE[subscription.status],
              }}
              description={subscription.product.name}
              fields={[
                { label: 'Product code', value: subscription.product.code },
                { label: 'Start date', value: subscription.startDate },
              ]}
              editLabel="Edit"
              editTo={`/admin/billing/${subscription.id}/edit`}
            />
          ))}
        </Box>
      )}

      {!hasSubscriptions && isSearching && (
        <EmptyState
          title="No matching subscriptions"
          description={`No subscriptions match "${debouncedSearch}". Try a different search.`}
        />
      )}

      {!hasSubscriptions && !isSearching && (
        <EmptyState
          title="No subscriptions yet"
          description="Create your first subscription to link a club to a product."
        />
      )}

      {hasSubscriptions && data.totalPages > 1 && (
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
