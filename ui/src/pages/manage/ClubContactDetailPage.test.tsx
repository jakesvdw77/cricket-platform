import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ClubContactDetailPage from './ClubContactDetailPage'
import type { ClubContact } from '../../api/clubContactApi'

const listClubContacts = vi.fn()

vi.mock('../../api/clubContactApi', () => ({
  listClubContacts: (clubId: string) => listClubContacts(clubId),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

function makeContact(overrides: Partial<ClubContact> = {}): ClubContact {
  return {
    id: 'contact-1',
    clubId: 'test-club-id',
    contact: {
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane.smith@example.com',
      phone: '+27 21 555 0100',
    },
    role: 'Chairman',
    isPrimary: true,
    active: true,
    photoUrl: null,
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
            <Route path="club-contacts" element={<div>Contact List Page</div>} />
            <Route path="club-contacts/:id" element={<ClubContactDetailPage />} />
            <Route path="club-contacts/:id/edit" element={<div>Edit Contact Page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('ClubContactDetailPage', () => {
  it('renders "Not authorized" and does not fetch when no clubId is in the Outlet context', () => {
    renderPage('/manage/club-contacts/contact-1', undefined)

    expect(screen.getByText('Not authorized')).toBeInTheDocument()
    expect(listClubContacts).not.toHaveBeenCalled()
  })

  it('loads the matching contact and renders every field read-only, with an Edit action to the real edit route', async () => {
    listClubContacts.mockResolvedValueOnce([
      makeContact({ id: 'contact-1', role: 'Chairman' }),
      makeContact({ id: 'contact-2', role: 'Treasurer' }),
    ])

    renderPage('/manage/club-contacts/contact-1', 'test-club-id')

    expect(await screen.findByRole('heading', { name: 'Jane Smith' })).toBeInTheDocument()
    expect(listClubContacts).toHaveBeenCalledWith('test-club-id')
    expect(screen.getByText('Chairman')).toBeInTheDocument()
    expect(screen.getByText('jane.smith@example.com')).toBeInTheDocument()
    expect(screen.getByText('+27 21 555 0100')).toBeInTheDocument()
    expect(screen.getByText('Yes')).toBeInTheDocument()
    expect(screen.getByText('Primary')).toBeInTheDocument()

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()

    expect(screen.getByRole('link', { name: /edit/i })).toHaveAttribute('href', '/manage/club-contacts/contact-1/edit')
  })

  it('navigates to the real edit form when Edit is clicked', async () => {
    const user = userEvent.setup()
    listClubContacts.mockResolvedValueOnce([makeContact({ id: 'contact-1' })])

    renderPage('/manage/club-contacts/contact-1', 'test-club-id')

    await screen.findByRole('heading', { name: 'Jane Smith' })
    await user.click(screen.getByRole('link', { name: /edit/i }))

    expect(await screen.findByText('Edit Contact Page')).toBeInTheDocument()
  })

  it('renders an error state when the matching contact id is not in the fetched list', async () => {
    listClubContacts.mockResolvedValueOnce([makeContact({ id: 'some-other-id' })])

    renderPage('/manage/club-contacts/contact-1', 'test-club-id')

    expect(await screen.findByText("Couldn't load this contact")).toBeInTheDocument()
  })
})
