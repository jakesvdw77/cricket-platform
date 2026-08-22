import { useState } from 'react'
import { Stack, Typography } from '@mui/material'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { SubscriptionForm, SUBSCRIPTION_FORM_ID } from '../../components/SubscriptionForm'
import type { SubscriptionFormValues } from '../../components/SubscriptionForm'
import { RecordFormScreen } from '../../components/RecordFormScreen'
import { Button } from '../../components/Button'
import { EmptyState } from '../../components/EmptyState'
import { getSubscription, createSubscription, updateSubscription, cancelSubscription } from '../../api/subscriptionApi'
import type { ResponsiblePersonInput } from '../../api/personApi'
import { createClub } from '../../api/clubApi'

// The backend's GlobalExceptionHandler returns RFC 7807 ProblemDetail bodies — { detail: "..." }
// carries the specific reason (e.g. "Club already has an active subscription", "Product is not
// active"). Falls back to a generic message when the response isn't shaped that way (a network
// error, a non-JSON 5xx, etc.) — first use of this pattern in the frontend, so kept local rather
// than a new shared utility for a single consumer.
function errorDetail(error: unknown, fallback: string): string {
  if (isAxiosError(error) && typeof error.response?.data?.detail === 'string') {
    return error.response.data.detail
  }
  return fallback
}

// Distinguishes a POST /clubs rejection (routed to ClubPicker's Slug field) from a
// POST /subscriptions rejection (the existing generic banner below) — see
// docs/plans/011-inline-club-creation-in-subscription-form.md item 5.
class ClubCreationError extends Error {}

export default function SubscriptionFormPage() {
  const { id } = useParams<{ id?: string }>()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [confirmingCancel, setConfirmingCancel] = useState(false)

  const {
    data: subscription,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['subscription', id],
    queryFn: () => getSubscription(id as string),
    enabled: isEdit,
  })

  const saveMutation = useMutation({
    mutationFn: async (values: SubscriptionFormValues) => {
      if (isEdit && id) {
        return updateSubscription(id, {
          productId: values.productId,
          startDate: values.startDate,
          endDate: values.endDate,
        })
      }

      // Deferred creation: a pending "new" Club draft is only ever actually created here, on
      // Subscription-form submit — not as ClubPicker's own selection changes — so an abandoned
      // form leaves no orphan Club row (see docs/specs/011-inline-club-creation-in-subscription
      // -form.md's Goals). A rejection here (reserved/duplicate slug) must block subscription
      // creation entirely and surface against ClubPicker's Slug field, not the generic banner.
      let ownerId: string
      if (values.club.mode === 'new') {
        try {
          const club = await createClub({ name: values.club.name, slug: values.club.slug })
          ownerId = club.id
        } catch (err) {
          throw new ClubCreationError(errorDetail(err, 'Something went wrong adding this club. Please try again.'))
        }
      } else {
        ownerId = values.club.id
      }

      // Both an `existing` and a `new` selection send the full 4 fields — the backend resolves/
      // dedupes by email regardless and discards the other 3 for an existing match ("link, don't
      // overwrite"), so it's safe, if slightly redundant, to always send all 4. One
      // createSubscription call either way — no separate network call for the person at all, see
      // docs/specs/014-subscription-responsible-contact.md's UI Requirements.
      const responsiblePerson: ResponsiblePersonInput = {
        firstName: values.responsiblePerson.firstName,
        lastName: values.responsiblePerson.lastName,
        email: values.responsiblePerson.email,
        phone: values.responsiblePerson.phone ?? '',
      }

      return createSubscription({
        ownerType: 'CLUB',
        ownerId,
        productId: values.productId,
        startDate: values.startDate,
        endDate: values.endDate,
        responsiblePerson,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] })
      navigate('/admin/billing')
    },
  })

  // Ends the Club's entitlement — distinct from the nav "Cancel" button below, which just
  // leaves the form. See docs/plans/009-subscriptions.md Flag #4 for why these can't share
  // the word "Cancel".
  const cancelSubscriptionMutation = useMutation({
    mutationFn: () => cancelSubscription(id as string),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] })
      // Drop the cached single-subscription entry rather than invalidating it — the immediate
      // navigate() below unmounts the only observer, so an invalidate-triggered refetch would
      // fire and be thrown away. A later re-visit to this same edit page fetches fresh anyway.
      queryClient.removeQueries({ queryKey: ['subscription', id] })
      navigate('/admin/billing')
    },
  })

  if (isEdit && isLoading) {
    return null
  }

  if (isEdit && isError) {
    return (
      <EmptyState
        title="Couldn't load this subscription"
        description="Something went wrong loading this subscription. Please try again."
      />
    )
  }

  if (isEdit && !subscription) {
    return null
  }

  const submitLabel = isEdit ? 'Save changes' : 'Create subscription'
  const clubCreationError = saveMutation.error instanceof ClubCreationError ? saveMutation.error.message : undefined

  return (
    <RecordFormScreen
      title={isEdit ? 'Edit Subscription' : 'Add Subscription'}
      backTo="/admin/billing"
      backLabel="Back to Subscriptions"
      actions={
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
          {/* Mutually exclusive with ClubPicker's own inline Slug-field error below — a
              club-creation failure is routed there instead of this generic banner. */}
          {saveMutation.isError && !(saveMutation.error instanceof ClubCreationError) && (
            <Typography variant="body2" color="error.main">
              {errorDetail(saveMutation.error, 'Something went wrong saving this subscription. Please try again.')}
            </Typography>
          )}

          <Button type="submit" form={SUBSCRIPTION_FORM_ID} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'Saving…' : submitLabel}
          </Button>
          {/* Nav-away action — leaves the form without saving. Not to be confused with the
              business "Cancel Subscription" action below (Flag #4). */}
          <Button
            variant="ghost"
            disabled={saveMutation.isPending}
            onClick={() => navigate('/admin/billing')}
          >
            Cancel
          </Button>

          {isEdit && subscription && subscription.status !== 'CANCELLED' && (
            <>
              {confirmingCancel ? (
                <>
                  <Typography variant="body2">Cancel this subscription?</Typography>
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={cancelSubscriptionMutation.isPending}
                    onClick={() => cancelSubscriptionMutation.mutate()}
                  >
                    {cancelSubscriptionMutation.isPending ? 'Cancelling…' : 'Confirm cancel'}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirmingCancel(false)}>
                    Keep subscription
                  </Button>
                </>
              ) : (
                <Button variant="danger" size="sm" onClick={() => setConfirmingCancel(true)}>
                  Cancel Subscription
                </Button>
              )}
            </>
          )}

          {cancelSubscriptionMutation.isError && (
            <Typography variant="body2" color="error.main">
              {errorDetail(
                cancelSubscriptionMutation.error,
                'Something went wrong cancelling this subscription. Please try again.',
              )}
            </Typography>
          )}
        </Stack>
      }
    >
      <SubscriptionForm
        initialValues={
          subscription
            ? {
                clubId: subscription.club.id,
                clubLabel: subscription.club.name,
                productId: subscription.product.id,
                productLabel: `${subscription.product.name} (${subscription.product.code})`,
                startDate: subscription.startDate,
                endDate: subscription.endDate,
                responsiblePerson: subscription.responsiblePerson,
              }
            : undefined
        }
        onSubmit={(values) => saveMutation.mutate(values)}
        clubCreationError={clubCreationError}
      />
    </RecordFormScreen>
  )
}
