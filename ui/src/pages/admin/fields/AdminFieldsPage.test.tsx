import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminFieldsPage from './AdminFieldsPage'
import { fieldPage, makeField } from '../../../test/fieldFixtures'
import { problem } from '../../../test/publicAvailabilityTestUtils'

const listPlatformPlayingAreas = vi.fn()
const getPlatformPlayingAreasSummary = vi.fn()
const verifyPlayingArea = vi.fn()
const rejectPlayingArea = vi.fn()
const reopenPlayingArea = vi.fn()

vi.mock('../../../api/platformPlayingAreaApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/platformPlayingAreaApi')>()
  return {
    ...actual,
    listPlatformPlayingAreas: (params: unknown) => listPlatformPlayingAreas(params),
    getPlatformPlayingAreasSummary: () => getPlatformPlayingAreasSummary(),
    verifyPlayingArea: (id: string) => verifyPlayingArea(id),
    rejectPlayingArea: (id: string, reason: string) => rejectPlayingArea(id, reason),
    reopenPlayingArea: (id: string) => reopenPlayingArea(id),
  }
})

const QUEUED = makeField({ id: 'q-1', name: 'Away Park', verificationStatus: 'UNVERIFIED', createdByClubName: 'Riverside CC', linkedClubCount: 1, matchCount: 2 })

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  listPlatformPlayingAreas.mockResolvedValue(fieldPage([QUEUED]))
  getPlatformPlayingAreasSummary.mockResolvedValue({ unverified: 5, verified: 20, rejected: 2 })
  for (const fn of [verifyPlayingArea, rejectPlayingArea, reopenPlayingArea]) fn.mockResolvedValue({})
})

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/admin/fields']}>
        <AdminFieldsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const openMenu = async (user: ReturnType<typeof userEvent.setup>, name: string) => user.click(await screen.findByRole('button', { name: `Actions for ${name}` }))

const lastParams = () => listPlatformPlayingAreas.mock.calls[listPlatformPlayingAreas.mock.calls.length - 1][0] as Record<string, unknown>

