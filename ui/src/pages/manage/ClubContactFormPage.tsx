import { Stack, Typography } from '@mui/material'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ClubContactForm, CLUB_CONTACT_FORM_ID } from '../../components/ClubContactForm'
import { RecordFormScreen } from '../../components/RecordFormScreen'
import { Button } from '../../components/Button'
import { EmptyState } from '../../components/EmptyState'
import {
  listClubContacts,
  createClubContact,
  updateClubContact,
} from '../../api/clubContactApi'
import type { ClubContactPayload } from '../../api/clubContactApi'
import { errorDetail } from '../../utils/errorDetail'

// clubId comes from ManagerHome's Outlet context (docs/specs/020-club-manager-access.md), same
// as ManageClubProfilePage.tsx; the contact id is a route param, matching ProductFormPage's
// create/edit-via-:id? shape. There's no single-contact GET endpoint (only list/create/update/
// deactivate/reactivate, per docs/plans/021-club-contacts.md item 11) — edit mode fetches the
// full (small, unpaginated) list and finds the matching row client-side rather than adding a new
// backend endpoint.
export default function ClubContactFormPage() {
  const { clubId } = useOutletContext<{ clubId?: string }>()
  const { id } = useParams<{ id?: string }>()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const {
    data: contact,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['managed-club', clubId, 'contacts'],
    queryFn: () => listClubContacts(clubId as string),
    enabled: Boolean(clubId) && isEdit,
    select: (contacts) => contacts.find((candidate) => candidate.id === id),
  })

  const saveMutation = useMutation({
    mutationFn: (payload: ClubContactPayload) => {
      if (isEdit && id) {
        return updateClubContact(clubId as string, id, payload)
      }
      return createClubContact(clubId as string, payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['managed-club', clubId, 'contacts'] })
      navigate('/manage/club-contacts')
    },
  })

  if (!clubId) {
    return <EmptyState title="Not authorized" description="No club is associated with your account." />
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
      backTo="/manage/club-contacts"
      backLabel="Back to Contacts"
      actions={
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
          {saveMutation.isError && (
            <Typography variant="body2" color="error.main">
              {errorDetail(saveMutation.error, 'Something went wrong saving this contact. Please try again.')}
            </Typography>
          )}

          <Button type="submit" form={CLUB_CONTACT_FORM_ID} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Create contact'}
          </Button>
        </Stack>
      }
    >
      <ClubContactForm
        initialValues={
          contact
            ? {
                contact: contact.contact,
                role: contact.role,
                isPrimary: contact.isPrimary,
                photoUrl: contact.photoUrl,
              }
            : undefined
        }
        onSubmit={(payload) => saveMutation.mutate(payload)}
      />
    </RecordFormScreen>
  )
}
