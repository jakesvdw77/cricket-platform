import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SponsorContactDetailPage from './SponsorContactDetailPage'
import type { SponsorContact } from '../../api/sponsorContactApi'

const listSponsorContacts = vi.fn()

vi.mock('../../api/sponsorContactApi', () => ({
  listSponsorContacts: (clubId: string, sponsorId: string) => listSponsorContacts(clubId, sponsorId),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

function makeContact(overrides: Partial<SponsorContact> = {}): SponsorContact {
  return {
    id: 'contact-1',
    sponsorId: 'sponsor-1',
    contact: {
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane.smith@example.com',
      phone: '+27 21 555 0100',
    },
    role: 'Marketing Lead',
    isPrimary: false,
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
            <Route path="sponsors/:sponsorId/contacts" element={<div>Sponsor Contact List Page</div>} />
            <Route path="sponsors/:sponsorId/contacts/:contactId" element={<SponsorContactDetailPage />} />
            <Route path="sponsors/:sponsorId/contacts/:contactId/edit" element={<div>Edit Sponsor Contact Page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('SponsorContactDetailPage', () => {
  it('renders "Not authorized" and does not fetch when no clubId is in the Outlet context', () => {
    renderPage('/manage/sponsors/sponsor-1/contacts/contact-1', undefined)

    expect(screen.getByText('Not authorized')).toBeInTheDocument()
    expect(listSponsorContacts).not.toHaveBeenCalled()
  })

  it('loads the matching contact and renders its fields read-only, with an Edit action to the real edit route', async () => {
    listSponsorContacts.mockResolvedValueOnce([
      makeContact({ id: 'contact-1', role: 'Marketing Lead' }),
      makeContact({ id: 'contact-2', role: 'Finance' }),
    ])

    renderPage('/manage/sponsors/sponsor-1/contacts/contact-1', 'test-club-id')

    expect(await screen.findByRole('heading', { name: 'Jane Smith' })).toBeInTheDocument()
    expect(listSponsorContacts).toHaveBeenCalledWith('test-club-id', 'sponsor-1')
    expect(screen.getByText('Marketing Lead')).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()

    expect(screen.getByRole('link', { name: /edit/i })).toHaveAttribute(
      'href',
      '/manage/sponsors/sponsor-1/contacts/contact-1/edit',
    )
  })

  it('renders an error state when the matching contact id is not in the fetched list', async () => {
    listSponsorContacts.mockResolvedValueOnce([makeContact({ id: 'some-other-id' })])

    renderPage('/manage/sponsors/sponsor-1/contacts/contact-1', 'test-club-id')

    expect(await screen.findByText("Couldn't load this contact")).toBeInTheDocument()
  })
})
