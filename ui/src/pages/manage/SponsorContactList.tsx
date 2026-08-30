import { useMemo, useState } from 'react'
import { Box, Button as MuiButton } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { Link as RouterLink, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { RecordCard } from '../../components/RecordCard'
import type { RecordCardBadge } from '../../components/RecordCard'
import { ListToolbar } from '../../components/ListToolbar'
import { EmptyState } from '../../components/EmptyState'
import {
  listSponsorContacts,
  deactivateSponsorContact,
  reactivateSponsorContact,
} from '../../api/sponsorContactApi'
import type { SponsorContact } from '../../api/sponsorContactApi'

const SORT_OPTIONS = [
  { value: 'name,asc', label: 'Name' },
  { value: 'role,asc', label: 'Role' },
]

function fullName(contact: SponsorContact): string {
  return `${contact.contact.firstName} ${contact.contact.lastName}`
}

function badgeFor(contact: SponsorContact): RecordCardBadge | undefined {
  if (contact.isPrimary) {
    return { label: 'Primary', tone: 'positive' }
  }
  if (!contact.active) {
    return { label: 'Inactive', tone: 'muted' }
  }
  return undefined
}

// One RecordCard per contact, each with its own deactivate/reactivate mutation — mirrors
// ClubContactList.tsx's ClubContactCard pattern, so one card's pending state never leaks onto
// another's.
function SponsorContactCard({
  clubId,
  sponsorId,
  contact,
}: {
  clubId: string
  sponsorId: string
  contact: SponsorContact
}) {
  const queryClient = useQueryClient()

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['managed-club', clubId, 'sponsors', sponsorId, 'contacts'] })

  const deactivate = useMutation({
    mutationFn: () => deactivateSponsorContact(clubId, sponsorId, contact.id),
    onSuccess: invalidate,
  })

  const reactivate = useMutation({
    mutationFn: () => reactivateSponsorContact(clubId, sponsorId, contact.id),
    onSuccess: invalidate,
  })

  const toggle = contact.active ? deactivate : reactivate

  return (
    <RecordCard
      title={fullName(contact)}
      badge={badgeFor(contact)}
      fields={[
        { label: 'Role', value: contact.role },
        { label: 'Email', value: contact.contact.email },
        { label: 'Phone', value: contact.contact.phone },
      ]}
      editLabel="Edit"
      editTo={`/manage/sponsors/${sponsorId}/contacts/${contact.id}/edit`}
      secondaryAction={{
        label: contact.active ? 'Deactivate' : 'Reactivate',
        pendingLabel: contact.active ? 'Deactivating…' : 'Reactivating…',
        pending: toggle.isPending,
        onClick: () => toggle.mutate(),
      }}
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
  const [sort, setSort] = useState(SORT_OPTIONS[0].value)

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
      {/* GridNavShell (unlike AppShell's sidebar or BottomTabShell's tab bar) has no persistent
          nav, and this list — unlike SponsorContactFormPage's form — isn't wrapped in
          RecordFormScreen, so it has no back link of its own without this. Same visual pattern
          as RecordFormScreen's back button, and the same "own list needs its own back button"
          precedent ClubContactList.tsx established — except here it goes back to the owning
          sponsor, not the dashboard. */}
      <MuiButton
        component={RouterLink}
        to={`/manage/sponsors/${sponsorId}/edit`}
        variant="text"
        color="inherit"
        size="small"
        startIcon={<ArrowBackIcon fontSize="small" />}
        sx={{ alignSelf: 'flex-start', ml: -1, color: 'text.secondary' }}
      >
        Back to Sponsor
      </MuiButton>

      <ListToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by name"
        sortValue={sort}
        sortOptions={SORT_OPTIONS}
        onSortChange={setSort}
        createLabel="Add Contact"
        onCreate={() => navigate(`/manage/sponsors/${sponsorId}/contacts/new`)}
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
            <SponsorContactCard key={contact.id} clubId={clubId} sponsorId={sponsorId} contact={contact} />
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
