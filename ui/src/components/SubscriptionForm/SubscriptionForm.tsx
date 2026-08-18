import { useEffect, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { Autocomplete, Box, CircularProgress, MenuItem } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { Input } from '../Input'
import { searchClubs } from '../../api/leadApi'
import type { ClubSummary } from '../../api/leadApi'
import { listProducts } from '../../api/productApi'

// Stable id the <form> element renders with — RecordFormScreen's actions bar lives outside
// this component (see SubscriptionFormPage), so its Save button targets this form via the
// native HTML `form="…"` attribute, same convention as ProductForm/PRODUCT_FORM_ID.
export const SUBSCRIPTION_FORM_ID = 'subscription-form'

const CLUB_SEARCH_DEBOUNCE_MS = 300

export interface SubscriptionFormValues {
  clubId: string
  productId: string
  startDate: string | null
  endDate: string | null
}

export interface SubscriptionFormInitialValues {
  clubId: string
  // Display label for the pre-selected Club (edit mode only) — the Club picker is disabled
  // once editing, so it never needs to be re-resolved via search.
  clubLabel: string
  productId: string
  startDate: string | null
  endDate: string | null
}

export interface SubscriptionFormProps {
  initialValues?: Partial<SubscriptionFormInitialValues>
  onSubmit: (values: SubscriptionFormValues) => void
}

interface FormState {
  clubId: string
  clubLabel: string
  productId: string
  startDate: string
  endDate: string
}

type FormErrors = Partial<Record<'clubId' | 'productId' | 'startDate' | 'endDate', string>>

function toFormState(initialValues?: Partial<SubscriptionFormInitialValues>): FormState {
  return {
    clubId: initialValues?.clubId ?? '',
    clubLabel: initialValues?.clubLabel ?? '',
    productId: initialValues?.productId ?? '',
    startDate: initialValues?.startDate ?? '',
    endDate: initialValues?.endDate ?? '',
  }
}

// Informational only — the product's max term is suggested, never enforced client- or
// server-side (see docs/roadmap.md's enforcement-deferred note). Plain Date arithmetic, not a
// date library (none exists in this codebase yet): month-length overflow (e.g. Jan 31 + 1
// month) can roll into the following month, which is an acceptable rough edge for a suggestion
// the admin can freely overwrite.
function addMonths(isoDate: string, months: number): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  date.setUTCMonth(date.getUTCMonth() + months)
  return date.toISOString().slice(0, 10)
}

function validate(values: FormState, isEdit: boolean): FormErrors {
  const errors: FormErrors = {}

  // Edit mode always carries a clubId forward from initialValues (the picker is disabled, so
  // it can't be cleared) — only create mode needs this checked.
  if (!isEdit && !values.clubId) {
    errors.clubId = 'Select a club'
  }

  if (!values.productId) {
    errors.productId = 'Select a product'
  }

  if (values.startDate && values.endDate && values.endDate < values.startDate) {
    errors.endDate = 'End date must be on or after the start date'
  }

  return errors
}

