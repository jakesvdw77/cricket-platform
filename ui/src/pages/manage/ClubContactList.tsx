import { useMemo, useState } from 'react'
import { Box, Button as MuiButton } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { Link as RouterLink, useNavigate, useOutletContext } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { RecordCard } from '../../components/RecordCard'
import type { RecordCardBadge } from '../../components/RecordCard'
import { ListToolbar } from '../../components/ListToolbar'
import { EmptyState } from '../../components/EmptyState'
import {
  listClubContacts,
  deactivateClubContact,
  reactivateClubContact,
} from '../../api/clubContactApi'
import type { ClubContact } from '../../api/clubContactApi'

const SORT_OPTIONS = [
  { value: 'name,asc', label: 'Name' },
  { value: 'role,asc', label: 'Role' },
]

function fullName(contact: ClubContact): string {
  return `${contact.contact.firstName} ${contact.contact.lastName}`
}

function badgeFor(contact: ClubContact): RecordCardBadge | undefined {
  if (contact.isPrimary) {
    return { label: 'Primary', tone: 'positive' }
  }
  if (!contact.active) {
    return { label: 'Inactive', tone: 'muted' }
  }
  return undefined
}

// One RecordCard per contact, each with its own deactivate/reactivate mutation — mirrors
// SubscriptionList.tsx's SubscriptionCard pattern, so one card's pending state never leaks onto
// another's.
function ClubContactCard({ clubId, contact }: { clubId: string; contact: ClubContact }) {
  const queryClient = useQueryClient()

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['managed-club', clubId, 'contacts'] })

  const deactivate = useMutation({
    mutationFn: () => deactivateClubContact(clubId, contact.id),
    onSuccess: invalidate,
  })

  const reactivate = useMutation({
    mutationFn: () => reactivateClubContact(clubId, contact.id),
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
      editTo={`/manage/club-contacts/${contact.id}/edit`}
      secondaryAction={{
        label: contact.active ? 'Deactivate' : 'Reactivate',
        pendingLabel: contact.active ? 'Deactivating…' : 'Reactivating…',
        pending: toggle.isPending,
        onClick: () => toggle.mutate(),
      }}
    />
  )
}

// Reads clubId from ManagerHome's Outlet context (docs/specs/020-club-manager-access.md), same
// guard pattern as ManageClubProfilePage.tsx. Deliberately no pagination state — a club's
// contacts are a small, bounded list (docs/specs/021-club-contacts.md's Context), fetched in
// full and filtered/sorted client-side, unlike ProductList's backend-driven pagination.
export default function ClubContactList() {
  const { clubId } = useOutletContext<{ clubId?: string }>()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState(SORT_OPTIONS[0].value)

  const {
    data: contacts,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['managed-club', clubId, 'contacts'],
    queryFn: () => listClubContacts(clubId as string),
    enabled: Boolean(clubId),
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

  if (isLoading) {
    return null
  }

  if (isError || !contacts) {
    return (
      <EmptyState
        title="Couldn't load contacts"
        description="Something went wrong loading your club's contacts. Please try again."
      />
    )
  }

  const hasContacts = contacts.length > 0
  const isSearching = search.trim().length > 0

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* GridNavShell (unlike AppShell's sidebar or BottomTabShell's tab bar) has no persistent
          nav, and this list — unlike ManageClubProfilePage's form — isn't wrapped in
          RecordFormScreen, so it has no back link of its own without this. Same visual pattern
          as RecordFormScreen's back button; worth extracting to a shared component if a third
          bare /manage list screen ends up needing it too. */}
      <MuiButton
        component={RouterLink}
        to="/manage"
        variant="text"
        color="inherit"
        size="small"
        startIcon={<ArrowBackIcon fontSize="small" />}
        sx={{ alignSelf: 'flex-start', ml: -1, color: 'text.secondary' }}
      >
        Back to Dashboard
      </MuiButton>

      <ListToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by name"
        sortValue={sort}
        sortOptions={SORT_OPTIONS}
        onSortChange={setSort}
        createLabel="Add Contact"
        onCreate={() => navigate('/manage/club-contacts/new')}
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
            <ClubContactCard key={contact.id} clubId={clubId} contact={contact} />
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
        <EmptyState title="No contacts yet" description="Add your club's first contact to get started." />
      )}
    </Box>
  )
}
