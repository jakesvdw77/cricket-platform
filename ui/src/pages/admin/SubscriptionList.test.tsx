import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { vi } from 'vitest'
import SubscriptionList from './SubscriptionList'
import type { ListSubscriptionsParams, Page, Subscription } from '../../api/subscriptionApi'

const listSubscriptions = vi.fn()

vi.mock('../../api/subscriptionApi', () => ({
  listSubscriptions: (params: ListSubscriptionsParams) => listSubscriptions(params),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

function makeSubscription(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: 's-1',
    ownerType: 'CLUB',
    ownerId: 'club-1',
    club: { id: 'club-1', name: 'Riverside CC', slug: 'riverside-cc' },
    product: { id: 'prod-1', name: 'Club Standard', code: 'CLUB_STANDARD' },
    status: 'ACTIVE',
    startDate: '2026-01-01',
    endDate: null,
    responsibleContact: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: null,
    ...overrides,
  }
}

function emptyPage(): Page<Subscription> {
  return { content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 }
}

function pageOf(content: Subscription[], totalPages = 1, number = 0): Page<Subscription> {
  return { content, totalElements: content.length, totalPages, number, size: 20 }
}

function renderSubscriptionList() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/admin/configuration/subscriptions']}>
        <Routes>
          <Route path="/admin/configuration/subscriptions" element={<SubscriptionList />} />
          <Route path="/admin/configuration/subscriptions/new" element={<div>Add Subscription Page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

async function waitForDebounce() {
  // SubscriptionList debounces search into the query key ~300ms — see SEARCH_DEBOUNCE_MS.
  await new Promise((resolve) => setTimeout(resolve, 350))
}

describe('SubscriptionList', () => {
  it('renders a paginated list of subscriptions via RecordCard, defaulting to startDate,desc sort', async () => {
    listSubscriptions.mockResolvedValueOnce(pageOf([makeSubscription()]))

    renderSubscriptionList()

    expect(await screen.findByText('Riverside CC')).toBeInTheDocument()
    expect(screen.getByText('Club Standard')).toBeInTheDocument()
    expect(screen.getByText('CLUB_STANDARD')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(listSubscriptions).toHaveBeenLastCalledWith({ page: 0, search: undefined, sort: 'startDate,desc' })
  })

  it('renders a Cancelled badge for a cancelled subscription', async () => {
    listSubscriptions.mockResolvedValueOnce(pageOf([makeSubscription({ status: 'CANCELLED' })]))

    renderSubscriptionList()

    expect(await screen.findByText('Cancelled')).toBeInTheDocument()
  })

  it('renders the empty state when there are no subscriptions', async () => {
    listSubscriptions.mockResolvedValueOnce(emptyPage())

    renderSubscriptionList()

    expect(await screen.findByText('No subscriptions yet')).toBeInTheDocument()
  })

  it('renders an error state instead of a blank page when the fetch fails', async () => {
    listSubscriptions.mockRejectedValueOnce(new Error('network error'))

    renderSubscriptionList()

    expect(await screen.findByText("Couldn't load subscriptions")).toBeInTheDocument()
    expect(
      screen.getByText('Something went wrong loading the subscription list. Please try again.'),
    ).toBeInTheDocument()
  })

  it('debounces search input into the query as the search param', async () => {
    listSubscriptions.mockResolvedValueOnce(pageOf([makeSubscription()]))

    renderSubscriptionList()
    await screen.findByText('Riverside CC')

    listSubscriptions.mockResolvedValueOnce(emptyPage())
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'zzz' } })

    expect(listSubscriptions).toHaveBeenCalledTimes(1)

    await waitForDebounce()

    expect(await screen.findByText('No matching subscriptions')).toBeInTheDocument()
    expect(listSubscriptions).toHaveBeenLastCalledWith({ page: 0, search: 'zzz', sort: 'startDate,desc' })
  })

  it('re-queries with the selected sort value', async () => {
    const user = userEvent.setup()
    listSubscriptions.mockResolvedValueOnce(pageOf([makeSubscription()]))

    renderSubscriptionList()
    await screen.findByText('Riverside CC')

    listSubscriptions.mockResolvedValueOnce(pageOf([makeSubscription()]))
    await user.click(screen.getByLabelText('Sort by'))
    await user.click(await screen.findByRole('option', { name: 'Club name' }))

    expect(await screen.findByText('Riverside CC')).toBeInTheDocument()
    expect(listSubscriptions).toHaveBeenLastCalledWith({ page: 0, search: undefined, sort: 'club.name,asc' })
  })

  it('navigates to the create route via "Add Subscription"', async () => {
    const user = userEvent.setup()
    listSubscriptions.mockResolvedValueOnce(pageOf([makeSubscription()]))

    renderSubscriptionList()
    await screen.findByText('Riverside CC')

    await user.click(screen.getByRole('button', { name: 'Add Subscription' }))

    expect(await screen.findByText('Add Subscription Page')).toBeInTheDocument()
  })

  it('Prev/Next controls respect totalPages', async () => {
    const user = userEvent.setup()
    listSubscriptions.mockResolvedValueOnce(
      pageOf([makeSubscription({ id: 's-1', club: { id: 'club-1', name: 'Page One Club', slug: 'page-one' } })], 2, 0),
    )

    renderSubscriptionList()
    await screen.findByText('Page One Club')

    const prevButton = screen.getByRole('button', { name: 'Previous' })
    const nextButton = screen.getByRole('button', { name: 'Next' })
    expect(prevButton).toBeDisabled()
    expect(nextButton).not.toBeDisabled()

    listSubscriptions.mockResolvedValueOnce(
      pageOf([makeSubscription({ id: 's-2', club: { id: 'club-2', name: 'Page Two Club', slug: 'page-two' } })], 2, 1),
    )
    await user.click(nextButton)

    expect(await screen.findByText('Page Two Club')).toBeInTheDocument()
    expect(listSubscriptions).toHaveBeenLastCalledWith({ page: 1, search: undefined, sort: 'startDate,desc' })
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
  })
})
