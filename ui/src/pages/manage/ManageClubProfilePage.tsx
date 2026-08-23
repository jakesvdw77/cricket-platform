import { Stack, Typography } from '@mui/material'
import { useOutletContext } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ClubForm, CLUB_FORM_ID } from '../../components/ClubForm'
import { RecordFormScreen } from '../../components/RecordFormScreen'
import { Button } from '../../components/Button'
import { EmptyState } from '../../components/EmptyState'
import { getManagedClubProfile, updateManagedClubProfile } from '../../api/clubApi'
import type { ClubProfilePayload } from '../../api/clubApi'
import { errorDetail } from '../../utils/errorDetail'

// A club admin's self-service view of their own club's profile (docs/specs/020-club-manager-
// access.md), reusing ClubForm's 'profileOnly' mode — no name/slug, no lifecycle actions
// (Suspend/Reactivate/Cancel), those aren't club-admin actions. Mirrors ClubFormPage.tsx's
// loading/error/loaded shape, simplified to a single query/mutation pair.
export default function ManageClubProfilePage() {
  const { clubId } = useOutletContext<{ clubId?: string }>()
  const queryClient = useQueryClient()

  // Hooks are called unconditionally (Rules of Hooks) — the `!clubId` edge case (a platform_admin
  // with zero CLUB_ADMIN grants navigating directly to /manage, which ManagerHome doesn't block)
  // is instead handled by disabling the query below and returning "Not authorized" after.
  const {
    data: profile,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['managed-club', clubId, 'profile'],
    queryFn: () => getManagedClubProfile(clubId as string),
    enabled: Boolean(clubId),
  })

  const saveMutation = useMutation({
    mutationFn: (payload: ClubProfilePayload) => updateManagedClubProfile(clubId as string, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['managed-club', clubId, 'profile'] })
    },
  })

  if (!clubId) {
    return <EmptyState title="Not authorized" description="No club is associated with your account." />
  }

  if (isLoading) {
    return null
  }

  if (isError) {
    return (
      <EmptyState
        title="Couldn't load your club"
        description="Something went wrong loading your club's profile. Please try again."
      />
    )
  }

  if (!profile) {
    return null
  }

  return (
    <RecordFormScreen
      title="Club Profile"
      backTo="/manage"
      backLabel="Back to Dashboard"
      actions={
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
          {saveMutation.isError && (
            <Typography variant="body2" color="error.main">
              {errorDetail(saveMutation.error, "Something went wrong saving your club's profile. Please try again.")}
            </Typography>
          )}

          <Button type="submit" form={CLUB_FORM_ID} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'Saving…' : 'Save changes'}
          </Button>
        </Stack>
      }
    >
      <ClubForm
        mode="profileOnly"
        profileInitialValues={{
          type: profile.type,
          logoUrl: profile.logoUrl,
          bannerUrl: profile.bannerUrl,
          address: profile.address,
          email: profile.email,
          phone: profile.phone,
          website: profile.website,
          socialLinks: profile.socialLinks,
        }}
        onSubmit={(values) => values.profile && saveMutation.mutate(values.profile)}
      />
    </RecordFormScreen>
  )
}
