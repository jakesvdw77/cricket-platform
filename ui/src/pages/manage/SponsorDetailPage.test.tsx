import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SponsorDetailPage from './SponsorDetailPage'
import type { Sponsor } from '../../api/sponsorApi'

const listSponsors = vi.fn()

vi.mock('../../api/sponsorApi', () => ({
  listSponsors: (clubId: string) => listSponsors(clubId),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

function makeSponsor(overrides: Partial<Sponsor> = {}): Sponsor {
  return {
    id: 'sponsor-1',
    clubId: 'test-club-id',
    name: 'Acme Cricket Gear',
    website: 'https://acmecricket.example',
    email: 'hello@acmecricket.example',
    phone: '+27 21 555 0199',
    logoUrl: null,
    bannerUrl: null,
    socialLinks: [{ platform: 'facebook', url: 'https://facebook.com/acmecricket' }],
    active: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: null,
    ...overrides,
  }
}

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
            <Route path="sponsors/:id" element={<SponsorDetailPage />} />
            <Route path="sponsors/:id/edit" element={<div>Edit Sponsor Page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('SponsorDetailPage', () => {
  it('renders "Not authorized" and does not fetch when no clubId is in the Outlet context', () => {
    renderPage('/manage/sponsors/sponsor-1', undefined)

    expect(screen.getByText('Not authorized')).toBeInTheDocument()
    expect(listSponsors).not.toHaveBeenCalled()
  })

  it('renders contact fields and social links read-only, without repeating the name inside the card', async () => {
    listSponsors.mockResolvedValueOnce([makeSponsor()])

    renderPage('/manage/sponsors/sponsor-1', 'test-club-id')

    expect(await screen.findByRole('heading', { name: 'Acme Cricket Gear' })).toBeInTheDocument()
    expect(listSponsors).toHaveBeenCalledWith('test-club-id')
    expect(screen.getByText('+27 21 555 0199')).toBeInTheDocument()
    expect(screen.getByText('hello@acmecricket.example')).toBeInTheDocument()
    expect(screen.getByText('https://acmecricket.example')).toBeInTheDocument()

    // Only the header renders the sponsor's name as a heading — the card body doesn't repeat it.
    expect(screen.getAllByText('Acme Cricket Gear')).toHaveLength(1)

    expect(screen.getByRole('link', { name: 'Facebook' })).toHaveAttribute('href', 'https://facebook.com/acmecricket')

    expect(screen.getByRole('link', { name: /edit/i })).toHaveAttribute('href', '/manage/sponsors/sponsor-1/edit')
  })

  it('renders an empty state when the sponsor has no contact fields or social links', async () => {
    listSponsors.mockResolvedValueOnce([
      makeSponsor({ website: null, email: null, phone: null, socialLinks: [] }),
    ])

    renderPage('/manage/sponsors/sponsor-1', 'test-club-id')

    expect(await screen.findByText('No contact details yet')).toBeInTheDocument()
  })

  it('renders an error state when the matching sponsor id is not in the fetched list', async () => {
    listSponsors.mockResolvedValueOnce([makeSponsor({ id: 'some-other-id' })])

    renderPage('/manage/sponsors/sponsor-1', 'test-club-id')

    expect(await screen.findByText("Couldn't load this sponsor")).toBeInTheDocument()
  })
})
