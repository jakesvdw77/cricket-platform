import { useMemo, useState } from 'react'
import { Box } from '@mui/material'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { RecordCard } from '../../components/RecordCard'
import type { RecordCardBadge } from '../../components/RecordCard'
import { ListToolbar } from '../../components/ListToolbar'
import { EmptyState } from '../../components/EmptyState'
import { ManageScreenHeader } from '../../components/ManageScreenHeader'
import { Button } from '../../components/Button'
import { listSponsorContacts } from '../../api/sponsorContactApi'
import type { SponsorContact } from '../../api/sponsorContactApi'
import { initialsFromName } from '../../utils/initials'

// docs/specs/043-list-toolbar-gold-standard.md: the one two-sortable-field screen in this
// rollout — passed to ListToolbar's sortFieldOptions, paired with sortToggle for direction.
const SORT_FIELD_OPTIONS = [
  { value: 'name', label: 'Name' },
  { value: 'role', label: 'Role' },
]

// Exported for SponsorContactDetailPage.tsx (docs/specs/036-view-first-record-detail-screens.md)
// so the new read-only view screen's title/badge match this card's exactly, rather than a second
// copy.
export function fullName(contact: SponsorContact): string {
  return `${contact.contact.firstName} ${contact.contact.lastName}`
}

export function badgeFor(contact: SponsorContact): RecordCardBadge | undefined {
  if (contact.isPrimary) {
    return { label: 'Primary', tone: 'positive' }
  }
  if (!contact.active) {
    return { label: 'Inactive', tone: 'muted' }
  }
  return undefined
}

// One RecordCard per contact — Deactivate/Reactivate now lives on SponsorContactFormPage's own
// actions bar (docs/specs/038-move-deactivate-to-edit-screen.md), not here; this card is a
// read-only summary with "View" as its only footer action.
function SponsorContactCard({ sponsorId, contact }: { sponsorId: string; contact: SponsorContact }) {
  return (
    <RecordCard
      title={fullName(contact)}
      avatar={{ fallback: initialsFromName(fullName(contact)), shape: 'circular' }}
      badge={badgeFor(contact)}
      fields={[
        { label: 'Role', value: contact.role },
        { label: 'Email', value: contact.contact.email },
        { label: 'Phone', value: contact.contact.phone },
      ]}
      viewTo={`/manage/sponsors/${sponsorId}/contacts/${contact.id}`}
    />
  )
}

// Reads sponsorId from the route and clubId from ManagerHome's Outlet context (docs/specs/
// 020-club-manager-access.md), same guard pattern as ClubContactList.tsx. Deliberately no
// pagination state — a sponsor's contacts are a small, bounded list (docs/specs/
// 024-sponsor-contacts.md's Context), fetched in full and filtered/sorted client-side. The back
// link goes to this sponsor's edit screen, not the dashboard — the one navigational difference
// from ClubContactList.
export default function SponsorContactList() {
  const { clubId } = useOutletContext<{ clubId?: string }>()
  const { sponsorId } = useParams<{ sponsorId: string }>()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('name,asc')

  const {
    data: contacts,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['managed-club', clubId, 'sponsors', sponsorId, 'contacts'],
    queryFn: () => listSponsorContacts(clubId as string, sponsorId as string),
    enabled: Boolean(clubId) && Boolean(sponsorId),
  })

  const visibleContacts = useMemo(() => {
    if (!contacts) {
      return []
    }

    const term = search.trim().toLowerCase()
    const filtered = term ? contacts.filter((contact) => fullName(contact).toLowerCase().includes(term)) : contacts

    const [field, direction] = sort.split(',') as ['name' | 'role', 'asc' | 'desc']
    const sorted = [...filtered].sort((a, b) => {
      const left = field === 'name' ? fullName(a) : a.role
      const right = field === 'name' ? fullName(b) : b.role
      return left.localeCompare(right)
    })

    return direction === 'desc' ? sorted.reverse() : sorted
  }, [contacts, search, sort])

  if (!clubId) {
    return <EmptyState title="Not authorized" description="No club is associated with your account." />
  }

  if (!sponsorId) {
    return <EmptyState title="Not found" description="No sponsor was specified." />
  }

  if (isLoading) {
    return null
  }

  if (isError || !contacts) {
    return (
      <EmptyState
        title="Couldn't load contacts"
        description="Something went wrong loading this sponsor's contacts. Please try again."
      />
    )
  }

  const hasContacts = contacts.length > 0
  const isSearching = search.trim().length > 0

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <ManageScreenHeader
        title="Sponsor Contacts"
        backTo={`/manage/sponsors/${sponsorId}/edit`}
        backLabel="Back to Sponsor"
        action={<Button onClick={() => navigate(`/manage/sponsors/${sponsorId}/contacts/new`)}>Add Contact</Button>}
      />

      <ListToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by name"
        sortToggle={{
          value: sort.endsWith(',asc') ? 'asc' : 'desc',
          ascLabel: `${sort.startsWith('role') ? 'Role' : 'Name'}, A to Z`,
          descLabel: `${sort.startsWith('role') ? 'Role' : 'Name'}, Z to A`,
          onToggle: () => setSort(sort.endsWith(',asc') ? `${sort.split(',')[0]},desc` : `${sort.split(',')[0]},asc`),
        }}
        sortFieldOptions={SORT_FIELD_OPTIONS}
        sortField={sort.split(',')[0]}
        onSortFieldChange={(field) => setSort(`${field},${sort.endsWith(',asc') ? 'asc' : 'desc'}`)}
      />

      {visibleContacts.length > 0 && (
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
          }}
        >
          {visibleContacts.map((contact) => (
            <SponsorContactCard key={contact.id} sponsorId={sponsorId} contact={contact} />
          ))}
        </Box>
      )}

      {visibleContacts.length === 0 && isSearching && (
        <EmptyState
          title="No matching contacts"
          description={`No contacts match "${search.trim()}". Try a different search.`}
        />
      )}

      {!hasContacts && !isSearching && (
        <EmptyState title="No contacts yet" description="Add this sponsor's first contact to get started." />
      )}
    </Box>
  )
}
