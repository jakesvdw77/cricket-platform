import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SponsorFormPage from './SponsorFormPage'
import type { Sponsor } from '../../api/sponsorApi'

const listSponsors = vi.fn()
const createSponsor = vi.fn()
const updateSponsor = vi.fn()

vi.mock('../../api/sponsorApi', () => ({
  listSponsors: (clubId: string) => listSponsors(clubId),
  createSponsor: (clubId: string, payload: unknown) => createSponsor(clubId, payload),
  updateSponsor: (clubId: string, sponsorId: string, payload: unknown) => updateSponsor(clubId, sponsorId, payload),
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

// Same wrapper-route shape as ClubContactFormPage.test.tsx, reproducing ManagerHome's Outlet
// context without pulling ManagerHome itself in.
function OutletContextWrapper({ clubId }: { clubId?: string }) {
  return <Outlet context={{ clubId }} />
}

function renderPage(initialPath: string, clubId?: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/manage" element={<OutletContextWrapper clubId={clubId} />}>
            <Route path="sponsors" element={<div>Sponsor List Page</div>} />
            <Route path="sponsors/new" element={<SponsorFormPage />} />
            <Route path="sponsors/:id/edit" element={<SponsorFormPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('SponsorFormPage', () => {
  it('renders "Not authorized" and does not fetch when no clubId is in the Outlet context', () => {
    renderPage('/manage/sponsors/new', undefined)

    expect(screen.getByText('Not authorized')).toBeInTheDocument()
    expect(listSponsors).not.toHaveBeenCalled()
  })

  it('create mode: renders the form with no fetch, and submit calls createSponsor then navigates to the list', async () => {
    const user = userEvent.setup()
    createSponsor.mockResolvedValueOnce(makeSponsor())

    renderPage('/manage/sponsors/new', 'test-club-id')

    expect(screen.getByText('Add Sponsor')).toBeInTheDocument()
    expect(listSponsors).not.toHaveBeenCalled()

    await user.type(screen.getByLabelText('Name'), 'Riverside Hardware')
    await user.click(screen.getByRole('button', { name: 'Create sponsor' }))

    expect(createSponsor).toHaveBeenCalledTimes(1)
    const [clubId, payload] = createSponsor.mock.calls[0]
    expect(clubId).toBe('test-club-id')
    expect(payload).toMatchObject({ name: 'Riverside Hardware' })

    expect(await screen.findByText('Sponsor List Page')).toBeInTheDocument()
  })

  it('edit mode: fetches the full list and prefills from the matching sponsor id', async () => {
    listSponsors.mockResolvedValueOnce([
      makeSponsor({ id: 'sponsor-1', name: 'Riverside Hardware' }),
      makeSponsor({ id: 'sponsor-2', name: 'Southside Motors' }),
    ])

    renderPage('/manage/sponsors/sponsor-2/edit', 'test-club-id')

    expect(await screen.findByText('Edit Sponsor')).toBeInTheDocument()
    expect(listSponsors).toHaveBeenCalledWith('test-club-id')
    expect(await screen.findByDisplayValue('Southside Motors')).toBeInTheDocument()
  })

  it('edit mode: renders an error state when the matching sponsor id is not in the fetched list', async () => {
    listSponsors.mockResolvedValueOnce([makeSponsor({ id: 'some-other-id' })])

    renderPage('/manage/sponsors/sponsor-2/edit', 'test-club-id')

    expect(await screen.findByText("Couldn't load this sponsor")).toBeInTheDocument()
    expect(
      screen.getByText('Something went wrong loading this sponsor. Please try again.'),
    ).toBeInTheDocument()
  })

  it('create mode: does not render the "Manage Contacts" link (a brand-new sponsor has no id yet)', () => {
    renderPage('/manage/sponsors/new', 'test-club-id')

    expect(screen.queryByRole('link', { name: /Manage Contacts/ })).not.toBeInTheDocument()
  })

  it('edit mode: renders a "Manage Contacts" link to this sponsor\'s contacts screen', async () => {
    listSponsors.mockResolvedValueOnce([makeSponsor({ id: 'sponsor-1', name: 'Riverside Hardware' })])

    renderPage('/manage/sponsors/sponsor-1/edit', 'test-club-id')

    const link = await screen.findByRole('link', { name: /Manage Contacts/ })
    expect(link).toHaveAttribute('href', '/manage/sponsors/sponsor-1/contacts')
  })

  it('edit mode: submit calls updateSponsor with the outlet clubId and route sponsor id, then navigates to the list', async () => {
    const user = userEvent.setup()
    // mockResolvedValue (not Once): saveMutation.onSuccess invalidates this same query key while
    // SponsorFormPage's own useQuery is still mounted (before navigate() unmounts it), triggering
    // a background refetch that also needs a value to resolve to — same gotcha noted in
    // ClubContactFormPage.test.tsx.
    listSponsors.mockResolvedValue([makeSponsor({ id: 'sponsor-1', name: 'Riverside Hardware' })])
    updateSponsor.mockResolvedValueOnce(makeSponsor({ id: 'sponsor-1', name: 'Riverside Hardware Ltd' }))

    renderPage('/manage/sponsors/sponsor-1/edit', 'test-club-id')

    await screen.findByText('Edit Sponsor')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(updateSponsor).toHaveBeenCalledTimes(1)
    const [clubId, sponsorId, payload] = updateSponsor.mock.calls[0]
    expect(clubId).toBe('test-club-id')
    expect(sponsorId).toBe('sponsor-1')
    expect(payload).toMatchObject({ name: 'Riverside Hardware' })

    expect(await screen.findByText('Sponsor List Page')).toBeInTheDocument()
  })
})
