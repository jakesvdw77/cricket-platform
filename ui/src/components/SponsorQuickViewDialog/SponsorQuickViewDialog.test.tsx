import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { SponsorQuickViewDialog } from './SponsorQuickViewDialog'
import type { Sponsor } from '../../api/sponsorApi'

const listSponsorContacts = vi.fn()

vi.mock('../../api/sponsorContactApi', () => ({
  listSponsorContacts: (clubId: string, sponsorId: string) => listSponsorContacts(clubId, sponsorId),
}))

function makeSponsor(overrides: Partial<Sponsor> = {}): Sponsor {
  return {
    id: 'sponsor-1',
    clubId: 'club-1',
    name: 'Acme Bank',
    website: null,
    email: null,
    phone: null,
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

function renderDialog(props: Partial<Parameters<typeof SponsorQuickViewDialog>[0]> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <SponsorQuickViewDialog clubId="club-1" sponsor={null} onClose={vi.fn()} {...props} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('SponsorQuickViewDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listSponsorContacts.mockResolvedValue([])
  })

  it('renders nothing open when sponsor is null', () => {
    renderDialog()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows Website/Email and an edit link to the sponsor once open', async () => {
    renderDialog({ sponsor: makeSponsor({ website: 'https://acme.example.com', email: 'hello@acme.example.com' }) })

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('https://acme.example.com')).toBeInTheDocument()
    expect(screen.getByText('hello@acme.example.com')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/manage/sponsors/sponsor-1/edit')
  })

  it('fetches and lists the sponsor\'s own named contacts', async () => {
    listSponsorContacts.mockResolvedValueOnce([
      { id: 'sc-1', sponsorId: 'sponsor-1', contact: { firstName: 'Priya', lastName: 'Naidoo', email: '', phone: '' }, role: 'Account Manager', isPrimary: true, active: true, createdAt: '', updatedAt: '', updatedBy: null },
    ])
    renderDialog({ sponsor: makeSponsor() })

    expect(await screen.findByText('Priya Naidoo')).toBeInTheDocument()
    expect(screen.getByText('Account Manager')).toBeInTheDocument()
    expect(listSponsorContacts).toHaveBeenCalledWith('club-1', 'sponsor-1')
  })

  it('omits the Sponsor Contacts field entirely when the sponsor has none', async () => {
    renderDialog({ sponsor: makeSponsor() })

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.queryByText('Sponsor Contacts')).not.toBeInTheDocument()
  })

  it('does not fetch sponsor contacts while no sponsor is selected', () => {
    renderDialog({ sponsor: null })
    expect(listSponsorContacts).not.toHaveBeenCalled()
  })
})
