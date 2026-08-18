import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ProductForm, PRODUCT_FORM_ID } from './ProductForm'
import type { ProductFormProps } from './ProductForm'
import type { ProductPayload } from '../../api/productApi'

// ProductForm's own submit button now lives outside it (RecordFormScreen's actions bar, see
// ProductFormPage) and targets the form via the native `form="…"` attribute — this mirrors
// that wiring so the form's submit behaviour can still be exercised in isolation.
function renderProductForm(props: ProductFormProps, submitLabel = 'Submit') {
  return render(
    <>
      <ProductForm {...props} />
      <button type="submit" form={PRODUCT_FORM_ID}>
        {submitLabel}
      </button>
    </>,
  )
}

describe('ProductForm', () => {
  it('renders all fields', () => {
    renderProductForm({ onSubmit: vi.fn() })

    expect(screen.getByLabelText('Code')).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toBeInTheDocument()
    expect(screen.getByLabelText('Description (optional)')).toBeInTheDocument()
    expect(screen.getByLabelText('Free product')).toBeInTheDocument()
    expect(screen.getByLabelText('Price')).toBeInTheDocument()
    expect(screen.getByLabelText('Currency')).toBeInTheDocument()
    expect(screen.getByLabelText('Billing interval')).toBeInTheDocument()
    expect(screen.getByLabelText('Max period (months, optional)')).toBeInTheDocument()
    expect(screen.getByLabelText('Max sections (optional)')).toBeInTheDocument()
    expect(screen.getByLabelText('Max teams (optional)')).toBeInTheDocument()
    expect(screen.getByLabelText('Max players (optional)')).toBeInTheDocument()
    expect(screen.getByLabelText('Display order')).toBeInTheDocument()
  })

  it(
    'toggling isFree hides price/currency/billingInterval and their validation errors no longer block submit',
    async () => {
      const user = userEvent.setup()
      const onSubmit = vi.fn()
      renderProductForm({ onSubmit })

      // Price/currency are required while isFree is off — trigger their validation first.
      await user.type(screen.getByLabelText('Code'), 'CLUB_STANDARD')
      await user.type(screen.getByLabelText('Name'), 'Club Standard')
      await user.click(screen.getByRole('button', { name: 'Submit' }))
      expect(await screen.findByText('Enter a valid price')).toBeInTheDocument()
      expect(screen.getByText('Currency is required')).toBeInTheDocument()

      await user.click(screen.getByLabelText('Free product'))

      expect(screen.queryByLabelText('Price')).not.toBeInTheDocument()
      expect(screen.queryByLabelText('Currency')).not.toBeInTheDocument()
      expect(screen.queryByLabelText('Billing interval')).not.toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Submit' }))

      expect(onSubmit).toHaveBeenCalledTimes(1)
      const payload = onSubmit.mock.calls[0][0] as ProductPayload
      expect(payload.isFree).toBe(true)
      expect(payload.price).toBeNull()
      expect(payload.currency).toBeNull()
      expect(payload.billingInterval).toBeNull()
    },
    // Toggling the MUI Switch mid-form unmounts three controlled inputs, which is
    // consistently slower than the 5s default under a loaded test run (all other
    // tests here stay well under it) — not a hang, just needs more wall-clock room.
    15000,
  )

  it(
    'submits a correctly-shaped payload when all fields are filled in',
    async () => {
      const user = userEvent.setup()
      const onSubmit = vi.fn()
      renderProductForm({ onSubmit })

      await user.type(screen.getByLabelText('Code'), 'club_standard')
      await user.type(screen.getByLabelText('Name'), 'Club Standard')
      await user.type(screen.getByLabelText('Price'), '49.99')
      await user.type(screen.getByLabelText('Currency'), 'usd')
      await user.type(screen.getByLabelText('Max sections (optional)'), '5')

      await user.click(screen.getByRole('button', { name: 'Submit' }))

      expect(onSubmit).toHaveBeenCalledTimes(1)
      const payload = onSubmit.mock.calls[0][0] as ProductPayload
      expect(payload).toMatchObject({
        code: 'club_standard',
        name: 'Club Standard',
        isFree: false,
        price: 49.99,
        currency: 'USD',
        billingInterval: 'MONTHLY',
        maxSections: 5,
        displayOrder: 0,
      })
    },
    // Typing across five fields is consistently slower than the 5s default under a loaded
    // test run — see the matching note above. Not a hang: passes standalone in ~2s.
    15000,
  )

  it('renders inline validation errors for required fields and does not submit', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderProductForm({ onSubmit })

    await user.click(screen.getByRole('button', { name: 'Submit' }))

    expect(await screen.findByText('Code is required')).toBeInTheDocument()
    expect(screen.getByText('Name is required')).toBeInTheDocument()
    expect(screen.getByText('Enter a valid price')).toBeInTheDocument()
    expect(screen.getByText('Currency is required')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('shows the Publish (set Active) checkbox only for a DRAFT product and flips status to ACTIVE when checked', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderProductForm({
      onSubmit,
      initialValues: {
        code: 'CLUB_STANDARD',
        name: 'Club Standard',
        isFree: true,
        status: 'DRAFT',
      },
    })

    const publishCheckbox = screen.getByLabelText('Publish (set Active)')
    expect(publishCheckbox).toBeInTheDocument()

    await user.click(publishCheckbox)
    await user.click(screen.getByRole('button', { name: 'Submit' }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    const payload = onSubmit.mock.calls[0][0] as ProductPayload
    expect(payload.status).toBe('ACTIVE')
  })

  it('does not show the Publish checkbox for a non-DRAFT product, and leaves status unchanged when not published', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderProductForm({
      onSubmit,
      initialValues: {
        code: 'CLUB_STANDARD',
        name: 'Club Standard',
        isFree: true,
        status: 'ACTIVE',
      },
    })

    expect(screen.queryByLabelText('Publish (set Active)')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Submit' }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    const payload = onSubmit.mock.calls[0][0] as ProductPayload
    expect(payload.status).toBe('ACTIVE')
  })

  it('renders every field disabled and shows the informational message for a RETIRED product', () => {
    renderProductForm({
      onSubmit: vi.fn(),
      initialValues: {
        code: 'CLUB_STANDARD',
        name: 'Club Standard',
        isFree: false,
        price: 49.99,
        currency: 'USD',
        billingInterval: 'MONTHLY',
        status: 'RETIRED',
      },
    })

    expect(screen.getByLabelText('Code')).toBeDisabled()
    expect(screen.getByLabelText('Name')).toBeDisabled()
    expect(screen.getByLabelText('Description (optional)')).toBeDisabled()
    expect(screen.getByLabelText('Free product')).toBeDisabled()
    expect(screen.getByLabelText('Price')).toBeDisabled()
    expect(screen.getByLabelText('Currency')).toBeDisabled()
    // MUI's Select renders its accessible "input" as a role=combobox div, not a native
    // disable-capable form element, so jest-dom's toBeDisabled() doesn't recognize it —
    // assert its aria-disabled state instead.
    expect(screen.getByLabelText('Billing interval')).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByLabelText('Max period (months, optional)')).toBeDisabled()
    expect(screen.getByLabelText('Max sections (optional)')).toBeDisabled()
    expect(screen.getByLabelText('Max teams (optional)')).toBeDisabled()
    expect(screen.getByLabelText('Max players (optional)')).toBeDisabled()
    expect(screen.getByLabelText('Display order')).toBeDisabled()

    expect(
      screen.getByText(
        'This product is retired and is read-only. Its data is kept for historical reference and can no longer be edited.',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByLabelText('Publish (set Active)')).not.toBeInTheDocument()
  })
})
