import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LeagueContactDetailPage from './LeagueContactDetailPage'
import type { LeagueContact } from '../../api/leagueContactApi'

const listLeagueContacts = vi.fn()

vi.mock('../../api/leagueContactApi', () => ({
  listLeagueContacts: (clubId: string, leagueId: string) => listLeagueContacts(clubId, leagueId),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

function makeContact(overrides: Partial<LeagueContact> = {}): LeagueContact {
  return {
    id: 'contact-1',
    leagueId: 'league-1',
    contact: {
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane.smith@example.com',
      phone: '+27 21 555 0100',
    },
    role: 'League Administrator',
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
            <Route path="fixtures/leagues/:leagueId" element={<div>League Detail Page</div>} />
            <Route path="fixtures/leagues/:leagueId/contacts/:contactId" element={<LeagueContactDetailPage />} />
            <Route
              path="fixtures/leagues/:leagueId/contacts/:contactId/edit"
              element={<div>Edit League Contact Page</div>}
            />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('LeagueContactDetailPage', () => {
  it('renders "Not authorized" and does not fetch when no clubId is in the Outlet context', () => {
    renderPage('/manage/fixtures/leagues/league-1/contacts/contact-1', undefined)

    expect(screen.getByText('Not authorized')).toBeInTheDocument()
    expect(listLeagueContacts).not.toHaveBeenCalled()
  })

  it('loads the matching contact and renders its fields read-only, with an Edit action to the real edit route', async () => {
    listLeagueContacts.mockResolvedValueOnce([
      makeContact({ id: 'contact-1', role: 'League Administrator' }),
      makeContact({ id: 'contact-2', role: 'Umpire Coordinator' }),
    ])

    renderPage('/manage/fixtures/leagues/league-1/contacts/contact-1', 'test-club-id')

    expect(await screen.findByRole('heading', { name: 'Jane Smith' })).toBeInTheDocument()
    expect(listLeagueContacts).toHaveBeenCalledWith('test-club-id', 'league-1')
    expect(screen.getByText('League Administrator')).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()

    expect(screen.getByRole('link', { name: /edit/i })).toHaveAttribute(
      'href',
      '/manage/fixtures/leagues/league-1/contacts/contact-1/edit',
    )
  })

  it('renders an error state when the matching contact id is not in the fetched list', async () => {
    listLeagueContacts.mockResolvedValueOnce([makeContact({ id: 'some-other-id' })])

    renderPage('/manage/fixtures/leagues/league-1/contacts/contact-1', 'test-club-id')

    expect(await screen.findByText("Couldn't load this contact")).toBeInTheDocument()
  })
})
