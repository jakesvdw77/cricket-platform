import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SubscriptionFormPage from './SubscriptionFormPage'
import type { Subscription } from '../../api/subscriptionApi'
import type { ListClubsParams } from '../../api/clubApi'
import type { ListPersonsParams } from '../../api/personApi'

const getSubscription = vi.fn()
const createSubscription = vi.fn()
const updateSubscription = vi.fn()
const cancelSubscription = vi.fn()
const listClubs = vi.fn()
const createClub = vi.fn()
const listProducts = vi.fn()
const listPersons = vi.fn()

vi.mock('../../api/subscriptionApi', () => ({
  getSubscription: (id: string) => getSubscription(id),
  createSubscription: (payload: unknown) => createSubscription(payload),
  updateSubscription: (id: string, payload: unknown) => updateSubscription(id, payload),
  cancelSubscription: (id: string) => cancelSubscription(id),
}))

vi.mock('../../api/clubApi', () => ({
  listClubs: (params: ListClubsParams) => listClubs(params),
  createClub: (payload: unknown) => createClub(payload),
}))

vi.mock('../../api/productApi', () => ({
  listProducts: (params: unknown) => listProducts(params),
}))

vi.mock('../../api/personApi', () => ({
  listPersons: (params: ListPersonsParams) => listPersons(params),
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
  // Default on-focus list shows one ACTIVE club; any typed search (this suite's new-club tests
  // all search for a name deliberately absent from this list) returns no matches, driving
  // ClubPicker's "+ Add" affordance.
  listClubs.mockImplementation((params: ListClubsParams) =>
    Promise.resolve(
      params.search
        ? { content: [], totalElements: 0, totalPages: 1, number: 0, size: 10 }
        : {
            content: [{ id: 'club-1', name: 'Riverside CC', slug: 'riverside-cc', status: 'ACTIVE' }],
            totalElements: 1,
            totalPages: 1,
            number: 0,
            size: 10,
          },
    ),
  )
  // PersonPicker's on-focus default list is empty by default, driving its own "+ Add" affordance
  // in every create-mode test below that adds a person inline.
  listPersons.mockResolvedValue({ content: [], totalElements: 0, totalPages: 1, number: 0, size: 10 })
})

const RESPONSIBLE_PERSON = {
  id: 'person-1',
  firstName: 'Jane',
  lastName: 'Doe',
  email: 'jane.doe@example.com',
  phone: '021 555 0100',
}

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
    responsiblePerson: RESPONSIBLE_PERSON,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: null,
    ...overrides,
  }
}

// Fills PersonPicker's create-mode fields, visible by default — used by every create-mode
// submit test below, since 014 makes a resolved selection required on create.
async function fillNewResponsiblePerson(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('First name'), 'Jane')
  await user.type(screen.getByLabelText('Last name'), 'Doe')
  await user.type(screen.getByLabelText('Email'), 'jane.doe@example.com')
  await user.type(screen.getByLabelText('Phone'), '021 555 0100')
}

