import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SponsorList from './SponsorList'
import type { Sponsor } from '../../api/sponsorApi'

const listSponsors = vi.fn()
const deactivateSponsor = vi.fn()
const reactivateSponsor = vi.fn()

// Mirrors ClubContactList.test.tsx's mock-every-export-individually pattern.
vi.mock('../../api/sponsorApi', () => ({
  listSponsors: (clubId: string) => listSponsors(clubId),
  deactivateSponsor: (clubId: string, sponsorId: string) => deactivateSponsor(clubId, sponsorId),
  reactivateSponsor: (clubId: string, sponsorId: string) => reactivateSponsor(clubId, sponsorId),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

function makeSponsor(overrides: Partial<Sponsor> = {}): Sponsor {
  return {
    id: 'sponsor-1',
    clubId: 'test-club-id',
    name: 'Riverside Hardware',
    website: 'https://riverside-hardware.example.com',
    email: 'sponsor@riverside-hardware.example.com',
    phone: '+27 21 555 0177',
    logoUrl: null,
    bannerUrl: null,
    socialLinks: [],
    active: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: null,
    ...overrides,
  }
}

// SponsorList reads clubId via useOutletContext, not useParams (normally threaded through by
// ManagerHome's own <Outlet context={{ clubId }} />) — same wrapper-route shape as
// ClubContactList.test.tsx, reproduced here without pulling ManagerHome in.
function OutletContextWrapper({ clubId }: { clubId?: string }) {
  return <Outlet context={{ clubId }} />
}

function renderList(clubId?: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/manage/sponsors']}>
        <Routes>
          <Route path="/manage" element={<OutletContextWrapper clubId={clubId} />}>
            <Route path="sponsors" element={<SponsorList />} />
            <Route path="sponsors/new" element={<div>Add Sponsor Page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('SponsorList', () => {
  it('renders "Not authorized" and does not fetch when no clubId is in the Outlet context', () => {
    renderList(undefined)

    expect(screen.getByText('Not authorized')).toBeInTheDocument()
    expect(screen.getByText('No club is associated with your account.')).toBeInTheDocument()
    expect(listSponsors).not.toHaveBeenCalled()
  })

  it('renders nothing while the list is loading', () => {
    listSponsors.mockReturnValueOnce(new Promise(() => {}))

    renderList('test-club-id')

    expect(screen.queryByText('No sponsors yet')).not.toBeInTheDocument()
    expect(screen.queryByText('Not authorized')).not.toBeInTheDocument()
  })

  it('renders an error state when the fetch fails', async () => {
    listSponsors.mockRejectedValueOnce(new Error('network error'))

    renderList('test-club-id')

    expect(await screen.findByText("Couldn't load sponsors")).toBeInTheDocument()
    expect(
      screen.getByText("Something went wrong loading your club's sponsors. Please try again."),
    ).toBeInTheDocument()
  })

  it('renders the "No sponsors yet" empty state when the club has no sponsors', async () => {
    listSponsors.mockResolvedValueOnce([])

    renderList('test-club-id')

    expect(await screen.findByText('No sponsors yet')).toBeInTheDocument()
  })

  it('renders a card per sponsor with the correct name, fields, and active/inactive badge', async () => {
    listSponsors.mockResolvedValueOnce([
      makeSponsor({ id: 'sponsor-1' }),
      makeSponsor({
        id: 'sponsor-2',
        name: 'Past Sponsor Co',
        website: null,
        email: null,
        phone: null,
        active: false,
      }),
    ])

    renderList('test-club-id')

    expect(await screen.findByText('Riverside Hardware')).toBeInTheDocument()
    expect(screen.getByText('https://riverside-hardware.example.com')).toBeInTheDocument()
    expect(screen.getByText('sponsor@riverside-hardware.example.com')).toBeInTheDocument()
    expect(screen.getByText('+27 21 555 0177')).toBeInTheDocument()

    expect(screen.getByText('Past Sponsor Co')).toBeInTheDocument()
    expect(screen.getByText('Inactive')).toBeInTheDocument()
  })

  it('filters cards by the search term (matched against name)', async () => {
    const user = userEvent.setup()
    listSponsors.mockResolvedValueOnce([
      makeSponsor({ id: 'sponsor-1', name: 'Riverside Hardware' }),
      makeSponsor({ id: 'sponsor-2', name: 'Southside Motors' }),
    ])

    renderList('test-club-id')

    await screen.findByText('Riverside Hardware')
    expect(screen.getByText('Southside Motors')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'riverside' } })

    expect(await screen.findByText('Riverside Hardware')).toBeInTheDocument()
    expect(screen.queryByText('Southside Motors')).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'zzz' } })

    expect(await screen.findByText('No matching sponsors')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Add Sponsor' }))
    expect(await screen.findByText('Add Sponsor Page')).toBeInTheDocument()
  })

  it('clicking Deactivate on an active sponsor calls deactivateSponsor and reflects a pending state', async () => {
    const user = userEvent.setup()
    listSponsors.mockResolvedValueOnce([makeSponsor({ active: true })])
    let resolveDeactivate: (value: Sponsor) => void = () => {}
    deactivateSponsor.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveDeactivate = resolve
      }),
    )
    // onSuccess invalidates the list query while this card is still mounted, triggering a
    // refetch that also needs a value to resolve to — same gotcha as ClubContactList.test.tsx's
    // own equivalent case.
    listSponsors.mockResolvedValueOnce([makeSponsor({ active: false })])

    renderList('test-club-id')

    await screen.findByText('Riverside Hardware')
    await user.click(screen.getByRole('button', { name: 'Deactivate' }))

    expect(deactivateSponsor).toHaveBeenCalledWith('test-club-id', 'sponsor-1')
    expect(await screen.findByRole('button', { name: 'Deactivating…' })).toBeInTheDocument()

    resolveDeactivate(makeSponsor({ active: false }))

    expect(await screen.findByRole('button', { name: 'Reactivate' })).toBeInTheDocument()
  })

  it('clicking Reactivate on an inactive sponsor calls reactivateSponsor', async () => {
    const user = userEvent.setup()
    listSponsors.mockResolvedValueOnce([makeSponsor({ active: false })])
    reactivateSponsor.mockResolvedValueOnce(makeSponsor({ active: true }))
    // onSuccess invalidates the list query, triggering a refetch.
    listSponsors.mockResolvedValueOnce([makeSponsor({ active: true })])

    renderList('test-club-id')

    await screen.findByText('Riverside Hardware')
    await user.click(screen.getByRole('button', { name: 'Reactivate' }))

    expect(reactivateSponsor).toHaveBeenCalledWith('test-club-id', 'sponsor-1')
  })
})
