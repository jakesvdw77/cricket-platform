import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SubscriptionFormPage from './SubscriptionFormPage'
import type { Subscription } from '../../api/subscriptionApi'

const getSubscription = vi.fn()
const createSubscription = vi.fn()
const updateSubscription = vi.fn()
const cancelSubscription = vi.fn()
const searchClubs = vi.fn()
const listProducts = vi.fn()

vi.mock('../../api/subscriptionApi', () => ({
  getSubscription: (id: string) => getSubscription(id),
  createSubscription: (payload: unknown) => createSubscription(payload),
  updateSubscription: (id: string, payload: unknown) => updateSubscription(id, payload),
  cancelSubscription: (id: string) => cancelSubscription(id),
}))

vi.mock('../../api/leadApi', () => ({
  searchClubs: (query: string) => searchClubs(query),
}))

vi.mock('../../api/productApi', () => ({
  listProducts: (params: unknown) => listProducts(params),
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

function activeSubscription(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: 's-1',
    ownerType: 'CLUB',
    ownerId: 'club-1',
    club: { id: 'club-1', name: 'Riverside CC', slug: 'riverside-cc' },
    product: { id: 'prod-1', name: 'Club Standard', code: 'CLUB_STANDARD' },
    status: 'ACTIVE',
    startDate: '2026-01-01',
    endDate: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: null,
    ...overrides,
  }
}

function renderPage(initialPath: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/admin/configuration/subscriptions" element={<div>Subscription List Page</div>} />
          <Route path="/admin/configuration/subscriptions/new" element={<SubscriptionFormPage />} />
          <Route path="/admin/configuration/subscriptions/:id/edit" element={<SubscriptionFormPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('SubscriptionFormPage', () => {
  it(
    'create mode: does not fetch a subscription, and submit calls createSubscription then navigates to the list',
    async () => {
      const user = userEvent.setup()
      createSubscription.mockResolvedValueOnce(activeSubscription())

      renderPage('/admin/configuration/subscriptions/new')

      expect(screen.getByText('Add Subscription')).toBeInTheDocument()
      expect(getSubscription).not.toHaveBeenCalled()

      await user.type(screen.getByLabelText('Club'), 'Riverside')
      await new Promise((resolve) => setTimeout(resolve, 350))
      await user.click(await screen.findByRole('option', { name: 'Riverside CC' }))

      await user.click(screen.getByLabelText('Product'))
      await user.click(await screen.findByRole('option', { name: /Club Standard/ }))

      await user.click(screen.getByRole('button', { name: 'Create subscription' }))

      // startDate defaults to today (SubscriptionForm's local-date todayIso()) rather than
      // null — computed the same local-date way to avoid a UTC/local mismatch near midnight.
      const today = new Date()
      const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

      expect(createSubscription).toHaveBeenCalledTimes(1)
      expect(createSubscription).toHaveBeenCalledWith({
        ownerType: 'CLUB',
        ownerId: 'club-1',
        productId: 'prod-1',
        startDate: todayIso,
        endDate: null,
      })

      expect(await screen.findByText('Subscription List Page')).toBeInTheDocument()
    },
    15000,
  )

  it('edit mode: fetches and pre-fills the subscription, and submit calls updateSubscription then navigates to the list', async () => {
    const user = userEvent.setup()
    getSubscription.mockResolvedValueOnce(activeSubscription())
    updateSubscription.mockResolvedValueOnce(activeSubscription())

    renderPage('/admin/configuration/subscriptions/s-1/edit')

    expect(await screen.findByText('Edit Subscription')).toBeInTheDocument()
    expect(getSubscription).toHaveBeenCalledWith('s-1')
    expect(await screen.findByDisplayValue('Riverside CC')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(updateSubscription).toHaveBeenCalledTimes(1)
    const [id, payload] = updateSubscription.mock.calls[0]
    expect(id).toBe('s-1')
    expect(payload).toMatchObject({ productId: 'prod-1', startDate: '2026-01-01', endDate: null })

    expect(await screen.findByText('Subscription List Page')).toBeInTheDocument()
  })

  it('edit mode disables the Club field and never fires its search query', async () => {
    getSubscription.mockResolvedValueOnce(activeSubscription())

    renderPage('/admin/configuration/subscriptions/s-1/edit')

    const clubField = await screen.findByDisplayValue('Riverside CC')
    expect(clubField).toBeDisabled()

    await new Promise((resolve) => setTimeout(resolve, 350))
    expect(searchClubs).not.toHaveBeenCalled()
  })

  it(
    'edit mode, non-cancelled subscription: shows "Cancel Subscription" whose inline confirm has "Keep subscription" and "Confirm cancel", distinct from the nav "Cancel" button',
    async () => {
      const user = userEvent.setup()
      getSubscription.mockResolvedValueOnce(activeSubscription({ status: 'ACTIVE' }))
      cancelSubscription.mockResolvedValueOnce(activeSubscription({ status: 'CANCELLED' }))

      renderPage('/admin/configuration/subscriptions/s-1/edit')

      await screen.findByText('Edit Subscription')

      // The nav-away action is plain "Cancel" — distinct from the business action below.
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()

      const cancelSubscriptionButton = screen.getByRole('button', { name: 'Cancel Subscription' })
      await user.click(cancelSubscriptionButton)

      expect(screen.getByText('Cancel this subscription?')).toBeInTheDocument()
      expect(cancelSubscription).not.toHaveBeenCalled()

      // Dismissing the inline confirm uses "Keep subscription", not "Cancel" or "Don't cancel".
      await user.click(screen.getByRole('button', { name: 'Keep subscription' }))
      expect(screen.queryByText('Cancel this subscription?')).not.toBeInTheDocument()
      expect(cancelSubscription).not.toHaveBeenCalled()

      await user.click(screen.getByRole('button', { name: 'Cancel Subscription' }))
      await user.click(screen.getByRole('button', { name: 'Confirm cancel' }))

      expect(cancelSubscription).toHaveBeenCalledWith('s-1')
      expect(await screen.findByText('Subscription List Page')).toBeInTheDocument()
    },
    15000,
  )

  it('does not show a "Cancel Subscription" action for an already-cancelled subscription', async () => {
    getSubscription.mockResolvedValueOnce(activeSubscription({ status: 'CANCELLED' }))

    renderPage('/admin/configuration/subscriptions/s-1/edit')

    await screen.findByText('Edit Subscription')
    expect(screen.queryByRole('button', { name: 'Cancel Subscription' })).not.toBeInTheDocument()
    // The nav "Cancel" button is unaffected by subscription status.
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
  })

  it('renders an error state instead of a blank page when fetching the subscription fails', async () => {
    getSubscription.mockRejectedValueOnce(new Error('not found'))

    renderPage('/admin/configuration/subscriptions/s-1/edit')

    expect(await screen.findByText("Couldn't load this subscription")).toBeInTheDocument()
    expect(
      screen.getByText('Something went wrong loading this subscription. Please try again.'),
    ).toBeInTheDocument()
  })
})
