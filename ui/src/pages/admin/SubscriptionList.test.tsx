import { ThemeProvider } from '@mui/material/styles'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { vi } from 'vitest'
import SubscriptionList from './SubscriptionList'
import type {
  ListSubscriptionsParams,
  Page,
  ResendWelcomeEmailResult,
  Subscription,
} from '../../api/subscriptionApi'
import { baseTheme } from '../../theme'

const listSubscriptions = vi.fn()
const resendWelcomeEmail = vi.fn()

vi.mock('../../api/subscriptionApi', () => ({
  listSubscriptions: (params: ListSubscriptionsParams) => listSubscriptions(params),
  resendWelcomeEmail: (id: string) => resendWelcomeEmail(id),
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
    responsiblePerson: { id: 'person-1', firstName: 'Jane', lastName: 'Doe', email: 'jane.doe@example.com', phone: null },
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
    <ThemeProvider theme={baseTheme}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/admin/billing']}>
          <Routes>
            <Route path="/admin/billing" element={<SubscriptionList />} />
            <Route path="/admin/billing/new" element={<div>Add Subscription Page</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>,
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

  // docs/specs/019-resend-subscription-welcome-email.md
  it('renders "Resend welcome email" on an ACTIVE card', async () => {
    listSubscriptions.mockResolvedValueOnce(pageOf([makeSubscription()]))

    renderSubscriptionList()

    expect(await screen.findByRole('button', { name: 'Resend welcome email' })).toBeInTheDocument()
  })

  it('renders no resend action at all on a CANCELLED card', async () => {
    listSubscriptions.mockResolvedValueOnce(pageOf([makeSubscription({ status: 'CANCELLED' })]))

    renderSubscriptionList()

    await screen.findByText('Cancelled')
    expect(screen.queryByRole('button', { name: /resend/i })).not.toBeInTheDocument()
  })

  it('shows "Sending…" and disables the button while pending, then the success message in success.main', async () => {
    const user = userEvent.setup()
    listSubscriptions.mockResolvedValueOnce(pageOf([makeSubscription()]))
    let resolveResend: (value: ResendWelcomeEmailResult) => void = () => {}
    resendWelcomeEmail.mockImplementationOnce(
      () =>
        new Promise<ResendWelcomeEmailResult>((resolve) => {
          resolveResend = resolve
        }),
    )

    renderSubscriptionList()

    const button = await screen.findByRole('button', { name: 'Resend welcome email' })
    await user.click(button)

    expect(await screen.findByRole('button', { name: 'Sending…' })).toBeDisabled()
    expect(resendWelcomeEmail).toHaveBeenCalledWith('s-1')

    resolveResend({
      success: true,
      message: 'Welcome email resent to jane.doe@example.com.',
      sentTo: 'jane.doe@example.com',
    })

    const outcome = await screen.findByText('Welcome email resent to jane.doe@example.com.')
    expect(outcome).toHaveStyle({ color: 'rgb(14, 124, 102)' }) // theme.ts's success.main (#0e7c66)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Resend welcome email' })).not.toBeDisabled(),
    )
  })

  it('renders the error message in error.main for a success:false response', async () => {
    const user = userEvent.setup()
    listSubscriptions.mockResolvedValueOnce(pageOf([makeSubscription()]))
    resendWelcomeEmail.mockResolvedValueOnce({
      success: false,
      message: 'Failed to resend welcome email: Connection refused',
      sentTo: 'jane.doe@example.com',
    })

    renderSubscriptionList()

    await user.click(await screen.findByRole('button', { name: 'Resend welcome email' }))

    const outcome = await screen.findByText('Failed to resend welcome email: Connection refused')
    expect(outcome).toHaveStyle({ color: 'rgb(176, 64, 46)' }) // theme.ts's error.main (#b0402e)
  })

  it('renders a fallback error message in error.main when the resend request itself is rejected', async () => {
    const user = userEvent.setup()
    listSubscriptions.mockResolvedValueOnce(pageOf([makeSubscription()]))
    resendWelcomeEmail.mockRejectedValueOnce(new Error('network error'))

    renderSubscriptionList()

    await user.click(await screen.findByRole('button', { name: 'Resend welcome email' }))

    const outcome = await screen.findByText(
      'Something went wrong resending the welcome email. Please try again.',
    )
    expect(outcome).toHaveStyle({ color: 'rgb(176, 64, 46)' }) // theme.ts's error.main (#b0402e)
  })
})
