import { Stack, Typography } from '@mui/material'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { SponsorContactForm, SPONSOR_CONTACT_FORM_ID } from '../../components/SponsorContactForm'
import { RecordFormScreen } from '../../components/RecordFormScreen'
import { Button } from '../../components/Button'
import { EmptyState } from '../../components/EmptyState'
import {
  listSponsorContacts,
  createSponsorContact,
  updateSponsorContact,
} from '../../api/sponsorContactApi'
import type { SponsorContactPayload } from '../../api/sponsorContactApi'
import { errorDetail } from '../../utils/errorDetail'

// sponsorId comes from the route, clubId from ManagerHome's Outlet context (docs/specs/
// 020-club-manager-access.md) — same as ClubContactFormPage.tsx; the contact id is a route param,
// matching ClubContactFormPage's create/edit-via-:id? shape. There's no single-contact GET
// endpoint (only list/create/update/deactivate/reactivate, per docs/plans/
// 024-sponsor-contacts.md item 11) — edit mode fetches the full (small, unpaginated) list and
// finds the matching row client-side rather than adding a new backend endpoint.
export default function SponsorContactFormPage() {
  const { clubId } = useOutletContext<{ clubId?: string }>()
  const { sponsorId, contactId } = useParams<{ sponsorId: string; contactId?: string }>()
  const isEdit = Boolean(contactId)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const {
    data: contact,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['managed-club', clubId, 'sponsors', sponsorId, 'contacts'],
    queryFn: () => listSponsorContacts(clubId as string, sponsorId as string),
    enabled: Boolean(clubId) && Boolean(sponsorId) && isEdit,
    select: (contacts) => contacts.find((candidate) => candidate.id === contactId),
  })

  const saveMutation = useMutation({
    mutationFn: (payload: SponsorContactPayload) => {
      if (isEdit && contactId) {
        return updateSponsorContact(clubId as string, sponsorId as string, contactId, payload)
      }
      return createSponsorContact(clubId as string, sponsorId as string, payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['managed-club', clubId, 'sponsors', sponsorId, 'contacts'] })
      navigate(`/manage/sponsors/${sponsorId}/contacts`)
    },
  })

  if (!clubId) {
    return <EmptyState title="Not authorized" description="No club is associated with your account." />
  }

  if (!sponsorId) {
    return <EmptyState title="Not found" description="No sponsor was specified." />
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
      backTo={`/manage/sponsors/${sponsorId}/contacts`}
      backLabel="Back to Contacts"
      actions={
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
          {saveMutation.isError && (
            <Typography variant="body2" color="error.main">
              {errorDetail(saveMutation.error, 'Something went wrong saving this contact. Please try again.')}
            </Typography>
          )}

          <Button type="submit" form={SPONSOR_CONTACT_FORM_ID} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Create contact'}
          </Button>
        </Stack>
      }
    >
      <SponsorContactForm
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