// docs/specs/099-fields-directory.md (9) and docs/specs/134
describe('AdminFieldsPage', () => {
  it('opens on the Unverified queue, oldest first, with the three counters', async () => {
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Away Park' })).toBeInTheDocument()
    expect(lastParams()).toMatchObject({ page: 0, verification: 'UNVERIFIED' })
    expect(lastParams().sort).toBeUndefined()
    expect(screen.getByTestId('page-counter-UNVERIFIED')).toHaveTextContent('5')
    expect(screen.getByTestId('page-counter-UNVERIFIED')).toHaveAttribute('data-active', 'true')
    expect(screen.getByTestId('page-counter-VERIFIED')).toHaveTextContent('20')
    expect(screen.getByTestId('page-counter-REJECTED')).toHaveTextContent('2')
    expect(screen.queryByText(/Showing/)).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Fields To Verify' })).toBeInTheDocument()
  })

  it('choosing the Verified or Rejected counter asks the server for that state', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('heading', { name: 'Away Park' })

    await user.click(screen.getByTestId('page-counter-REJECTED'))
    await waitFor(() => expect(lastParams()).toMatchObject({ verification: 'REJECTED' }))
    await user.click(screen.getByTestId('page-counter-VERIFIED'))
    await waitFor(() => expect(lastParams()).toMatchObject({ verification: 'VERIFIED' }))
  })

  it('sends the debounced search, the Type and the Country as backend params, and the newest-first order', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('heading', { name: 'Away Park' })

    await user.type(screen.getByPlaceholderText('Search by field name or city'), 'park')
    await waitFor(() => expect(lastParams()).toMatchObject({ q: 'park' }), { timeout: 2000 })

    await user.click(screen.getByLabelText('Type'))
    await user.click(await screen.findByRole('option', { name: 'School' }))
    await waitFor(() => expect(lastParams()).toMatchObject({ category: 'SCHOOL' }))

    await user.click(screen.getByLabelText('Country'))
    await user.click(await screen.findByRole('option', { name: 'South Africa' }))
    await waitFor(() => expect(lastParams()).toMatchObject({ country: 'ZA' }))

    await user.click(screen.getByRole('button', { name: 'Sort: Oldest First' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Newest First' }))
    await waitFor(() => expect(lastParams()).toMatchObject({ sort: 'createdAt,desc' }))
  })

  it('shows the admin rows on the card: who captured it, the clubs and matches using it', async () => {
    renderPage()
    await screen.findByRole('heading', { name: 'Away Park' })

    const rows = screen.getAllByTestId('field-detail-row').map((row) => row.textContent)
    expect(rows).toContain('CapturedRiverside CC')
    expect(rows).toContain('Clubs1 club · 2 matches')
  })

  it('Verify acts at once and refreshes the queue and the counters', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('heading', { name: 'Away Park' })
    const callsBefore = listPlatformPlayingAreas.mock.calls.length

    await openMenu(user, 'Away Park')
    await user.click(screen.getByRole('menuitem', { name: 'Verify' }))

    await waitFor(() => expect(verifyPlayingArea).toHaveBeenCalledWith('q-1'))
    await waitFor(() => expect(listPlatformPlayingAreas.mock.calls.length).toBeGreaterThan(callsBefore))
    expect(getPlatformPlayingAreasSummary.mock.calls.length).toBeGreaterThan(1)
  })

  it('Reject needs a reason first and sends it', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('heading', { name: 'Away Park' })

    await openMenu(user, 'Away Park')
    await user.click(screen.getByRole('menuitem', { name: /Reject/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Reject this field?' })
    expect(within(dialog).getByRole('button', { name: 'Reject field' })).toBeDisabled()
    await user.type(within(dialog).getByLabelText(/Reason for rejecting/), 'Duplicate of Hilton Oval')
    await user.click(within(dialog).getByRole('button', { name: 'Reject field' }))

    await waitFor(() => expect(rejectPlayingArea).toHaveBeenCalledWith('q-1', 'Duplicate of Hilton Oval'))
  })

  it('Reopen is the only change on a rejected field', async () => {
    const user = userEvent.setup()
    listPlatformPlayingAreas.mockResolvedValue(fieldPage([makeField({ id: 'r-1', name: 'Old Ground', verificationStatus: 'REJECTED' })]))
    renderPage()
    await screen.findByRole('heading', { name: 'Old Ground' })

    await openMenu(user, 'Old Ground')
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['Open Field', 'Edit Field', 'Open In Maps', 'Reopen'])
    await user.click(screen.getByRole('menuitem', { name: 'Reopen' }))

    await waitFor(() => expect(reopenPlayingArea).toHaveBeenCalledWith('r-1'))
  })

  it('keeps a disabled Change Status item, with its reason, on a verified field', async () => {
    const user = userEvent.setup()
    listPlatformPlayingAreas.mockResolvedValue(fieldPage([makeField({ id: 'v-1', name: 'Good Ground', verificationStatus: 'VERIFIED' })]))
    renderPage()
    await screen.findByRole('heading', { name: 'Good Ground' })

    await openMenu(user, 'Good Ground')

    const status = await screen.findByRole('menuitem', { name: /Change Status/ })
    expect(status).toHaveAttribute('aria-disabled', 'true')
    expect(status).toHaveTextContent('A verified field has no status changes.')
  })

  it('the kebab offers Open Field, an always-enabled Edit Field and Open In Maps, with no Merge and no Share', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('heading', { name: 'Away Park' })

    await openMenu(user, 'Away Park')

    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['Open Field', 'Edit Field', 'Open In Maps', 'Verify', 'Reject'])
    expect(screen.getByRole('menuitem', { name: 'Edit Field' })).toHaveAttribute('href', '/admin/fields/q-1/edit?returnTo=%2Fadmin%2Ffields&returnLabel=Fields')
    expect(screen.getByRole('menuitem', { name: 'Open Field' })).toHaveAttribute('href', '/admin/fields/q-1?returnTo=%2Fadmin%2Ffields&returnLabel=Fields')
  })

  it('has no card footer bar, no Add Field and no dashed Add card', async () => {
    renderPage()
    await screen.findByRole('heading', { name: 'Away Park' })

    expect(screen.queryByRole('link', { name: 'View' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Change status' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add Field' })).not.toBeInTheDocument()
    expect(screen.queryByTestId('add-field-card')).not.toBeInTheDocument()
  })

  it('shows the server\'s reason when a change is refused', async () => {
    const user = userEvent.setup()
    verifyPlayingArea.mockRejectedValue(problem(409, { detail: 'Field is rejected' }))
    renderPage()
    await screen.findByRole('heading', { name: 'Away Park' })

    await openMenu(user, 'Away Park')
    await user.click(screen.getByRole('menuitem', { name: 'Verify' }))

    expect(await screen.findByText('Field is rejected')).toBeInTheDocument()
  })

  it('switches to the list view and remembers it under adminFieldList:view', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('heading', { name: 'Away Park' })

    await user.click(screen.getByRole('button', { name: 'List' }))

    expect(await screen.findByRole('table', { name: 'Fields' })).toBeInTheDocument()
    expect(screen.getByTestId('fields-fused-card')).toBeInTheDocument()
    expect(localStorage.getItem('adminFieldList:view')).toBe('list')
    expect(screen.getByRole('link', { name: 'Away Park' })).toHaveAttribute('href', '/admin/fields/q-1?returnTo=%2Fadmin%2Ffields&returnLabel=Fields')
  })

  it('pages with the backend and shows an empty state', async () => {
    const user = userEvent.setup()
    listPlatformPlayingAreas.mockImplementation((params: { page: number }) =>
      Promise.resolve(fieldPage([makeField({ id: `f${params.page}`, name: `Queued ${params.page}`, verificationStatus: 'UNVERIFIED' })], { totalElements: 30, totalPages: 2, number: params.page })),
    )
    renderPage()
    await screen.findByText('Queued 0')
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(await screen.findByText('Queued 1')).toBeInTheDocument()
    expect(lastParams()).toMatchObject({ page: 1 })
  })

  it('says there is nothing in the queue', async () => {
    listPlatformPlayingAreas.mockResolvedValue(fieldPage([]))
    renderPage()
    const title = await screen.findByText('Nothing here')
    expect(title).toBeInTheDocument()
    expect(within(title.parentElement as HTMLElement).queryByRole('button')).not.toBeInTheDocument()
  })

  it('shows an error when the queue cannot be loaded', async () => {
    listPlatformPlayingAreas.mockRejectedValue(new Error('boom'))
    renderPage()
    expect(await screen.findByText("Couldn't load fields")).toBeInTheDocument()
  })
})
