import { useMemo, useState } from 'react'
import { Box } from '@mui/material'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { RecordCard } from '../../components/RecordCard'
import type { RecordCardBadge, RecordCardField } from '../../components/RecordCard'
import { ListToolbar } from '../../components/ListToolbar'
import { EmptyState } from '../../components/EmptyState'
import { ManageScreenHeader } from '../../components/ManageScreenHeader'
import { listSponsors, deactivateSponsor, reactivateSponsor } from '../../api/sponsorApi'
import type { Sponsor } from '../../api/sponsorApi'

const SORT_OPTIONS = [{ value: 'name,asc', label: 'Name' }]

function badgeFor(sponsor: Sponsor): RecordCardBadge | undefined {
  if (!sponsor.active) {
    return { label: 'Inactive', tone: 'muted' }
  }
  return undefined
}

function fieldsFor(sponsor: Sponsor): RecordCardField[] {
  const fields: RecordCardField[] = []
  if (sponsor.website) {
    fields.push({ label: 'Website', value: sponsor.website })
  }
  if (sponsor.email) {
    fields.push({ label: 'Email', value: sponsor.email })
  }
  if (sponsor.phone) {
    fields.push({ label: 'Phone', value: sponsor.phone })
  }
  return fields
}

// One RecordCard per sponsor, each with its own deactivate/reactivate mutation — mirrors
// ClubContactList.tsx's ClubContactCard pattern, so one card's pending state never leaks onto
// another's.
function SponsorCard({ clubId, sponsor }: { clubId: string; sponsor: Sponsor }) {
  const queryClient = useQueryClient()

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['managed-club', clubId, 'sponsors'] })

  const deactivate = useMutation({
    mutationFn: () => deactivateSponsor(clubId, sponsor.id),
    onSuccess: invalidate,
  })

  const reactivate = useMutation({
    mutationFn: () => reactivateSponsor(clubId, sponsor.id),
    onSuccess: invalidate,
  })

  const toggle = sponsor.active ? deactivate : reactivate

  return (
    <RecordCard
      title={sponsor.name}
      badge={badgeFor(sponsor)}
      fields={fieldsFor(sponsor)}
      editLabel="Edit"
      editTo={`/manage/sponsors/${sponsor.id}/edit`}
      secondaryAction={{
        label: sponsor.active ? 'Deactivate' : 'Reactivate',
        pendingLabel: sponsor.active ? 'Deactivating…' : 'Reactivating…',
        pending: toggle.isPending,
        onClick: () => toggle.mutate(),
      }}
    />
  )
}

// Reads clubId from ManagerHome's Outlet context (docs/specs/020-club-manager-access.md), same
// guard pattern as ClubContactList.tsx. Deliberately no pagination state — a club's sponsors are
// a small, bounded list (docs/specs/023-sponsors.md's Architecture note), fetched in full and
// filtered/sorted client-side, unlike ProductList's backend-driven pagination.
export default function SponsorList() {
  const { clubId } = useOutletContext<{ clubId?: string }>()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState(SORT_OPTIONS[0].value)

  const {
    data: sponsors,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['managed-club', clubId, 'sponsors'],
    queryFn: () => listSponsors(clubId as string),
    enabled: Boolean(clubId),
  })

  const visibleSponsors = useMemo(() => {
    if (!sponsors) {
      return []
    }

    const term = search.trim().toLowerCase()
    const filtered = term ? sponsors.filter((sponsor) => sponsor.name.toLowerCase().includes(term)) : sponsors

    const [, direction] = sort.split(',') as ['name', 'asc' | 'desc']
    const sorted = [...filtered].sort((a, b) => a.name.localeCompare(b.name))

    return direction === 'desc' ? sorted.reverse() : sorted
  }, [sponsors, search, sort])

  if (!clubId) {
    return <EmptyState title="Not authorized" description="No club is associated with your account." />
  }

  if (isLoading) {
    return null
  }

  if (isError || !sponsors) {
    return (
      <EmptyState
        title="Couldn't load sponsors"
        description="Something went wrong loading your club's sponsors. Please try again."
      />
    )
  }

  const hasSponsors = sponsors.length > 0
  const isSearching = search.trim().length > 0

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <ManageScreenHeader title="Club Sponsors" />

      <ListToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by name"
        sortValue={sort}
        sortOptions={SORT_OPTIONS}
        onSortChange={setSort}
        createLabel="Add Sponsor"
        onCreate={() => navigate('/manage/sponsors/new')}
      />

      {visibleSponsors.length > 0 && (
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
          }}
        >
          {visibleSponsors.map((sponsor) => (
            <SponsorCard key={sponsor.id} clubId={clubId} sponsor={sponsor} />
          ))}
        </Box>
      )}

      {visibleSponsors.length === 0 && isSearching && (
        <EmptyState
          title="No matching sponsors"
          description={`No sponsors match "${search.trim()}". Try a different search.`}
        />
      )}

      {!hasSponsors && !isSearching && (
        <EmptyState title="No sponsors yet" description="Add your club's first sponsor to get started." />
      )}
    </Box>
  )
}
