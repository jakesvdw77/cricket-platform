import { useMemo, useState } from 'react'
import { useOutletContext, useSearchParams } from 'react-router-dom'
import { Alert, Box, Snackbar, useMediaQuery } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { AddCard } from '../../../components/AddCard'
import { BrandIcon } from '../../../components/BrandIcon'
import { CompactSwitch } from '../../../components/CompactSwitch'
import { SortMenu } from '../../../components/ContentControlsLine'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { EmptyState, EmptyStateLink } from '../../../components/EmptyState'
import { FilterBar } from '../../../components/FilterBar'
import { ListViewToggle } from '../../../components/ListViewToggle'
import { PageCounters } from '../../../components/PageCounters'
import type { PageCounterItem } from '../../../components/PageCounters'
import { ToolbarCard, ToolbarSortButton, ToolbarToggleChip } from '../../../components/ToolbarCard'
import { listSections } from '../../../api/sectionApi'
import { useAccessGrants, useAccessRoles, useRemoveAccessGrant, useResendAccessInvitation } from '../../../api/accessGrantsApi'
import type { AccessGrant } from '../../../api/accessGrantsApi'
import { usePersistedListFilters } from '../../../hooks/usePersistedListFilters'
import { useListViewPreference } from '../../../hooks/useListViewPreference'
import { dynamicCardGridSx } from '../../../utils/cardGrid'
import { AccessGrantCard } from './AccessGrantCard'
import { AccessGrantTable } from './AccessGrantTable'
import { ChangeRoleDialog } from './ChangeRoleDialog'
import { canChangeRoles, fullName, placeLabel } from './accessGrantFormat'

type AccessSort = 'name-asc' | 'name-desc'
const SORT_OPTIONS: { value: AccessSort; label: string; linkLabel: string }[] = [
  { value: 'name-asc', label: 'Name, A to Z', linkLabel: 'A to Z' },
  { value: 'name-desc', label: 'Name, Z to A', linkLabel: 'Z to A' },
]

