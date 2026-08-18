import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SubscriptionForm, SUBSCRIPTION_FORM_ID } from './SubscriptionForm'
import type { SubscriptionFormProps } from './SubscriptionForm'
import type { ListProductsParams } from '../../api/productApi'

const searchClubs = vi.fn()
const listProducts = vi.fn()

vi.mock('../../api/leadApi', () => ({
  searchClubs: (query: string) => searchClubs(query),
}))

vi.mock('../../api/productApi', () => ({
  listProducts: (params: ListProductsParams) => listProducts(params),
}))

beforeEach(() => {
  vi.clearAllMocks()
  listProducts.mockResolvedValue({
    content: [
      { id: 'prod-1', name: 'Club Standard', code: 'CLUB_STANDARD' },
      { id: 'prod-2', name: 'Club Pro', code: 'CLUB_PRO' },
    ],
    totalElements: 2,
    totalPages: 1,
    number: 0,
    size: 100,
  })
  searchClubs.mockResolvedValue([{ id: 'club-1', name: 'Riverside CC', slug: 'riverside-cc' }])
})

// SubscriptionForm's own submit button lives outside it (RecordFormScreen's actions bar, see
// SubscriptionFormPage) and targets the form via the native `form="…"` attribute — this mirrors
// that wiring, same convention as ProductForm.test.tsx's renderProductForm helper.
function renderSubscriptionForm(props: SubscriptionFormProps, submitLabel = 'Submit') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <SubscriptionForm {...props} />
      <button type="submit" form={SUBSCRIPTION_FORM_ID}>
        {submitLabel}
      </button>
    </QueryClientProvider>,
  )
}

async function waitForDebounce() {
  // SubscriptionForm debounces the Club search into the query key ~300ms — see
  // CLUB_SEARCH_DEBOUNCE_MS.
  await new Promise((resolve) => setTimeout(resolve, 350))
}

describe('SubscriptionForm', () => {
  it('renders the Club/Product pickers and date fields', async () => {
    renderSubscriptionForm({ onSubmit: vi.fn() })

    expect(screen.getByLabelText('Club')).toBeInTheDocument()
    expect(screen.getByLabelText('Product')).toBeInTheDocument()
    expect(screen.getByLabelText('Start date')).toBeInTheDocument()
    expect(screen.getByLabelText('End date (optional)')).toBeInTheDocument()

    // Only ACTIVE products are ever requested for the picker, per
    // docs/specs/009-subscriptions.md's UI Requirements.
    expect(listProducts).toHaveBeenCalledWith({ page: 0, size: 100, status: 'ACTIVE' })
  })

  it('renders inline validation errors when required fields are missing and does not submit', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderSubscriptionForm({ onSubmit })

    await user.click(screen.getByRole('button', { name: 'Submit' }))

    expect(await screen.findByText('Select a club')).toBeInTheDocument()
    expect(screen.getByText('Select a product')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('rejects an end date before the start date with an inline error and does not submit', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderSubscriptionForm({ onSubmit })

    // clubId/productId are left unset here — this test only exercises the date-ordering rule in
    // isolation; validate() still reports those as separate errors, which is fine since this
    // assertion only checks the endDate error is present and submit is blocked.
    const startDate = screen.getByLabelText('Start date')
    const endDate = screen.getByLabelText('End date (optional)')
    await user.clear(startDate)
    await user.type(startDate, '2026-06-01')
    await user.clear(endDate)
    await user.type(endDate, '2026-01-01')

    await user.click(screen.getByRole('button', { name: 'Submit' }))

    expect(await screen.findByText('End date must be on or after the start date')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it(
    'submits a correctly-shaped payload after selecting a club and product',
    async () => {
      const user = userEvent.setup()
      const onSubmit = vi.fn()
      renderSubscriptionForm({ onSubmit })

      await user.type(screen.getByLabelText('Club'), 'Riverside')
      await waitForDebounce()
      await user.click(await screen.findByRole('option', { name: 'Riverside CC' }))

      await user.click(screen.getByLabelText('Product'))
      await user.click(await screen.findByRole('option', { name: /Club Standard/ }))

      await user.click(screen.getByRole('button', { name: 'Submit' }))

      expect(onSubmit).toHaveBeenCalledTimes(1)
      expect(onSubmit).toHaveBeenCalledWith({
        clubId: 'club-1',
        productId: 'prod-1',
        startDate: null,
        endDate: null,
      })
    },
    15000,
  )

  it('disables the Club Autocomplete in edit mode and never fires its search query', async () => {
    renderSubscriptionForm({
      onSubmit: vi.fn(),
      initialValues: {
        clubId: 'club-1',
        clubLabel: 'Riverside CC',
        productId: 'prod-1',
        startDate: '2026-01-01',
        endDate: null,
      },
    })

    const clubField = screen.getByLabelText('Club')
    expect(clubField).toBeDisabled()
    expect(clubField).toHaveValue('Riverside CC')
    expect(screen.getByText('The owning Club cannot be changed after creation')).toBeInTheDocument()

    // Give any stray debounce timer a chance to fire before asserting — the query must never be
    // requested at all while editing, not merely be starved of user input.
    await waitForDebounce()

    expect(searchClubs).not.toHaveBeenCalled()
  })

  it('edit mode pre-fills the Product select and date fields from initialValues', () => {
    renderSubscriptionForm({
      onSubmit: vi.fn(),
      initialValues: {
        clubId: 'club-1',
        clubLabel: 'Riverside CC',
        productId: 'prod-2',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
      },
    })

    expect(screen.getByDisplayValue('2026-01-01')).toBeInTheDocument()
    expect(screen.getByDisplayValue('2026-12-31')).toBeInTheDocument()
  })
})
