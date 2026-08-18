import { useState } from 'react'
import { Stack, Typography } from '@mui/material'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { ClubForm, CLUB_FORM_ID } from '../../components/ClubForm'
import { RecordFormScreen } from '../../components/RecordFormScreen'
import { Button } from '../../components/Button'
import { EmptyState } from '../../components/EmptyState'
import { getClub, createClub, updateClub, suspendClub, reactivateClub } from '../../api/clubApi'
import type { ClubPayload } from '../../api/clubApi'

// The backend's GlobalExceptionHandler returns RFC 7807 ProblemDetail bodies — { detail: "..." }
// carries the specific reason (e.g. a reserved slug, a duplicate slug). Falls back to a generic
// message when the response isn't shaped that way — same pattern SubscriptionFormPage already
// established.
function errorDetail(error: unknown, fallback: string): string {
  if (isAxiosError(error) && typeof error.response?.data?.detail === 'string') {
    return error.response.data.detail
  }
  return fallback
}

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

  const saveMutation = useMutation({
    mutationFn: (payload: ClubPayload) => {
      if (isEdit && id) {
        return updateClub(id, payload)
      }

      return createClub(payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clubs'] })
      navigate('/admin/onboarding')
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

  if (isEdit && isLoading) {
    return null
  }

  if (isEdit && isError) {
    return (
      <EmptyState
        title="Couldn't load this club"
        description="Something went wrong loading this club. Please try again."
      />
    )
  }

  if (isEdit && !club) {
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
        onSubmit={(values) => saveMutation.mutate(values)}
      />
    </RecordFormScreen>
  )
}
