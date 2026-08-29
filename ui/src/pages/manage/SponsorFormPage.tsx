import { Stack, Typography } from '@mui/material'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { SponsorForm, SPONSOR_FORM_ID } from '../../components/SponsorForm'
import { RecordFormScreen } from '../../components/RecordFormScreen'
import { Button } from '../../components/Button'
import { EmptyState } from '../../components/EmptyState'
import { listSponsors, createSponsor, updateSponsor } from '../../api/sponsorApi'
import type { SponsorPayload } from '../../api/sponsorApi'
import { errorDetail } from '../../utils/errorDetail'

// clubId comes from ManagerHome's Outlet context (docs/specs/020-club-manager-access.md), same
// as ClubContactFormPage.tsx; the sponsor id is a route param, matching ProductFormPage's
// create/edit-via-:id? shape. There's no single-sponsor GET endpoint (only list/create/update/
// deactivate/reactivate, per docs/plans/023-sponsors.md) — edit mode fetches the full (small,
// unpaginated) list and finds the matching row client-side rather than adding a new backend
// endpoint.
export default function SponsorFormPage() {
  const { clubId } = useOutletContext<{ clubId?: string }>()
  const { id } = useParams<{ id?: string }>()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const {
    data: sponsor,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['managed-club', clubId, 'sponsors'],
    queryFn: () => listSponsors(clubId as string),
    enabled: Boolean(clubId) && isEdit,
    select: (sponsors) => sponsors.find((candidate) => candidate.id === id),
  })

  const saveMutation = useMutation({
    mutationFn: (payload: SponsorPayload) => {
      if (isEdit && id) {
        return updateSponsor(clubId as string, id, payload)
      }
      return createSponsor(clubId as string, payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['managed-club', clubId, 'sponsors'] })
      navigate('/manage/sponsors')
    },
  })

  if (!clubId) {
    return <EmptyState title="Not authorized" description="No club is associated with your account." />
  }

  if (isEdit && isLoading) {
    return null
  }

  if (isEdit && (isError || !sponsor)) {
    return (
      <EmptyState
        title="Couldn't load this sponsor"
        description="Something went wrong loading this sponsor. Please try again."
      />
    )
  }

  return (
    <RecordFormScreen
      title={isEdit ? 'Edit Sponsor' : 'Add Sponsor'}
      backTo="/manage/sponsors"
      backLabel="Back to Sponsors"
      actions={
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
          {saveMutation.isError && (
            <Typography variant="body2" color="error.main">
              {errorDetail(saveMutation.error, 'Something went wrong saving this sponsor. Please try again.')}
            </Typography>
          )}

          <Button type="submit" form={SPONSOR_FORM_ID} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Create sponsor'}
          </Button>
        </Stack>
      }
    >
      <SponsorForm
        initialValues={
          sponsor
            ? {
                name: sponsor.name,
                website: sponsor.website,
                email: sponsor.email,
                phone: sponsor.phone,
                logoUrl: sponsor.logoUrl,
                bannerUrl: sponsor.bannerUrl,
                socialLinks: sponsor.socialLinks,
              }
            : undefined
        }
        onSubmit={(payload) => saveMutation.mutate(payload)}
      />
    </RecordFormScreen>
  )
}
