import { useState } from 'react'
import { Stack, Typography } from '@mui/material'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ClubForm, CLUB_FORM_ID } from '../../components/ClubForm'
import { RecordFormScreen } from '../../components/RecordFormScreen'
import { Button } from '../../components/Button'
import { EmptyState } from '../../components/EmptyState'
import {
  getClub,
  createClub,
  updateClub,
  suspendClub,
  reactivateClub,
  getClubProfile,
  updateClubProfile,
} from '../../api/clubApi'
import type { ClubPayload, ClubProfilePayload } from '../../api/clubApi'
import { errorDetail } from '../../utils/errorDetail'

export default function ClubFormPage() {
  const { id } = useParams<{ id?: string }>()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [confirmingTransition, setConfirmingTransition] = useState(false)

  const {
    data: club,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['club', id],
    queryFn: () => getClub(id as string),
    enabled: isEdit,
  })

  // Threaded into ClubForm's profileInitialValues (see docs/plans/012-club-profile.md item 7) —
  // its presence, not its content, is what gates the Contact/Address/Branding tabs and the
  // org-type field: even a brand-new Club's profile fetch resolves to a default-shaped,
  // all-null ClubProfile rather than 404 (see the backend's API Contract), so those tabs
  // unlock the moment the club itself exists.
  const {
    data: profile,
    isLoading: isProfileLoading,
    isError: isProfileError,
  } = useQuery({
    queryKey: ['club', id, 'profile'],
    queryFn: () => getClubProfile(id as string),
    enabled: isEdit,
  })

  // Sequenced two-mutation submit — matching docs/specs/011-inline-club-creation-in-subscription
  // -form.md's precedent of chaining independent mutations from one submit rather than requiring
  // a single combined backend endpoint. `profile` is only present once profileInitialValues has
  // been passed into ClubForm, i.e. never on a create-mode submit.
  const saveMutation = useMutation({
    mutationFn: async ({ club: clubPayload, profile: profilePayload }: {
      club?: ClubPayload
      profile?: ClubProfilePayload
    }) => {
      // ClubForm's onSubmit type is shared with its 'profileOnly' mode (docs/specs/020-club-
      // manager-access.md), where `club` is legitimately absent — but ClubFormPage only ever
      // renders ClubForm in the default 'full' mode, so `club` is always actually populated here.
      const club = clubPayload as ClubPayload
      const saved = isEdit && id ? await updateClub(id, club) : await createClub(club)
      if (profilePayload) {
        await updateClubProfile(saved.id, profilePayload)
      }
      return saved
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['clubs'] })
      queryClient.invalidateQueries({ queryKey: ['club', saved.id] })
      queryClient.invalidateQueries({ queryKey: ['club', saved.id, 'profile'] })
      // Create-mode drops the admin onto the edit route instead of the list — profile
      // completion continues there rather than requiring a second navigation back in
      // (a deliberate change from 010's original create→list redirect, see
      // docs/specs/012-club-profile.md's UI Requirements).
      navigate(isEdit ? '/admin/onboarding' : `/admin/onboarding/${saved.id}/edit`)
    },
  })

  // Single status-transition action — Suspend for an ACTIVE club, Reactivate for a SUSPENDED
  // one. ONBOARDING never renders a transition button (unreachable via this UI, see
  // docs/plans/010-minimal-club-creation.md item 4).
  const transitionMutation = useMutation({
    mutationFn: () => {
      if (club?.status === 'ACTIVE') {
        return suspendClub(id as string)
      }
      return reactivateClub(id as string)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clubs'] })
      navigate('/admin/onboarding')
    },
  })

  if (isEdit && (isLoading || isProfileLoading)) {
    return null
  }

  if (isEdit && (isError || isProfileError)) {
    return (
      <EmptyState
        title="Couldn't load this club"
        description="Something went wrong loading this club. Please try again."
      />
    )
  }

  if (isEdit && (!club || !profile)) {
    return null
  }

  const submitLabel = isEdit ? 'Save changes' : 'Create club'
  const transitionLabel = club?.status === 'ACTIVE' ? 'Suspend' : 'Reactivate'
  const transitionPendingLabel = club?.status === 'ACTIVE' ? 'Suspending…' : 'Reactivating…'
  const transitionVerb = club?.status === 'ACTIVE' ? 'suspend' : 'reactivate'

  return (
    <RecordFormScreen
      title={isEdit ? 'Edit Club' : 'Add Club'}
      backTo="/admin/onboarding"
      backLabel="Back to Clubs"
      actions={
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
          {saveMutation.isError && (
            <Typography variant="body2" color="error.main">
              {errorDetail(saveMutation.error, 'Something went wrong saving this club. Please try again.')}
            </Typography>
          )}

          <Button type="submit" form={CLUB_FORM_ID} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'Saving…' : submitLabel}
          </Button>
          <Button
            variant="ghost"
            disabled={saveMutation.isPending}
            onClick={() => navigate('/admin/onboarding')}
          >
            Cancel
          </Button>

          {isEdit && club && (club.status === 'ACTIVE' || club.status === 'SUSPENDED') && (
            <>
              {confirmingTransition ? (
                <>
                  <Typography variant="body2">
                    {transitionVerb === 'suspend' ? 'Suspend this club?' : 'Reactivate this club?'}
                  </Typography>
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={transitionMutation.isPending}
                    onClick={() => transitionMutation.mutate()}
                  >
                    {transitionMutation.isPending ? transitionPendingLabel : `Confirm ${transitionVerb}`}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirmingTransition(false)}>
                    {transitionVerb === 'suspend' ? "Don't suspend" : "Don't reactivate"}
                  </Button>
                </>
              ) : (
                <Button variant="danger" size="sm" onClick={() => setConfirmingTransition(true)}>
                  {transitionLabel}
                </Button>
              )}
            </>
          )}

          {transitionMutation.isError && (
            <Typography variant="body2" color="error.main">
              {errorDetail(
                transitionMutation.error,
                `Something went wrong trying to ${transitionVerb} this club. Please try again.`,
              )}
            </Typography>
          )}
        </Stack>
      }
    >
      <ClubForm
        initialValues={
          club
            ? {
                name: club.name,
                slug: club.slug,
              }
            : undefined
        }
        profileInitialValues={
          profile
            ? {
                type: profile.type,
                logoUrl: profile.logoUrl,
                bannerUrl: profile.bannerUrl,
                address: profile.address,
                email: profile.email,
                phone: profile.phone,
                website: profile.website,
                socialLinks: profile.socialLinks,
              }
            : undefined
        }
        onSubmit={(values) => saveMutation.mutate(values)}
      />
    </RecordFormScreen>
  )
}
