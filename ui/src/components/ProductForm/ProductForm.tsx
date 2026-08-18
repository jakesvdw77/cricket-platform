import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { Box, Checkbox, FormControlLabel, MenuItem, Switch, Typography } from '@mui/material'
import { Input } from '../Input'
import type { BillingInterval, ProductPayload } from '../../api/productApi'

// Stable id the <form> element renders with — RecordFormScreen's actions bar lives outside
// this component (see ProductFormPage), so its Save button targets this form via the native
// HTML `form="…"` attribute rather than nesting a submit button inside the field grid.
export const PRODUCT_FORM_ID = 'product-form'

export interface ProductFormProps {
  initialValues?: Partial<ProductPayload>
  onSubmit: (values: ProductPayload) => void
}

interface FormState {
  code: string
  name: string
  description: string
  isFree: boolean
  price: string
  currency: string
  billingInterval: BillingInterval
  maxPeriodMonths: string
  maxSections: string
  maxTeams: string
  maxPlayers: string
  displayOrder: string
  showAds: boolean
  allowSubdomain: boolean
  allowWhitelisting: boolean
  publish: boolean
}

type FormErrors = Partial<Record<keyof FormState, string>>

const NUMBER_FIELDS = ['maxPeriodMonths', 'maxSections', 'maxTeams', 'maxPlayers'] as const

function numberToInput(value: number | null | undefined): string {
  return value === null || value === undefined ? '' : String(value)
}

function toFormState(initialValues?: Partial<ProductPayload>): FormState {
  return {
    code: initialValues?.code ?? '',
    name: initialValues?.name ?? '',
    description: initialValues?.description ?? '',
    isFree: initialValues?.isFree ?? false,
    price: numberToInput(initialValues?.price),
    currency: initialValues?.currency ?? '',
    billingInterval: initialValues?.billingInterval ?? 'MONTHLY',
    maxPeriodMonths: numberToInput(initialValues?.maxPeriodMonths),
    maxSections: numberToInput(initialValues?.maxSections),
    maxTeams: numberToInput(initialValues?.maxTeams),
    maxPlayers: numberToInput(initialValues?.maxPlayers),
    displayOrder: numberToInput(initialValues?.displayOrder) || '0',
    showAds: initialValues?.showAds ?? false,
    allowSubdomain: initialValues?.allowSubdomain ?? false,
    allowWhitelisting: initialValues?.allowWhitelisting ?? false,
    publish: false,
  }
}

function validate(values: FormState): FormErrors {
  const errors: FormErrors = {}

  if (!values.code.trim()) {
    errors.code = 'Code is required'
  }

  if (!values.name.trim()) {
    errors.name = 'Name is required'
  }

  if (!values.isFree) {
    const price = Number(values.price)
    if (!values.price.trim() || Number.isNaN(price) || price < 0) {
      errors.price = 'Enter a valid price'
    }

    if (!values.currency.trim()) {
      errors.currency = 'Currency is required'
    } else if (values.currency.trim().length !== 3) {
      errors.currency = 'Use a 3-letter currency code, e.g. USD'
    }
  }

  NUMBER_FIELDS.forEach((field) => {
    const raw = values[field]
    if (raw.trim() && (Number.isNaN(Number(raw)) || Number(raw) <= 0)) {
      errors[field] = 'Must be a positive number'
    }
  })

  if (values.displayOrder.trim() === '' || Number.isNaN(Number(values.displayOrder)) || Number(values.displayOrder) < 0) {
    errors.displayOrder = 'Must be zero or greater'
  }

  return errors
}

