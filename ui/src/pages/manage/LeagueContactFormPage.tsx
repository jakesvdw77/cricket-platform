import { Stack, Typography } from '@mui/material'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { LeagueContactForm, LEAGUE_CONTACT_FORM_ID } from '../../components/LeagueContactForm'
import { RecordFormScreen } from '../../components/RecordFormScreen'
import { Button } from '../../components/Button'
import { RecordStatusToggle } from '../../components/RecordStatusToggle'
import { EmptyState } from '../../components/EmptyState'
import {
  listLeagueContacts,
  createLeagueContact,
  updateLeagueContact,
  deactivateLeagueContact,
  reactivateLeagueContact,
} from '../../api/leagueContactApi'
import type { LeagueContactPayload } from '../../api/leagueContactApi'
import { errorDetail } from '../../utils/errorDetail'

// leagueId comes from the route, clubId from ManagerHome's Outlet context (docs/specs/
// 020-club-manager-access.md) — same as SponsorContactFormPage.tsx; the contact id is a route
// param, matching SponsorContactFormPage's create/edit-via-:contactId? shape. There's no
// single-contact GET endpoint (only list/create/update/deactivate/reactivate, per docs/plans/
// 054-league-contacts.md item 4) — edit mode fetches the full (small, unpaginated) list and finds
// the matching row client-side rather than adding a new backend endpoint. Back link goes to this
// league's edit screen (Details tab — LeagueFormPage's activeTab state isn't deep-linkable today,
// matching its own existing tabs' identical behaviour).
export default function LeagueContactFormPage() {
  const { clubId } = useOutletContext<{ clubId?: string }>()
  const { leagueId, contactId } = useParams<{ leagueId: string; contactId?: string }>()
  const isEdit = Boolean(contactId)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const {
    data: contact,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['managed-club', clubId, 'leagues', leagueId, 'contacts'],
    queryFn: () => listLeagueContacts(clubId as string, leagueId as string),
    enabled: Boolean(clubId) && Boolean(leagueId) && isEdit,
    select: (contacts) => contacts.find((candidate) => candidate.id === contactId),
  })

  const saveMutation = useMutation({
    mutationFn: (payload: LeagueContactPayload) => {
      if (isEdit && contactId) {
        return updateLeagueContact(clubId as string, leagueId as string, contactId, payload)
      }
      return createLeagueContact(clubId as string, leagueId as string, payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['managed-club', clubId, 'leagues', leagueId, 'contacts'] })
      navigate(`/manage/fixtures/leagues/${leagueId}/edit`)
    },
  })

  // docs/specs/038-move-deactivate-to-edit-screen.md pattern: deactivate/reactivate render on this
  // screen's own actions bar, same mutation fn/onSuccess invalidation shape as
  // SponsorContactFormPage.tsx.
  const invalidateContacts = () =>
    queryClient.invalidateQueries({ queryKey: ['managed-club', clubId, 'leagues', leagueId, 'contacts'] })

  const deactivate = useMutation({
    mutationFn: () => deactivateLeagueContact(clubId as string, leagueId as string, contactId as string),
    onSuccess: invalidateContacts,
  })

  const reactivate = useMutation({
    mutationFn: () => reactivateLeagueContact(clubId as string, leagueId as string, contactId as string),
    onSuccess: invalidateContacts,
  })

  const toggle = contact?.active ? deactivate : reactivate

  if (!clubId) {
    return <EmptyState title="Not authorized" description="No club is associated with your account." />
  }

  if (!leagueId) {
    return <EmptyState title="Not found" description="No league was specified." />
  }

  if (isEdit && isLoading) {
    return null
  }

  if (isEdit && (isError || !contact)) {
    return (
      <EmptyState
        title="Couldn't load this contact"
        description="Something went wrong loading this contact. Please try again."
      />
    )
  }

  return (
    <RecordFormScreen
      title={isEdit ? 'Edit Contact' : 'Add Contact'}
      backTo={`/manage/fixtures/leagues/${leagueId}/edit`}
      backLabel="Back to League"
      actions={
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
          {saveMutation.isError && (
            <Typography variant="body2" color="error.main">
              {errorDetail(saveMutation.error, 'Something went wrong saving this contact. Please try again.')}
            </Typography>
          )}

          <Button type="submit" form={LEAGUE_CONTACT_FORM_ID} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Create contact'}
          </Button>

          {isEdit && contact && (
            <RecordStatusToggle active={contact.active} pending={toggle.isPending} onClick={() => toggle.mutate()} />
          )}
        </Stack>
      }
    >
      <LeagueContactForm
        initialValues={
          contact
            ? {
                contact: contact.contact,
                role: contact.role,
                isPrimary: contact.isPrimary,
              }
            : undefined
        }
        onSubmit={(payload) => saveMutation.mutate(payload)}
      />
    </RecordFormScreen>
  )
}