const RESPONSIBLE_PERSON_PAYLOAD = {
  firstName: 'Jane',
  lastName: 'Doe',
  email: 'jane.doe@example.com',
  phone: '021 555 0100',
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

async function waitForDebounce() {
  await new Promise((resolve) => setTimeout(resolve, 350))
}

function todayIso(): string {
  const today = new Date()
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
}

describe('SubscriptionFormPage', () => {
  it(
    'create mode, existing club (regression): submit calls createSubscription with no createClub call, then navigates to the list',
    async () => {
      const user = userEvent.setup()
      createSubscription.mockResolvedValueOnce(activeSubscription())

      renderPage('/admin/configuration/subscriptions/new')

      expect(screen.getByText('Add Subscription')).toBeInTheDocument()
      expect(getSubscription).not.toHaveBeenCalled()

      await user.click(screen.getByLabelText('Club'))
      await user.click(await screen.findByRole('option', { name: 'Riverside CC' }))

      await user.click(screen.getByLabelText('Product'))
      await user.click(await screen.findByRole('option', { name: /Club Standard/ }))

      await fillNewResponsiblePerson(user)

      await user.click(screen.getByRole('button', { name: 'Create subscription' }))

      expect(await screen.findByText('Subscription List Page')).toBeInTheDocument()

      expect(createClub).not.toHaveBeenCalled()
      expect(createSubscription).toHaveBeenCalledTimes(1)
      expect(createSubscription).toHaveBeenCalledWith({
        ownerType: 'CLUB',
        ownerId: 'club-1',
        productId: 'prod-1',
        startDate: todayIso(),
        endDate: null,
        responsiblePerson: RESPONSIBLE_PERSON_PAYLOAD,
      })
    },
    15000,
  )

  it(
    'create mode, new club: calls createClub then createSubscription in order, using the created club id as ownerId',
    async () => {
      const user = userEvent.setup()
      createClub.mockResolvedValueOnce({
        id: 'club-new',
        name: 'Meadowbrook CC',
        slug: 'meadowbrook-cc',
        status: 'ACTIVE',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        updatedBy: null,
      })
      createSubscription.mockResolvedValueOnce(activeSubscription({ ownerId: 'club-new' }))

      renderPage('/admin/configuration/subscriptions/new')

      // Captured once and reused below — once the dropdown is open, MUI's Autocomplete listbox
      // also carries an aria-labelledby pointing at the same "Club" label, so a second
      // getByLabelText('Club') call becomes ambiguous (matches both the input and the listbox).
      const clubField = screen.getByLabelText('Club')
      await user.click(clubField)
      await user.type(clubField, 'Meadowbrook CC')
      await waitForDebounce()
      await user.click(await screen.findByRole('button', { name: '+ Add "Meadowbrook CC" as a new club' }))

      expect(screen.getByLabelText('Name')).toHaveValue('Meadowbrook CC')
      expect(screen.getByLabelText('Slug')).toHaveValue('meadowbrook-cc')

      await user.click(screen.getByLabelText('Product'))
      await user.click(await screen.findByRole('option', { name: /Club Standard/ }))

      await fillNewResponsiblePerson(user)

      await user.click(screen.getByRole('button', { name: 'Create subscription' }))

      expect(await screen.findByText('Subscription List Page')).toBeInTheDocument()

      expect(createClub).toHaveBeenCalledTimes(1)
      expect(createClub).toHaveBeenCalledWith({ name: 'Meadowbrook CC', slug: 'meadowbrook-cc' })
      expect(createSubscription).toHaveBeenCalledTimes(1)
      expect(createSubscription).toHaveBeenCalledWith({
        ownerType: 'CLUB',
        ownerId: 'club-new',
        productId: 'prod-1',
        startDate: todayIso(),
        endDate: null,
        responsiblePerson: RESPONSIBLE_PERSON_PAYLOAD,
      })

      // createClub must resolve before createSubscription is ever invoked.
      const createClubOrder = createClub.mock.invocationCallOrder[0]
      const createSubscriptionOrder = createSubscription.mock.invocationCallOrder[0]
      expect(createClubOrder).toBeLessThan(createSubscriptionOrder)
    },
    15000,
  )

  it(
    'a createClub rejection blocks createSubscription entirely and surfaces the detail message against the Slug field, not the generic banner',
    async () => {
      const user = userEvent.setup()
      createClub.mockRejectedValueOnce({
        isAxiosError: true,
        response: { data: { detail: 'Club slug is reserved: meadowbrook-cc' } },
      })

      renderPage('/admin/configuration/subscriptions/new')

      const clubField = screen.getByLabelText('Club')
      await user.click(clubField)
      await user.type(clubField, 'Meadowbrook CC')
      await waitForDebounce()
      await user.click(await screen.findByRole('button', { name: '+ Add "Meadowbrook CC" as a new club' }))

      await user.click(screen.getByLabelText('Product'))
      await user.click(await screen.findByRole('option', { name: /Club Standard/ }))

      await fillNewResponsiblePerson(user)

      await user.click(screen.getByRole('button', { name: 'Create subscription' }))

      expect(await screen.findByText('Club slug is reserved: meadowbrook-cc')).toBeInTheDocument()
      expect(createSubscription).not.toHaveBeenCalled()
      expect(
        screen.queryByText('Something went wrong saving this subscription. Please try again.'),
      ).not.toBeInTheDocument()
    },
    15000,
  )

  it(
    'a createClub success followed by a createSubscription rejection still shows the existing generic banner',
    async () => {
      const user = userEvent.setup()
      createClub.mockResolvedValueOnce({
        id: 'club-new',
        name: 'Meadowbrook CC',
        slug: 'meadowbrook-cc',
        status: 'ACTIVE',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        updatedBy: null,
      })
      createSubscription.mockRejectedValueOnce({
        isAxiosError: true,
        response: { data: { detail: 'Club already has an active subscription' } },
      })

      renderPage('/admin/configuration/subscriptions/new')

      const clubField = screen.getByLabelText('Club')
      await user.click(clubField)
      await user.type(clubField, 'Meadowbrook CC')
      await waitForDebounce()
      await user.click(await screen.findByRole('button', { name: '+ Add "Meadowbrook CC" as a new club' }))

      await user.click(screen.getByLabelText('Product'))
      await user.click(await screen.findByRole('option', { name: /Club Standard/ }))

      await fillNewResponsiblePerson(user)

      await user.click(screen.getByRole('button', { name: 'Create subscription' }))

      expect(await screen.findByText('Club already has an active subscription')).toBeInTheDocument()
      expect(createClub).toHaveBeenCalledTimes(1)
    },
    15000,
  )

  it('edit mode: fetches and pre-fills the subscription, and submit calls updateSubscription (with no person-related field) then navigates to the list', async () => {
    const user = userEvent.setup()
    getSubscription.mockResolvedValueOnce(activeSubscription())
    updateSubscription.mockResolvedValueOnce(activeSubscription())

    renderPage('/admin/configuration/subscriptions/s-1/edit')

    expect(await screen.findByText('Edit Subscription')).toBeInTheDocument()
    expect(getSubscription).toHaveBeenCalledWith('s-1')
    expect(await screen.findByDisplayValue('Riverside CC')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Jane Doe — jane.doe@example.com')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(updateSubscription).toHaveBeenCalledTimes(1)
    const [id, payload] = updateSubscription.mock.calls[0]
    expect(id).toBe('s-1')
    // UpdateSubscriptionPayload carries no person-related field at all — who's responsible for a
    // Subscription cannot be changed through this endpoint.
    expect(payload).toEqual({ productId: 'prod-1', startDate: '2026-01-01', endDate: null })

    expect(createClub).not.toHaveBeenCalled()
    expect(await screen.findByText('Subscription List Page')).toBeInTheDocument()
  })

  it('edit mode disables the Club and Responsible person fields, and never fires a club or person search query', async () => {
    getSubscription.mockResolvedValueOnce(activeSubscription())

    renderPage('/admin/configuration/subscriptions/s-1/edit')

    const clubField = await screen.findByDisplayValue('Riverside CC')
    expect(clubField).toBeDisabled()
    const responsibleField = screen.getByDisplayValue('Jane Doe — jane.doe@example.com')
    expect(responsibleField).toBeDisabled()

    await waitForDebounce()
    expect(listClubs).not.toHaveBeenCalled()
    expect(listPersons).not.toHaveBeenCalled()
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

  it(
    "surfaces the backend's specific detail message in the save-error banner instead of a generic one",
    async () => {
      const user = userEvent.setup()
      createSubscription.mockRejectedValueOnce({
        isAxiosError: true,
        response: { data: { detail: 'Club already has an active subscription' } },
      })

      renderPage('/admin/configuration/subscriptions/new')

      await user.click(screen.getByLabelText('Club'))
      await user.click(await screen.findByRole('option', { name: 'Riverside CC' }))
      await user.click(screen.getByLabelText('Product'))
      await user.click(await screen.findByRole('option', { name: /Club Standard/ }))
      await fillNewResponsiblePerson(user)
      await user.click(screen.getByRole('button', { name: 'Create subscription' }))

      expect(await screen.findByText('Club already has an active subscription')).toBeInTheDocument()
    },
    15000,
  )

  it('falls back to a generic save-error message when the failure is not a ProblemDetail response', async () => {
    const user = userEvent.setup()
    createSubscription.mockRejectedValueOnce(new Error('network error'))

    renderPage('/admin/configuration/subscriptions/new')

    await user.click(screen.getByLabelText('Club'))
    await user.click(await screen.findByRole('option', { name: 'Riverside CC' }))
    await user.click(screen.getByLabelText('Product'))
    await user.click(await screen.findByRole('option', { name: /Club Standard/ }))
    await fillNewResponsiblePerson(user)
    await user.click(screen.getByRole('button', { name: 'Create subscription' }))

    expect(
      await screen.findByText('Something went wrong saving this subscription. Please try again.'),
    ).toBeInTheDocument()
  })

  it("surfaces the backend's specific detail message in the cancel-error banner instead of a generic one", async () => {
    const user = userEvent.setup()
    getSubscription.mockResolvedValueOnce(activeSubscription())
    cancelSubscription.mockRejectedValueOnce({
      isAxiosError: true,
      response: { data: { detail: 'Subscription is already cancelled' } },
    })

    renderPage('/admin/configuration/subscriptions/s-1/edit')

    await screen.findByText('Edit Subscription')
    await user.click(screen.getByRole('button', { name: 'Cancel Subscription' }))
    await user.click(screen.getByRole('button', { name: 'Confirm cancel' }))

    expect(await screen.findByText('Subscription is already cancelled')).toBeInTheDocument()
  })
})
