import { useEffect, useState } from 'react'
import { Box, Stack, Typography } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { RecordCard } from '../../components/RecordCard'
import { ListToolbar } from '../../components/ListToolbar'
import { Button } from '../../components/Button'
import { EmptyState } from '../../components/EmptyState'
import { listProducts } from '../../api/productApi'
import type { Product, ProductStatus } from '../../api/productApi'

const STATUS_LABEL: Record<ProductStatus, string> = {
  DRAFT: 'Draft',
  ACTIVE: 'Active',
  RETIRED: 'Retired',
}

const SORT_OPTIONS = [
  { value: 'name,asc', label: 'Name' },
  { value: 'price,asc', label: 'Price' },
  { value: 'displayOrder,asc', label: 'Display order' },
]

const SEARCH_DEBOUNCE_MS = 300

function formatPrice(product: Product): string {
  if (product.isFree) {
    return 'Free'
  }

  if (product.price === null || product.currency === null) {
    return '—'
  }

  const interval = product.billingInterval === 'ANNUAL' ? '/year' : '/month'
  return `${product.currency} ${product.price.toFixed(2)}${interval}`
}

function limitChipLabels(product: Product): string[] {
  const limits = [
    { label: 'sections', value: product.maxSections },
    { label: 'teams', value: product.maxTeams },
    { label: 'players', value: product.maxPlayers },
  ]

  return limits.map(({ label, value }) => (value === null ? `Unlimited ${label}` : `${value} ${label}`))
}

export default function ProductList() {
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

  const { data, isLoading } = useQuery({
    queryKey: ['products', page, debouncedSearch, sort],
    queryFn: () => listProducts({ page, search: debouncedSearch || undefined, sort }),
  })

  if (isLoading || !data) {
    return null
  }

  const hasProducts = data.content.length > 0
  const isSearching = debouncedSearch.length > 0

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <ListToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by name or code"
        sortValue={sort}
        sortOptions={SORT_OPTIONS}
        onSortChange={setSort}
        createLabel="Add Product"
        onCreate={() => navigate('/admin/configuration/products/new')}
      />

      {hasProducts && (
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
          }}
        >
          {data.content.map((product) => (
            <RecordCard
              key={product.id}
              title={product.name}
              badge={{
                label: STATUS_LABEL[product.status],
                tone: product.status === 'ACTIVE' ? 'positive' : 'neutral',
              }}
              description={product.description}
              fields={[
                { label: 'Price', value: formatPrice(product) },
                { label: 'Code', value: product.code },
              ]}
              chips={limitChipLabels(product)}
              editLabel="Edit"
              editTo={`/admin/configuration/products/${product.id}/edit`}
            />
          ))}
        </Box>
      )}

      {!hasProducts && isSearching && (
        <EmptyState
          title="No matching products"
          description={`No products match "${debouncedSearch}". Try a different search.`}
        />
      )}

      {!hasProducts && !isSearching && (
        <EmptyState title="No products yet" description="Create your first product to build out the catalogue." />
      )}

      {hasProducts && data.totalPages > 1 && (
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
