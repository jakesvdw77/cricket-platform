import { useMemo, useState } from 'react'
import { Box } from '@mui/material'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { RecordCard } from '../../components/RecordCard'
import type { RecordCardBadge } from '../../components/RecordCard'
import { ListToolbar } from '../../components/ListToolbar'
import { EmptyState } from '../../components/EmptyState'
import { ManageScreenHeader } from '../../components/ManageScreenHeader'
import { Button } from '../../components/Button'
import { listSponsors } from '../../api/sponsorApi'
import type { Sponsor } from '../../api/sponsorApi'
import { sponsorRecordFields } from '../../utils/sponsorRecordFields'
import { initialsFromName } from '../../utils/initials'

// Exported for SponsorDetailPage.tsx (docs/specs/036-view-first-record-detail-screens.md) so the
// new read-only view screen's badge matches this card's exactly, rather than a second copy.
export function badgeFor(sponsor: Sponsor): RecordCardBadge | undefined {
  if (!sponsor.active) {
    return { label: 'Inactive', tone: 'muted' }
  }
  return undefined
}

// One RecordCard per sponsor — Deactivate/Reactivate now lives on SponsorFormPage's own actions
// bar (docs/specs/038-move-deactivate-to-edit-screen.md), not here; this card is a read-only
// summary with "View" as its only footer action.
function SponsorCard({ sponsor }: { sponsor: Sponsor }) {
  return (
    <RecordCard
      title={sponsor.name}
      avatar={{ imageUrl: sponsor.logoUrl, fallback: initialsFromName(sponsor.name), shape: 'rounded' }}
      badge={badgeFor(sponsor)}
      fields={sponsorRecordFields(sponsor)}
      viewTo={`/manage/sponsors/${sponsor.id}`}
      editTo={`/manage/sponsors/${sponsor.id}/edit`}
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
  const [sort, setSort] = useState('name,asc')

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
      <ManageScreenHeader
        title="Club Sponsors"
        action={<Button onClick={() => navigate('/manage/sponsors/new')}>Add Sponsor</Button>}
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
            <SponsorCard key={sponsor.id} sponsor={sponsor} />
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