export function ProductForm({ initialValues, onSubmit }: ProductFormProps) {
  const [values, setValues] = useState<FormState>(() => toFormState(initialValues))
  const [errors, setErrors] = useState<FormErrors>({})

  const originalStatus = initialValues?.status
  const showPublishToggle = originalStatus === 'DRAFT'
  // A retired product is history-preserving only — UpdateProductRequest's status field
  // only accepts DRAFT/ACTIVE server-side, so submitting a RETIRED product's form would
  // 409. Read-only here instead of a submit that's guaranteed to fail.
  const readOnly = originalStatus === 'RETIRED'

  const handleChange = (field: keyof FormState) => (event: ChangeEvent<HTMLInputElement>) => {
    setValues((prev) => ({ ...prev, [field]: event.target.value }))
  }

  const handleToggle = (field: keyof FormState) => (event: ChangeEvent<HTMLInputElement>) => {
    setValues((prev) => ({ ...prev, [field]: event.target.checked }))
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const validationErrors = validate(values)
    setErrors(validationErrors)

    if (Object.keys(validationErrors).length > 0) {
      return
    }

    const payload: ProductPayload = {
      code: values.code.trim(),
      name: values.name.trim(),
      description: values.description.trim() || null,
      isFree: values.isFree,
      price: values.isFree ? null : Number(values.price),
      currency: values.isFree ? null : values.currency.trim().toUpperCase(),
      billingInterval: values.isFree ? null : values.billingInterval,
      maxPeriodMonths: values.maxPeriodMonths.trim() ? Number(values.maxPeriodMonths) : null,
      maxSections: values.maxSections.trim() ? Number(values.maxSections) : null,
      maxTeams: values.maxTeams.trim() ? Number(values.maxTeams) : null,
      maxPlayers: values.maxPlayers.trim() ? Number(values.maxPlayers) : null,
      displayOrder: Number(values.displayOrder),
      showAds: values.showAds,
      allowSubdomain: values.allowSubdomain,
      allowWhitelisting: values.allowWhitelisting,
    }

    if (originalStatus) {
      payload.status = showPublishToggle && values.publish ? 'ACTIVE' : originalStatus
    }

    onSubmit(payload)
  }

  return (
    // display: 'contents' removes this <form> from the box tree so its children become direct
    // items of RecordFormScreen's field grid (see ProductFormPage) — the native <form>/onSubmit
    // wiring still works, submission is just triggered from outside via PRODUCT_FORM_ID.
    <Box component="form" id={PRODUCT_FORM_ID} onSubmit={handleSubmit} noValidate sx={{ display: 'contents' }}>
      <Input
        label="Code"
        value={values.code}
        onChange={handleChange('code')}
        error={Boolean(errors.code)}
        helperText={errors.code ?? 'Stable identifier, e.g. CLUB_STANDARD'}
        disabled={readOnly}
      />
      <Input
        label="Name"
        value={values.name}
        onChange={handleChange('name')}
        error={Boolean(errors.name)}
        helperText={errors.name}
        disabled={readOnly}
      />
      <Box sx={{ gridColumn: '1 / -1' }}>
        <Input
          label="Description (optional)"
          value={values.description}
          onChange={handleChange('description')}
          multiline
          minRows={3}
          disabled={readOnly}
        />
      </Box>

      <Box sx={{ gridColumn: '1 / -1' }}>
        <FormControlLabel
          control={<Switch checked={values.isFree} onChange={handleToggle('isFree')} disabled={readOnly} />}
          label="Free product"
        />
      </Box>

      {!values.isFree && (
        <>
          <Input
            label="Price"
            type="number"
            value={values.price}
            onChange={handleChange('price')}
            error={Boolean(errors.price)}
            helperText={errors.price}
            inputProps={{ min: 0, step: '0.01' }}
            disabled={readOnly}
          />
          <Input
            label="Currency"
            value={values.currency}
            onChange={handleChange('currency')}
            error={Boolean(errors.currency)}
            helperText={errors.currency ?? 'ISO 4217 code, e.g. USD'}
            disabled={readOnly}
          />
          <Input
            select
            label="Billing interval"
            value={values.billingInterval}
            onChange={handleChange('billingInterval')}
            disabled={readOnly}
          >
            <MenuItem value="MONTHLY">Monthly</MenuItem>
            <MenuItem value="ANNUAL">Annual</MenuItem>
          </Input>
        </>
      )}

      <Input
        label="Max period (months, optional)"
        type="number"
        value={values.maxPeriodMonths}
        onChange={handleChange('maxPeriodMonths')}
        error={Boolean(errors.maxPeriodMonths)}
        helperText={errors.maxPeriodMonths}
        inputProps={{ min: 1, step: 1 }}
        disabled={readOnly}
      />
      <Input
        label="Max sections (optional)"
        type="number"
        value={values.maxSections}
        onChange={handleChange('maxSections')}
        error={Boolean(errors.maxSections)}
        helperText={errors.maxSections}
        inputProps={{ min: 1, step: 1 }}
        disabled={readOnly}
      />
      <Input
        label="Max teams (optional)"
        type="number"
        value={values.maxTeams}
        onChange={handleChange('maxTeams')}
        error={Boolean(errors.maxTeams)}
        helperText={errors.maxTeams}
        inputProps={{ min: 1, step: 1 }}
        disabled={readOnly}
      />
      <Input
        label="Max players (optional)"
        type="number"
        value={values.maxPlayers}
        onChange={handleChange('maxPlayers')}
        error={Boolean(errors.maxPlayers)}
        helperText={errors.maxPlayers}
        inputProps={{ min: 1, step: 1 }}
        disabled={readOnly}
      />
      <Input
        label="Display order"
        type="number"
        value={values.displayOrder}
        onChange={handleChange('displayOrder')}
        error={Boolean(errors.displayOrder)}
        helperText={errors.displayOrder}
        inputProps={{ min: 0, step: 1 }}
        disabled={readOnly}
      />

      <Box sx={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 1 }}>
        <FormControlLabel
          control={<Switch checked={values.showAds} onChange={handleToggle('showAds')} disabled={readOnly} />}
          label="Show ads"
        />
        <FormControlLabel
          control={<Switch checked={values.allowSubdomain} onChange={handleToggle('allowSubdomain')} disabled={readOnly} />}
          label="Allow custom subdomain"
        />
        <FormControlLabel
          control={<Switch checked={values.allowWhitelisting} onChange={handleToggle('allowWhitelisting')} disabled={readOnly} />}
          label="Allow whitelisting"
        />
      </Box>

      {showPublishToggle && (
        <Box sx={{ gridColumn: '1 / -1' }}>
          <FormControlLabel
            control={<Checkbox checked={values.publish} onChange={handleToggle('publish')} />}
            label="Publish (set Active)"
          />
        </Box>
      )}

      {readOnly && (
        <Box sx={{ gridColumn: '1 / -1' }}>
          <Typography variant="body2" color="text.secondary">
            This product is retired and is read-only. Its data is kept for historical reference and can no
            longer be edited.
          </Typography>
        </Box>
      )}
    </Box>
  )
}
