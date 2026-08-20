import { useEffect, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { Box, MenuItem, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { Input } from '../Input'
import { ClubPicker } from '../ClubPicker'
import type { ClubPickerValue } from '../ClubPicker'
import { EmailInput } from '../EmailInput'
import { PhoneInput } from '../PhoneInput'
import { listProducts } from '../../api/productApi'
import type { Product } from '../../api/productApi'
import type { Contact } from '../../api/subscriptionApi'
import { validateSlug } from '../../utils/slug'

// Only the fields this picker actually renders — lets the synthetic "current, possibly retired
// product" entry below satisfy the type without fabricating the rest of a full Product.
// unavailable marks that synthetic entry specifically, so rendering/helper-text can tell "no
// term limit" (a real Product fact) apart from "we don't actually know" (this entry's fact).
type ProductOption = Pick<Product, 'id' | 'name' | 'code' | 'maxPeriodMonths'> & { unavailable?: boolean }

// Stable id the <form> element renders with — RecordFormScreen's actions bar lives outside
// this component (see SubscriptionFormPage), so its Save button targets this form via the
// native HTML `form="…"` attribute, same convention as ProductForm/PRODUCT_FORM_ID.
export const SUBSCRIPTION_FORM_ID = 'subscription-form'

// Same discriminated union as ClubPickerValue, minus the null case — submission requires a
// resolved Club selection (either an existing club or a not-yet-created draft one), see
// docs/plans/011-inline-club-creation-in-subscription-form.md item 4.
export type SubscriptionClubSelection = Exclude<ClubPickerValue, null>

export interface SubscriptionFormValues {
  club: SubscriptionClubSelection
  productId: string
  startDate: string | null
  endDate: string | null
  // null only in edit mode, when the admin leaves all four contact fields blank (clearing a
  // previously-set contact, or never having one) — create mode's validation guarantees this is
  // always a complete Contact by the time onSubmit fires, see validate() below.
  responsibleContact: Contact | null
}

export interface SubscriptionFormInitialValues {
  clubId: string
  // Display label for the pre-selected Club (edit mode only) — the Club picker is disabled
  // once editing, so it never needs to be re-resolved via search.
  clubLabel: string
  productId: string
  // Display label for the pre-selected Product (edit mode only) — the Product picker only
  // fetches ACTIVE products, so a subscription's current product must be re-added by hand if
  // it's since been retired, or the select would render blank/out-of-range for an id it can't
  // find among its fetched options. See the synthetic-option merge below.
  productLabel: string
  startDate: string | null
  endDate: string | null
  // null for a pre-014 Subscription, or one whose contact was since cleared — the four fields
  // simply render blank rather than erroring, per docs/specs/014-subscription-responsible
  // -contact.md's User Stories.
  responsibleContact?: Contact | null
}

export interface SubscriptionFormProps {
  initialValues?: Partial<SubscriptionFormInitialValues>
  onSubmit: (values: SubscriptionFormValues) => void
  // Surfaces a POST /clubs failure (reserved/duplicate slug) from the page above, once a pending
  // new-club draft's creation has actually been attempted on submit — threaded straight through
  // to ClubPicker's own error prop.
  clubCreationError?: string
}

interface FormState {
  // Edit mode's disabled display only — the Club field is immutable once a Subscription exists
  // (see the disabled Input below), so this is never re-resolved via ClubPicker.
  clubId: string
  clubLabel: string
  // Create mode only — ClubPicker's own controlled value. Stays null until the admin picks an
  // existing club or starts an inline draft.
  clubSelection: ClubPickerValue
  productId: string
  startDate: string
  endDate: string
  contactFirstName: string
  contactLastName: string
  contactEmail: string
  contactPhone: string
}

type FormErrors = Partial<
  Record<
    | 'club'
    | 'clubName'
    | 'clubSlug'
    | 'productId'
    | 'startDate'
    | 'endDate'
    | 'contactFirstName'
    | 'contactLastName'
    | 'contactEmail'
    | 'contactPhone',
    string
  >
>

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Local date, not UTC — a start date is a calendar-day concept from the admin's own
// perspective, not a timestamp; toISOString() would shift near midnight in some timezones.
function todayIso(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

function toFormState(initialValues?: Partial<SubscriptionFormInitialValues>): FormState {
  const contact = initialValues?.responsibleContact
  return {
    clubId: initialValues?.clubId ?? '',
    clubLabel: initialValues?.clubLabel ?? '',
    clubSelection: null,
    productId: initialValues?.productId ?? '',
    // Defaults to today — the overwhelming common case, so the admin only needs to touch this
    // when backdating/scheduling a subscription rather than every single time.
    startDate: initialValues?.startDate ?? todayIso(),
    endDate: initialValues?.endDate ?? '',
    contactFirstName: contact?.firstName ?? '',
    contactLastName: contact?.lastName ?? '',
    contactEmail: contact?.email ?? '',
    contactPhone: contact?.phone ?? '',
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

function validate(values: FormState, isEdit: boolean, contactTouched: boolean): FormErrors {
  const errors: FormErrors = {}

  // Edit mode always carries a clubId forward from initialValues (the picker is disabled, so
  // it can't be cleared) — only create mode needs this checked.
  if (!isEdit && !values.clubSelection) {
    errors.club = 'Select a club'
  }

  // A pending inline-created club draft can exist (clubSelection is truthy) while still being
  // incomplete — e.g. "+ Add a new club" clicked from the blank on-focus default list leaves
  // both fields empty. The `club` check above only catches "nothing selected at all", not "an
  // incomplete draft selected" — mirrors ClubForm.validate()'s exact checks, since this draft
  // becomes a real POST /platform/clubs request on submit and must pass the same rules.
  if (!isEdit && values.clubSelection?.mode === 'new') {
    if (!values.clubSelection.name.trim()) {
      errors.clubName = 'Name is required'
    }
    const slugError = validateSlug(values.clubSelection.slug)
    if (slugError) {
      errors.clubSlug = slugError
    }
  }

  if (!values.productId) {
    errors.productId = 'Select a product'
  }

  if (values.startDate && values.endDate && values.endDate < values.startDate) {
    errors.endDate = 'End date must be on or after the start date'
  }

  // Create mode: all four contact fields are always required, matching the backend's
  // @NotNull/@Valid on CreateSubscriptionRequest. Edit mode: the four fields are optional as a
  // set — an admin can leave them all blank (clearing/never setting a contact) or leave them
  // exactly as loaded — but a *partial* mix (touched, and some but not all filled) is rejected,
  // mirroring the backend's "complete or absent" ContactDto validation rather than silently
  // submitting a partial contact the backend would reject. Blanking out every field of a
  // previously-set contact (contactTouched true, all four now blank) must stay valid — that's
  // the "clear an existing contact" path the spec's own User Stories call out — so completeness
  // is only enforced when touched AND not all-blank, not on "touched" alone. See
  // docs/specs/014-subscription-responsible-contact.md's UI Requirements.
  const contactFirstName = values.contactFirstName.trim()
  const contactLastName = values.contactLastName.trim()
  const contactEmail = values.contactEmail.trim()
  const contactPhone = values.contactPhone.trim()
  const allContactFieldsBlank = !contactFirstName && !contactLastName && !contactEmail && !contactPhone

  if (!isEdit || (contactTouched && !allContactFieldsBlank)) {
    if (!contactFirstName) {
      errors.contactFirstName = 'First name is required'
    }
    if (!contactLastName) {
      errors.contactLastName = 'Last name is required'
    }
    if (!contactEmail) {
      errors.contactEmail = 'Email is required'
    } else if (!EMAIL_PATTERN.test(contactEmail)) {
      errors.contactEmail = 'Enter a valid email address'
    }
    if (!contactPhone) {
      errors.contactPhone = 'Phone is required'
    }
  }

  return errors
}

export function SubscriptionForm({ initialValues, onSubmit, clubCreationError }: SubscriptionFormProps) {
  // Presence of initialValues signals edit mode, same convention ProductForm uses for its own
  // originalStatus-derived checks rather than a separate isEdit prop.
  const isEdit = Boolean(initialValues)

  const [values, setValues] = useState<FormState>(() => toFormState(initialValues))
  const [errors, setErrors] = useState<FormErrors>({})
  // Once the admin has explicitly set an end date (typed one in, or it arrived from
  // initialValues on edit), stop auto-suggesting — never clobber a deliberate value.
  const [endDateTouched, setEndDateTouched] = useState(Boolean(initialValues?.endDate))
  // Flips true the first time any of the four contact fields changes — never true just because
  // a contact arrived pre-filled from initialValues, unlike endDateTouched above (that pattern
  // gates an auto-suggest, this one gates "all four required", so a pre-filled-but-otherwise-
  // untouched contact must stay optional-as-a-set on edit). See validate() above.
  const [contactTouched, setContactTouched] = useState(false)

  // Products are admin-curated, never paginated in this picker — a plain select over the
  // first page of ACTIVE products is enough (see docs/plans/009-subscriptions.md item 4).
  // staleTime avoids a refetch on every mount (e.g. an admin creating several subscriptions in
  // a row) for data that changes rarely.
  const { data: productPage } = useQuery({
    queryKey: ['subscription-form-products'],
    queryFn: () => listProducts({ page: 0, size: 100, status: 'ACTIVE' }),
    staleTime: 60_000,
  })
  const activeProductOptions: ProductOption[] = productPage?.content ?? []
  // In edit mode, the ACTIVE-only fetch above can be missing the subscription's own product if
  // it's since been retired — merge in a synthetic entry for it so the select has something
  // valid to display and re-submit unchanged (the backend now permits that even though the
  // product isn't ACTIVE — it only re-validates on an actual product change). maxPeriodMonths
  // is unknown for it, so the "Max term" helper text below simply won't show for this one case.
  const currentProductMissing =
    isEdit && initialValues?.productId && !activeProductOptions.some((product) => product.id === initialValues.productId)
  const productOptions: ProductOption[] = currentProductMissing
    ? [
        {
          id: initialValues.productId as string,
          name: initialValues?.productLabel ?? 'Current product',
          code: '',
          maxPeriodMonths: null,
          unavailable: true,
        },
        ...activeProductOptions,
      ]
    : activeProductOptions
  const selectedProduct = productOptions.find((product) => product.id === values.productId) ?? null

  // Suggests endDate = startDate + the selected product's maxPeriodMonths whenever the admin
  // hasn't set one themselves — informational, not enforced (Product.maxPeriodMonths has no
  // corresponding backend validation on Subscription in this spec, see docs/roadmap.md).
  // Create mode only: in edit mode this must never run, even for a subscription with no end
  // date yet (an "ongoing" subscription) — simply opening the form to change something else
  // must not silently convert it to a term-limited one the moment the product data loads.
  useEffect(() => {
    if (isEdit || endDateTouched || !selectedProduct?.maxPeriodMonths || !values.startDate) {
      return
    }
    setValues((prev) => ({ ...prev, endDate: addMonths(prev.startDate, selectedProduct.maxPeriodMonths as number) }))
  }, [isEdit, endDateTouched, selectedProduct, values.startDate])

  const handleChange = (field: 'startDate' | 'endDate') => (event: ChangeEvent<HTMLInputElement>) => {
    if (field === 'endDate') {
      setEndDateTouched(true)
    }
    setValues((prev) => ({ ...prev, [field]: event.target.value }))
  }

  const handleProductChange = (event: ChangeEvent<HTMLInputElement>) => {
    setValues((prev) => ({ ...prev, productId: event.target.value }))
  }

  const handleContactTextChange =
    (field: 'contactFirstName' | 'contactLastName') => (event: ChangeEvent<HTMLInputElement>) => {
      setContactTouched(true)
      setValues((prev) => ({ ...prev, [field]: event.target.value }))
    }

  const handleContactEmailChange = (email: string) => {
    setContactTouched(true)
    setValues((prev) => ({ ...prev, contactEmail: email }))
  }

  const handleContactPhoneChange = (phone: string) => {
    setContactTouched(true)
    setValues((prev) => ({ ...prev, contactPhone: phone }))
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const validationErrors = validate(values, isEdit, contactTouched)
    setErrors(validationErrors)

    if (Object.keys(validationErrors).length > 0) {
      return
    }

    // Edit mode never renders ClubPicker (the owning Club is immutable once a Subscription
    // exists — see docs/specs/009-subscriptions.md), so clubSelection is always null there;
    // this reconstructs the existing selection from initialValues for type-completeness only —
    // SubscriptionFormPage's updateSubscription call ignores it entirely.
    const club: SubscriptionClubSelection = isEdit
      ? { mode: 'existing', id: values.clubId, name: values.clubLabel }
      : (values.clubSelection as SubscriptionClubSelection)

    // Building the payload from the form's current field values (not just the touched delta)
    // naturally satisfies UpdateSubscriptionRequest's "always submit the current full contact
    // state" posture — whether the admin touched the group or left it exactly as loaded. Null
    // only when every field is blank (create mode's validation above guarantees that can't
    // happen there), which is exactly the signal that clears a previously-set contact on PUT.
    const trimmedContact: Contact = {
      firstName: values.contactFirstName.trim(),
      lastName: values.contactLastName.trim(),
      email: values.contactEmail.trim(),
      phone: values.contactPhone.trim(),
    }
    const hasAnyContactValue = Object.values(trimmedContact).some((fieldValue) => fieldValue !== '')

    onSubmit({
      club,
      productId: values.productId,
      startDate: values.startDate || null,
      endDate: values.endDate || null,
      responsibleContact: hasAnyContactValue ? trimmedContact : null,
    })
  }

  return (
    // display: 'contents' removes this <form> from the box tree so its children become direct
    // items of RecordFormScreen's field grid (see SubscriptionFormPage) — same convention as
    // ProductForm; submission is triggered from outside via SUBSCRIPTION_FORM_ID.
    <Box component="form" id={SUBSCRIPTION_FORM_ID} onSubmit={handleSubmit} noValidate sx={{ display: 'contents' }}>
      {isEdit ? (
        <Input
          label="Club"
          value={values.clubLabel}
          disabled
          helperText="The owning Club cannot be changed after creation"
        />
      ) : (
        <ClubPicker
          value={values.clubSelection}
          onChange={(next) => setValues((prev) => ({ ...prev, clubSelection: next }))}
          nameError={errors.clubName}
          slugError={errors.clubSlug ?? clubCreationError}
          requiredError={errors.club}
        />
      )}

      <Input
        select
        label="Product"
        value={values.productId}
        onChange={handleProductChange}
        error={Boolean(errors.productId)}
        helperText={
          errors.productId ??
          (selectedProduct
            ? selectedProduct.unavailable
              ? 'This product has since been retired — dates can still be edited, but only a different active product can be selected'
              : selectedProduct.maxPeriodMonths
                ? `Max term: ${selectedProduct.maxPeriodMonths} month${selectedProduct.maxPeriodMonths === 1 ? '' : 's'}`
                : 'No fixed term limit'
            : undefined)
        }
      >
        {productOptions.map((product) => (
          <MenuItem key={product.id} value={product.id}>
            {product.code ? `${product.name} (${product.code})` : product.name}
          </MenuItem>
        ))}
      </Input>

      <Input
        label="Start date"
        type="date"
        value={values.startDate}
        onChange={handleChange('startDate')}
        error={Boolean(errors.startDate)}
        helperText={errors.startDate ?? 'Defaults to today — change only to backdate or schedule ahead'}
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

      {/* Grouped visually beneath the Club/Product/date fields above — this form's total field
          count doesn't cross ClubForm's tab-introduction threshold, so it stays a single flat
          field list rather than gaining its own tab, per docs/specs/014-subscription-responsible
          -contact.md's UI Requirements. */}
      <Box sx={{ gridColumn: '1 / -1' }}>
        <Typography variant="subtitle2" color="text.secondary">
          Responsible Contact
        </Typography>
      </Box>

      <Input
        label="First name"
        value={values.contactFirstName}
        onChange={handleContactTextChange('contactFirstName')}
        error={Boolean(errors.contactFirstName)}
        helperText={errors.contactFirstName}
      />
      <Input
        label="Last name"
        value={values.contactLastName}
        onChange={handleContactTextChange('contactLastName')}
        error={Boolean(errors.contactLastName)}
        helperText={errors.contactLastName}
      />
      <EmailInput value={values.contactEmail} onChange={handleContactEmailChange} error={errors.contactEmail} />
      <PhoneInput value={values.contactPhone} onChange={handleContactPhoneChange} error={errors.contactPhone} />
    </Box>
  )
}