// docs/specs/150 and page-anatomy: title row (AccessPage), figures, ONE flat toolbar fused with the data, then cards or a list.
// Everything is already shaped for this caller by the server (a section manager sees club-wide holders only as a count, which
// is the info line of the Club-Wide figure, not a sentence of its own). The sort and the Invited filter live in the address so
// Back restores them; the section is saved per club; the search is never persisted.
export default function PeopleTab() {
  const { clubId, notice, openAddPerson } = useOutletContext<{
    clubId?: string
    notice?: (message: string, tone: 'success' | 'warning') => void
    openAddPerson?: () => void
  }>()
  const grants = useAccessGrants(clubId)
  const roles = useAccessRoles(clubId)
  const sections = useQuery({ queryKey: ['managed-club', clubId, 'sections'], queryFn: () => listSections(clubId as string), enabled: Boolean(clubId), placeholderData: keepPreviousData })
  const remove = useRemoveAccessGrant(clubId ?? '')
  const resend = useResendAccessInvitation(clubId ?? '')
  const phone = useMediaQuery(useTheme().breakpoints.down('sm'), { noSsr: true })
  const [view, setView] = useListViewPreference('accessPeople:view')
  const [search, setSearch] = useState('')
  const [params, setParams] = useSearchParams()
  const setParam = (key: string, value: string | null) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        if (value) next.set(key, value)
        else next.delete(key)
        return next
      },
      { replace: true },
    )
  const sort = (SORT_OPTIONS.find((option) => option.value === params.get('sort'))?.value ?? 'name-asc') as AccessSort
  const setSort = (next: string) => setParam('sort', next === 'name-asc' ? null : next)
  const invitedOnly = params.get('invited') === '1'
  const setInvitedOnly = (next: boolean) => setParam('invited', next ? '1' : null)
  const [{ sectionId }, setFilters] = usePersistedListFilters(`accessPeople:filters:${clubId}`, { sectionId: null as string | null })
  const [removing, setRemoving] = useState<AccessGrant | null>(null)
  const [changing, setChanging] = useState<AccessGrant | null>(null)
  const [snack, setSnack] = useState<{ message: string; tone: 'success' | 'warning' | 'error' } | null>(null)

  const data = grants.data
  const all = data?.items ?? []
  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase()
    const sectionIds = sectionId ? descendantIds(sections.data ?? [], sectionId) : null
    const filtered = all.filter((grant) => {
      if (invitedOnly && grant.status !== 'INVITED') return false
      if (sectionIds && !(grant.sectionId && sectionIds.has(grant.sectionId))) return false
      return !needle || fullName(grant).toLowerCase().includes(needle) || (grant.email ?? '').toLowerCase().includes(needle)
    })
    const byName = (a: AccessGrant, b: AccessGrant) => fullName(a).localeCompare(fullName(b))
    return [...filtered].sort(sort === 'name-desc' ? (a, b) => byName(b, a) : byName)
  }, [all, search, sectionId, invitedOnly, sort, sections.data])

  if (!clubId) return <EmptyState title="Not authorized" description="No club is associated with your account." />
  if (grants.isPending) return null
  if (grants.isError || !data) {
    return <EmptyState title="Couldn't load access" description="Something went wrong loading who has access. Please try again." />
  }

  const tell = (message: string, tone: 'success' | 'warning' | 'error') => (notice && tone !== 'error' ? notice(message, tone) : setSnack({ message, tone }))
  const clubWideTotal = all.filter((grant) => grant.scopeType === 'CLUB').length + data.clubWideCount
  const counters: PageCounterItem[] = [
    { id: 'people', value: all.length, label: 'People', kind: 'filter', active: !invitedOnly, hint: 'Show All', onSelect: () => setInvitedOnly(false) },
    {
      id: 'invited',
      value: all.filter((grant) => grant.status === 'INVITED').length,
      label: 'Invited',
      kind: 'filter',
      active: invitedOnly,
      hint: 'Tap to filter',
      onSelect: () => setInvitedOnly(!invitedOnly),
    },
    {
      id: 'clubwide',
      value: clubWideTotal,
      label: 'Club-Wide',
      ...(data.clubWideCount > 0 ? { info: 'Club-wide managers also have access to everything here. Their names are not shown.' } : {}),
    },
    { id: 'sections', value: new Set(all.map((grant) => grant.sectionId).filter(Boolean)).size, label: 'Sections Covered' },
  ]

  const menu = {
    showChangeRole: canChangeRoles(roles.data),
    onChangeRole: setChanging,
    onResend: (target: AccessGrant) =>
      resend.mutate(target.id, {
        onSuccess: () => tell('Invitation sent.', 'success'),
        onError: () => tell('The invitation could not be sent. Please try again later.', 'error'),
      }),
    onRemove: setRemoving,
  }
  const clearFilters = () => {
    setSearch('')
    setFilters({ sectionId: null })
    setInvitedOnly(false)
  }
  const isFiltering = Boolean(search.trim() || sectionId || invitedOnly)
  const canAdd = data.canManage && Boolean(openAddPerson)

  // page-anatomy section 3: Section, search, the Invited chip, Sort, then Cards | List last. A phone: Filters and search on the
  // row; the toggle, the switch and Sort in the sheet.
  const bar = (
    <FilterBar
      bare
      inCard
      viewControlsInline
      density="compact"
      sections={sections.data ?? []}
      sectionId={sectionId}
      onSectionChange={(value) => setFilters({ sectionId: value })}
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search by name or email"
      secondaryControls={(placement) =>
        placement === 'row' ? (
          <ToolbarToggleChip pressed={invitedOnly} onChange={setInvitedOnly} label="Invited Only" />
        ) : (
          <CompactSwitch checked={invitedOnly} onChange={setInvitedOnly} label="Invited Only" />
        )
      }
      viewControls={
        phone ? (
          <>
            <Box sx={{ width: '100%' }}>
              <ListViewToggle value={view} onChange={setView} fullWidth />
            </Box>
            <SortMenu value={sort} options={SORT_OPTIONS} onChange={setSort} />
          </>
        ) : (
          <>
            <ToolbarSortButton value={sort} onChange={setSort} options={SORT_OPTIONS.map(({ value, label }) => ({ value, label }))} />
            <ListViewToggle value={view} onChange={setView} variant="toolbar" />
          </>
        )
      }
      onClearAll={clearFilters}
    />
  )

  const icon = <BrandIcon name="nav/roles-permissions" size={48} padding={4} />
  const emptyState =
    visible.length > 0 ? null : isFiltering ? (
      <EmptyState
        icon={icon}
        title="No matching people"
        description="No one matches these filters."
        action={<EmptyStateLink onClick={clearFilters}>Clear Filters</EmptyStateLink>}
      />
    ) : (
      <EmptyState
        icon={icon}
        title="No one has access yet"
        description="Give someone access to the whole club or to one section."
        action={canAdd ? <EmptyStateLink onClick={openAddPerson}>Add New Person</EmptyStateLink> : undefined}
      />
    )
  const fused = view === 'list'

  return (
    <Box data-testid="people-tab" sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 1.5, md: 2 } }}>
      <PageCounters density="compact" items={counters} />

      {!fused && <ToolbarCard>{bar}</ToolbarCard>}
      {fused && <AccessGrantTable grants={visible} toolbar={bar} empty={emptyState} {...menu} />}
      {!fused && emptyState}
      {!fused && visible.length > 0 && (
        <Box sx={dynamicCardGridSx}>
          {visible.map((grant) => (
            <AccessGrantCard key={grant.id} grant={grant} {...menu} />
          ))}
          {/* The grid ends with a dashed Add card (same action as the title-row button); with no cards it is not shown. */}
          {canAdd && <AddCard label="Add New Person" onClick={openAddPerson} testId="add-person-card" />}
        </Box>
      )}

      <ConfirmDialog
        open={Boolean(removing)}
        title="Remove Access"
        destructive
        confirmLabel="Remove Access"
        pendingLabel="Removing…"
        pending={remove.isPending}
        description={
          removing
            ? `Remove ${fullName(removing)} as ${removing.roleName} for ${placeLabel(removing)}? They keep their account and any other access, and lose this access the next time they open the app.`
            : ''
        }
        onClose={() => setRemoving(null)}
        onConfirm={() =>
          removing &&
          remove.mutate(removing.id, {
            onSuccess: () => {
              setRemoving(null)
              tell('Access removed.', 'success')
            },
            onError: () => {
              setRemoving(null)
              tell('We could not remove this access. Please try again.', 'error')
            },
          })
        }
      />
      <ChangeRoleDialog
        clubId={clubId}
        grant={changing}
        list={data}
        roles={roles.data}
        onClose={() => setChanging(null)}
        onChanged={() => {
          setChanging(null)
          tell('Role changed.', 'success')
        }}
      />
      <Snackbar open={Boolean(snack)} autoHideDuration={6000} onClose={() => setSnack(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snack?.tone ?? 'success'} onClose={() => setSnack(null)}>
          {snack?.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}

function descendantIds(sections: { id: string; parentSectionId: string | null }[], rootId: string): Set<string> {
  const result = new Set<string>([rootId])
  let grew = true
  while (grew) {
    grew = false
    for (const section of sections) {
      if (section.parentSectionId && result.has(section.parentSectionId) && !result.has(section.id)) {
        result.add(section.id)
        grew = true
      }
    }
  }
  return result
}