export function SubscriptionForm({ initialValues, onSubmit }: SubscriptionFormProps) {
  // Presence of initialValues signals edit mode, same convention ProductForm uses for its own
  // originalStatus-derived checks rather than a separate isEdit prop.
  const isEdit = Boolean(initialValues)

  const [values, setValues] = useState<FormState>(() => toFormState(initialValues))
  const [errors, setErrors] = useState<FormErrors>({})
  // Once the admin has explicitly set an end date (typed one in, or it arrived from
  // initialValues on edit), stop auto-suggesting — never clobber a deliberate value.
  const [endDateTouched, setEndDateTouched] = useState(Boolean(initialValues?.endDate))

  const [clubInputValue, setClubInputValue] = useState(initialValues?.clubLabel ?? '')
  const [debouncedClubQuery, setDebouncedClubQuery] = useState('')
  const [selectedClub, setSelectedClub] = useState<ClubSummary | null>(
    initialValues?.clubId && initialValues?.clubLabel
      ? { id: initialValues.clubId, name: initialValues.clubLabel, slug: '' }
      : null,
  )

  useEffect(() => {
    if (isEdit) {
      return
    }
    const handle = setTimeout(() => setDebouncedClubQuery(clubInputValue.trim()), CLUB_SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(handle)
  }, [clubInputValue, isEdit])

  const { data: clubOptions = [], isFetching: isSearchingClubs } = useQuery({
    queryKey: ['subscription-form-clubs', debouncedClubQuery],
    queryFn: () => searchClubs(debouncedClubQuery),
    enabled: !isEdit && debouncedClubQuery.length > 0,
  })

  // Products are admin-curated, never paginated in this picker — a plain select over the
  // first page of ACTIVE products is enough (see docs/plans/009-subscriptions.md item 4).
  const { data: productPage } = useQuery({
    queryKey: ['subscription-form-products'],
    queryFn: () => listProducts({ page: 0, size: 100, status: 'ACTIVE' }),
  })
  const productOptions = productPage?.content ?? []
  const selectedProduct = productOptions.find((product) => product.id === values.productId) ?? null

  // Suggests endDate = startDate + the selected product's maxPeriodMonths whenever the admin
  // hasn't set one themselves — informational, not enforced (Product.maxPeriodMonths has no
  // corresponding backend validation on Subscription in this spec, see docs/roadmap.md).
  useEffect(() => {
    if (endDateTouched || !selectedProduct?.maxPeriodMonths || !values.startDate) {
      return
    }
    setValues((prev) => ({ ...prev, endDate: addMonths(prev.startDate, selectedProduct.maxPeriodMonths as number) }))
  }, [endDateTouched, selectedProduct, values.startDate])

  const handleChange = (field: 'startDate' | 'endDate') => (event: ChangeEvent<HTMLInputElement>) => {
    if (field === 'endDate') {
      setEndDateTouched(true)
    }
    setValues((prev) => ({ ...prev, [field]: event.target.value }))
  }

  const handleProductChange = (event: ChangeEvent<HTMLInputElement>) => {
    setValues((prev) => ({ ...prev, productId: event.target.value }))
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const validationErrors = validate(values, isEdit)
    setErrors(validationErrors)

    if (Object.keys(validationErrors).length > 0) {
      return
    }

    onSubmit({
      clubId: values.clubId,
      productId: values.productId,
      startDate: values.startDate || null,
      endDate: values.endDate || null,
    })
  }

  return (
    // display: 'contents' removes this <form> from the box tree so its children become direct
    // items of RecordFormScreen's field grid (see SubscriptionFormPage) — same convention as
    // ProductForm; submission is triggered from outside via SUBSCRIPTION_FORM_ID.
    <Box component="form" id={SUBSCRIPTION_FORM_ID} onSubmit={handleSubmit} noValidate sx={{ display: 'contents' }}>
      <Autocomplete
        disabled={isEdit}
        options={clubOptions}
        loading={isSearchingClubs}
        value={selectedClub}
        onChange={(_event, newValue) => {
          setSelectedClub(newValue)
          setValues((prev) => ({ ...prev, clubId: newValue?.id ?? '' }))
        }}
        inputValue={clubInputValue}
        onInputChange={(_event, newInputValue) => setClubInputValue(newInputValue)}
        getOptionLabel={(option) => option.name}
        isOptionEqualToValue={(option, value) => option.id === value.id}
        filterOptions={(options) => options}
        renderInput={(params) => (
          <Input
            {...params}
            label="Club"
            placeholder="Search by club name"
            error={Boolean(errors.clubId)}
            helperText={errors.clubId ?? (isEdit ? 'The owning Club cannot be changed after creation' : undefined)}
            InputProps={{
              ...params.InputProps,
              endAdornment: (
                <>
                  {isSearchingClubs && <CircularProgress color="inherit" size={16} />}
                  {params.InputProps.endAdornment}
                </>
              ),
            }}
          />
        )}
      />

      <Input
        select
        label="Product"
        value={values.productId}
        onChange={handleProductChange}
        error={Boolean(errors.productId)}
        helperText={
          errors.productId ??
          (selectedProduct
            ? selectedProduct.maxPeriodMonths
              ? `Max term: ${selectedProduct.maxPeriodMonths} month${selectedProduct.maxPeriodMonths === 1 ? '' : 's'}`
              : 'No fixed term limit'
            : undefined)
        }
      >
        {productOptions.map((product) => (
          <MenuItem key={product.id} value={product.id}>
            {product.name} ({product.code})
          </MenuItem>
        ))}
      </Input>

      <Input
        label="Start date"
        type="date"
        value={values.startDate}
        onChange={handleChange('startDate')}
        error={Boolean(errors.startDate)}
        helperText={errors.startDate ?? 'Leave blank to start today'}
        InputLabelProps={{ shrink: true }}
      />
      <Input
        label="End date (optional)"
        type="date"
        value={values.endDate}
        onChange={handleChange('endDate')}
        error={Boolean(errors.endDate)}
        helperText={
          errors.endDate ??
          (!endDateTouched && selectedProduct?.maxPeriodMonths
            ? `Suggested from the product's ${selectedProduct.maxPeriodMonths}-month max term — edit to override`
            : 'Leave blank for an ongoing subscription')
        }
        InputLabelProps={{ shrink: true }}
      />
    </Box>
  )
}
