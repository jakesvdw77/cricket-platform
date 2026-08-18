import { useState } from 'react'
import { Stack, Typography } from '@mui/material'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { SubscriptionForm, SUBSCRIPTION_FORM_ID } from '../../components/SubscriptionForm'
import type { SubscriptionFormValues } from '../../components/SubscriptionForm'
import { RecordFormScreen } from '../../components/RecordFormScreen'
import { Button } from '../../components/Button'
import { EmptyState } from '../../components/EmptyState'
import { getSubscription, createSubscription, updateSubscription, cancelSubscription } from '../../api/subscriptionApi'

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
    mutationFn: (values: SubscriptionFormValues) => {
      if (isEdit && id) {
        return updateSubscription(id, {
          productId: values.productId,
          startDate: values.startDate,
          endDate: values.endDate,
        })
      }

      return createSubscription({
        ownerType: 'CLUB',
        ownerId: values.clubId,
        productId: values.productId,
        startDate: values.startDate,
        endDate: values.endDate,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] })
      navigate('/admin/configuration/subscriptions')
    },
  })

  // Ends the Club's entitlement — distinct from the nav "Cancel" button below, which just
  // leaves the form. See docs/plans/009-subscriptions.md Flag #4 for why these can't share
  // the word "Cancel".
  const cancelSubscriptionMutation = useMutation({
    mutationFn: () => cancelSubscription(id as string),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] })
      queryClient.invalidateQueries({ queryKey: ['subscription', id] })
      navigate('/admin/configuration/subscriptions')
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

  return (
    <RecordFormScreen
      title={isEdit ? 'Edit Subscription' : 'Add Subscription'}
      backTo="/admin/configuration/subscriptions"
      backLabel="Back to Subscriptions"
      actions={
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
          {saveMutation.isError && (
            <Typography variant="body2" color="error.main">
              Something went wrong saving this subscription. Please try again.
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
            onClick={() => navigate('/admin/configuration/subscriptions')}
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
              Something went wrong cancelling this subscription. Please try again.
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
                startDate: subscription.startDate,
                endDate: subscription.endDate,
              }
            : undefined
        }
        onSubmit={(values) => saveMutation.mutate(values)}
      />
    </RecordFormScreen>
  )
}
