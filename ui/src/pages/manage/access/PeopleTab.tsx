import { useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Alert, Box, Skeleton, Snackbar, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { EmptyState } from '../../../components/EmptyState'
import { FilterBar } from '../../../components/FilterBar'
import { PageCounters } from '../../../components/PageCounters'
import { listSections } from '../../../api/sectionApi'
import { useAccessGrants, useAccessRoles, useRemoveAccessGrant, useResendAccessInvitation } from '../../../api/accessGrantsApi'
import type { AccessGrant } from '../../../api/accessGrantsApi'
import { cardGridSx } from '../../../utils/cardGrid'
import { AccessGrantCard } from './AccessGrantCard'
import { ChangeRoleDialog } from './ChangeRoleDialog'
import { canChangeRoles, fullName, placeLabel } from './accessGrantFormat'

type StatusFilter = 'ALL' | 'ACTIVE' | 'INVITED'

// docs/specs/150: Access, People. Figures, one flat filter bar, then the grants as cards. Everything shown is already shaped for
// this caller by the server (a section manager sees club-wide holders only as a count).
export default function PeopleTab() {
  const { clubId, notice } = useOutletContext<{ clubId?: string; notice?: (message: string, tone: 'success' | 'warning') => void }>()
  const grants = useAccessGrants(clubId)
  const roles = useAccessRoles(clubId)
  const sections = useQuery({ queryKey: ['managed-club', clubId, 'sections'], queryFn: () => listSections(clubId as string), enabled: Boolean(clubId) })
  const remove = useRemoveAccessGrant(clubId ?? '')
  const resend = useResendAccessInvitation(clubId ?? '')
  const [search, setSearch] = useState('')
  const [sectionId, setSectionId] = useState<string | null>(null)
  const [status, setStatus] = useState<StatusFilter>('ALL')
  const [removing, setRemoving] = useState<AccessGrant | null>(null)
  const [changing, setChanging] = useState<AccessGrant | null>(null)
  const [snack, setSnack] = useState<{ message: string; tone: 'success' | 'warning' | 'error' } | null>(null)

  const data = grants.data
  const items = useMemo(() => {
    const needle = search.trim().toLowerCase()
    const sectionIds = sectionId ? descendantIds(sections.data ?? [], sectionId) : null
    return (data?.items ?? []).filter((grant) => {
      if (status !== 'ALL' && grant.status !== status) return false
      if (sectionIds && !(grant.sectionId && sectionIds.has(grant.sectionId))) return false
      return !needle || fullName(grant).toLowerCase().includes(needle) || (grant.email ?? '').toLowerCase().includes(needle)
    })
  }, [data, search, sectionId, status, sections.data])

  if (!clubId) return <EmptyState title="Not authorized" description="No club is associated with your account." />

  const all = data?.items ?? []
  const counters = [
    { id: 'people', value: all.length, label: 'People', active: status === 'ALL', onSelect: () => setStatus('ALL') },
    { id: 'invited', value: all.filter((grant) => grant.status === 'INVITED').length, label: 'Invited', active: status === 'INVITED', onSelect: () => setStatus(status === 'INVITED' ? 'ALL' : 'INVITED') },
    { id: 'clubwide', value: all.filter((grant) => grant.scopeType === 'CLUB').length + (data?.clubWideCount ?? 0), label: 'Club-Wide' },
    { id: 'sections', value: new Set(all.map((grant) => grant.sectionId).filter(Boolean)).size, label: 'Sections Covered' },
  ]

  const tell = (message: string, tone: 'success' | 'warning' | 'error') => (notice && tone !== 'error' ? notice(message, tone) : setSnack({ message, tone }))

  return (
    <Box data-testid="people-tab" sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <PageCounters items={counters} loading={grants.isPending} />
      <FilterBar
        density="compact"
        sections={sections.data ?? []}
        sectionId={sectionId}
        onSectionChange={setSectionId}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search name or email"
        onClearAll={() => {
          setSearch('')
          setSectionId(null)
          setStatus('ALL')
        }}
      />

      {grants.isPending && (
        <Box aria-busy="true" sx={cardGridSx}>
          <Skeleton variant="rounded" height={140} />
          <Skeleton variant="rounded" height={140} />
        </Box>
      )}
      {grants.isError && <EmptyState title="Couldn't load access" description="Something went wrong loading who has access. Please try again." />}
      {data && all.length <= 1 && all.every((grant) => grant.self) && (
        <EmptyState title="You are the only person with access" description="Use Add Person to give access for the whole club or for one section." />
      )}
      {data && items.length === 0 && all.length > 1 && <EmptyState title="No one found" description="No one matches these filters." />}
      {items.length > 0 && (
        <Box sx={cardGridSx}>
          {items.map((grant) => (
            <AccessGrantCard
              key={grant.id}
              grant={grant}
              showChangeRole={canChangeRoles(roles.data)}
              onChangeRole={setChanging}
              onResend={(target) =>
                resend.mutate(target.id, {
                  onSuccess: () => tell('Invitation sent.', 'success'),
                  onError: () => tell('The invitation could not be sent. Please try again later.', 'error'),
                })
              }
              onRemove={setRemoving}
              resending={resend.isPending}
            />
          ))}
        </Box>
      )}
      {data && data.clubWideCount > 0 && (
        <Typography variant="body2" color="text.secondary">
          {data.clubWideCount === 1 ? '1 club-wide manager also has' : `${data.clubWideCount} club-wide managers also have`} access to everything here.
        </Typography>
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
