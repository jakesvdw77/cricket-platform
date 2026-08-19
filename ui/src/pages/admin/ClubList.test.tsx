import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { vi } from 'vitest'
import ClubList from './ClubList'
import type { Club, ListClubsParams, Page } from '../../api/clubApi'

const listClubs = vi.fn()

vi.mock('../../api/clubApi', () => ({
  listClubs: (params: ListClubsParams) => listClubs(params),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

function makeClub(overrides: Partial<Club> = {}): Club {
  return {
    id: 'c-1',
    name: 'Riverside Cricket Club',
    slug: 'riverside-cc',
    status: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: null,
    ...overrides,
  }
}

function emptyPage(): Page<Club> {
  return { content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 }
}

function pageOf(content: Club[], totalPages = 1, number = 0): Page<Club> {
  return { content, totalElements: content.length, totalPages, number, size: 20 }
}

function renderClubList() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/admin/onboarding']}>
        <Routes>
          <Route path="/admin/onboarding" element={<ClubList />} />
          <Route path="/admin/onboarding/new" element={<div>Add Club Page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

async function waitForDebounce() {
  // ClubList debounces search into the query key ~300ms — see SEARCH_DEBOUNCE_MS.
  await new Promise((resolve) => setTimeout(resolve, 350))
}

describe('ClubList', () => {
  it('renders a paginated list of clubs via RecordCard with the default name sort', async () => {
    listClubs.mockResolvedValueOnce(pageOf([makeClub()]))

    renderClubList()

    expect(await screen.findByText('Riverside Cricket Club')).toBeInTheDocument()
    expect(screen.getByText('riverside-cc')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(listClubs).toHaveBeenLastCalledWith({ page: 0, search: undefined, sort: 'name,asc' })
  })

  it.each([
    ['ACTIVE', 'Active'],
    ['SUSPENDED', 'Suspended'],
    ['ONBOARDING', 'Onboarding'],
  ] as const)('shows the %s status badge as "%s"', async (status, label) => {
    listClubs.mockResolvedValueOnce(pageOf([makeClub({ status })]))

    renderClubList()

    expect(await screen.findByText(label)).toBeInTheDocument()
  })

  it('renders the empty state when there are no clubs', async () => {
    listClubs.mockResolvedValueOnce(emptyPage())

    renderClubList()

    expect(await screen.findByText('No clubs yet')).toBeInTheDocument()
  })

  it('renders an error state instead of a blank page when the fetch fails', async () => {
    listClubs.mockRejectedValueOnce(new Error('network error'))

    renderClubList()

    expect(await screen.findByText("Couldn't load clubs")).toBeInTheDocument()
    expect(
      screen.getByText('Something went wrong loading the club list. Please try again.'),
    ).toBeInTheDocument()
  })

  it('debounces search input into the query as the search param', async () => {
    listClubs.mockResolvedValueOnce(pageOf([makeClub()]))

    renderClubList()
    await screen.findByText('Riverside Cricket Club')

    listClubs.mockResolvedValueOnce(emptyPage())
    // A single atomic change (rather than per-keystroke typing) keeps this deterministic under
    // a loaded test run — the behaviour under test is the debounce window, not typing.
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'zzz' } })

    // Not queried again until the debounce window elapses.
    expect(listClubs).toHaveBeenCalledTimes(1)

    await waitForDebounce()

    expect(await screen.findByText('No matching clubs')).toBeInTheDocument()
    expect(listClubs).toHaveBeenLastCalledWith({ page: 0, search: 'zzz', sort: 'name,asc' })
  })

  it('re-queries with the selected sort value', async () => {
    const user = userEvent.setup()
    listClubs.mockResolvedValueOnce(pageOf([makeClub()]))

    renderClubList()
    await screen.findByText('Riverside Cricket Club')

    listClubs.mockResolvedValueOnce(pageOf([makeClub()]))
    await user.click(screen.getByLabelText('Sort by'))
    await user.click(await screen.findByRole('option', { name: 'Created date' }))

    expect(await screen.findByText('Riverside Cricket Club')).toBeInTheDocument()
    expect(listClubs).toHaveBeenLastCalledWith({ page: 0, search: undefined, sort: 'createdAt,desc' })
  })

  it('navigates to the create route via "Add Club"', async () => {
    const user = userEvent.setup()
    listClubs.mockResolvedValueOnce(pageOf([makeClub()]))

    renderClubList()
    await screen.findByText('Riverside Cricket Club')

    await user.click(screen.getByRole('button', { name: 'Add Club' }))

    expect(await screen.findByText('Add Club Page')).toBeInTheDocument()
  })

  it('Prev/Next controls respect totalPages', async () => {
    const user = userEvent.setup()
    listClubs.mockResolvedValueOnce(pageOf([makeClub({ id: 'c-1', name: 'Page One Club' })], 2, 0))

    renderClubList()
    await screen.findByText('Page One Club')

    const prevButton = screen.getByRole('button', { name: 'Previous' })
    const nextButton = screen.getByRole('button', { name: 'Next' })
    expect(prevButton).toBeDisabled()
    expect(nextButton).not.toBeDisabled()

    listClubs.mockResolvedValueOnce(pageOf([makeClub({ id: 'c-2', name: 'Page Two Club' })], 2, 1))
    await user.click(nextButton)

    expect(await screen.findByText('Page Two Club')).toBeInTheDocument()
    expect(listClubs).toHaveBeenLastCalledWith({ page: 1, search: undefined, sort: 'name,asc' })
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
  })
})
