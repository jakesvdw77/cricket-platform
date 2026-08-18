import { useState } from 'react'
import { Stack, Typography } from '@mui/material'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ProductForm, PRODUCT_FORM_ID } from '../../components/ProductForm'
import { RecordFormScreen } from '../../components/RecordFormScreen'
import { Button } from '../../components/Button'
import { EmptyState } from '../../components/EmptyState'
import { getProduct, createProduct, updateProduct, retireProduct } from '../../api/productApi'
import type { ProductPayload, UpdateProductPayload } from '../../api/productApi'

export default function ProductFormPage() {
  const { id } = useParams<{ id?: string }>()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [confirmingRetire, setConfirmingRetire] = useState(false)

  const {
    data: product,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['product', id],
    queryFn: () => getProduct(id as string),
    enabled: isEdit,
  })

  const saveMutation = useMutation({
    mutationFn: (payload: ProductPayload) => {
      if (isEdit && id) {
        const { status, ...rest } = payload
        // UpdateProductRequest only accepts DRAFT/ACTIVE — ProductForm only ever produces
        // RETIRED here if an already-retired product is re-saved unchanged, an edge case
        // outside this spec's UI flow (the Retire button below is the only route to RETIRED).
        const updatePayload: UpdateProductPayload = {
          ...rest,
          displayOrder: payload.displayOrder ?? 0,
          status: (status ?? 'DRAFT') as UpdateProductPayload['status'],
          showAds: payload.showAds ?? false,
          allowSubdomain: payload.allowSubdomain ?? false,
          allowWhitelisting: payload.allowWhitelisting ?? false,
        }
        return updateProduct(id, updatePayload)
      }

      const { status: _status, ...createPayload } = payload
      return createProduct(createPayload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      navigate('/admin/configuration/products')
    },
  })

  const retireMutation = useMutation({
    mutationFn: () => retireProduct(id as string),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      navigate('/admin/configuration/products')
    },
  })

  if (isEdit && isLoading) {
    return null
  }

  if (isEdit && isError) {
    return (
      <EmptyState
        title="Couldn't load this product"
        description="Something went wrong loading this product. Please try again."
      />
    )
  }

  if (isEdit && !product) {
    return null
  }

  const readOnly = product?.status === 'RETIRED'
  const submitLabel = isEdit ? 'Save changes' : 'Create product'

  return (
    <RecordFormScreen
      title={isEdit ? 'Edit Product' : 'Add Product'}
      backTo="/admin/configuration/products"
      backLabel="Back to Products"
      actions={
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
          {saveMutation.isError && (
            <Typography variant="body2" color="error.main">
              Something went wrong saving this product. Please try again.
            </Typography>
          )}

          {!readOnly && (
            <>
              <Button type="submit" form={PRODUCT_FORM_ID} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Saving…' : submitLabel}
              </Button>
              <Button
                variant="ghost"
                disabled={saveMutation.isPending}
                onClick={() => navigate('/admin/configuration/products')}
              >
                Cancel
              </Button>
            </>
          )}

          {isEdit && product && product.status !== 'RETIRED' && (
            <>
              {confirmingRetire ? (
                <>
                  <Typography variant="body2">Retire this product?</Typography>
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={retireMutation.isPending}
                    onClick={() => retireMutation.mutate()}
                  >
                    {retireMutation.isPending ? 'Retiring…' : 'Confirm retire'}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirmingRetire(false)}>
                    Don't retire
                  </Button>
                </>
              ) : (
                <Button variant="danger" size="sm" onClick={() => setConfirmingRetire(true)}>
                  Retire
                </Button>
              )}
            </>
          )}

          {retireMutation.isError && (
            <Typography variant="body2" color="error.main">
              Something went wrong retiring this product. Please try again.
            </Typography>
          )}
        </Stack>
      }
    >
      <ProductForm
        initialValues={
          product
            ? {
                code: product.code,
                name: product.name,
                description: product.description,
                isFree: product.isFree,
                price: product.price,
                currency: product.currency,
                billingInterval: product.billingInterval,
                maxPeriodMonths: product.maxPeriodMonths,
                maxSections: product.maxSections,
                maxTeams: product.maxTeams,
                maxPlayers: product.maxPlayers,
                displayOrder: product.displayOrder,
                status: product.status,
                showAds: product.showAds,
                allowSubdomain: product.allowSubdomain,
                allowWhitelisting: product.allowWhitelisting,
              }
            : undefined
        }
        onSubmit={(values) => saveMutation.mutate(values)}
      />
    </RecordFormScreen>
  )
}
