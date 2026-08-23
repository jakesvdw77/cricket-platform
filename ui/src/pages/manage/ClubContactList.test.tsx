import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ClubContactList from './ClubContactList'
import type { ClubContact } from '../../api/clubContactApi'

const listClubContacts = vi.fn()
const deactivateClubContact = vi.fn()
const reactivateClubContact = vi.fn()

// Mirrors ManageClubProfilePage.test.tsx's mock-every-export-individually pattern.
vi.mock('../../api/clubContactApi', () => ({
  listClubContacts: (clubId: string) => listClubContacts(clubId),
  deactivateClubContact: (clubId: string, contactId: string) => deactivateClubContact(clubId, contactId),
  reactivateClubContact: (clubId: string, contactId: string) => reactivateClubContact(clubId, contactId),
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
    isPrimary: false,
    active: true,
    photoUrl: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: null,
    ...overrides,
  }
}

// ClubContactList reads clubId via useOutletContext, not useParams (normally threaded through by
// ManagerHome's own <Outlet context={{ clubId }} />) — same wrapper-route shape as
// ManageClubProfilePage.test.tsx, reproduced here without pulling ManagerHome in.
function OutletContextWrapper({ clubId }: { clubId?: string }) {
  return <Outlet context={{ clubId }} />
}

function renderList(clubId?: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/manage/club-contacts']}>
        <Routes>
          <Route path="/manage" element={<OutletContextWrapper clubId={clubId} />}>
            <Route path="club-contacts" element={<ClubContactList />} />
            <Route path="club-contacts/new" element={<div>Add Contact Page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('ClubContactList', () => {
  it('renders "Not authorized" and does not fetch when no clubId is in the Outlet context', () => {
    renderList(undefined)

    expect(screen.getByText('Not authorized')).toBeInTheDocument()
    expect(screen.getByText('No club is associated with your account.')).toBeInTheDocument()
    expect(listClubContacts).not.toHaveBeenCalled()
  })

  it('renders nothing while the list is loading', () => {
    listClubContacts.mockReturnValueOnce(new Promise(() => {}))

    renderList('test-club-id')

    expect(screen.queryByText('No contacts yet')).not.toBeInTheDocument()
    expect(screen.queryByText('Not authorized')).not.toBeInTheDocument()
  })

  it("renders an error state when the fetch fails", async () => {
    listClubContacts.mockRejectedValueOnce(new Error('network error'))

    renderList('test-club-id')

    expect(await screen.findByText("Couldn't load contacts")).toBeInTheDocument()
    expect(
      screen.getByText("Something went wrong loading your club's contacts. Please try again."),
    ).toBeInTheDocument()
  })

  it('renders the "No contacts yet" empty state when the club has no contacts', async () => {
    listClubContacts.mockResolvedValueOnce([])

    renderList('test-club-id')

    expect(await screen.findByText('No contacts yet')).toBeInTheDocument()
  })

  it('renders a card per contact with the correct name, fields, and badges', async () => {
    listClubContacts.mockResolvedValueOnce([
      makeContact({ id: 'contact-1', isPrimary: true }),
      makeContact({
        id: 'contact-2',
        contact: {
          firstName: 'Past',
          lastName: 'Treasurer',
          email: 'past.treasurer@example.com',
          phone: '+27 21 555 0199',
        },
        role: 'Treasurer',
        active: false,
      }),
    ])

    renderList('test-club-id')

    expect(await screen.findByText('Jane Smith')).toBeInTheDocument()
    expect(screen.getByText('Chairman')).toBeInTheDocument()
    expect(screen.getByText('jane.smith@example.com')).toBeInTheDocument()
    expect(screen.getByText('+27 21 555 0100')).toBeInTheDocument()
    expect(screen.getByText('Primary')).toBeInTheDocument()

    expect(screen.getByText('Past Treasurer')).toBeInTheDocument()
    expect(screen.getByText('Inactive')).toBeInTheDocument()
  })

  it('filters cards by the search term (matched against full name)', async () => {
    const user = userEvent.setup()
    listClubContacts.mockResolvedValueOnce([
      makeContact({ id: 'contact-1' }),
      makeContact({
        id: 'contact-2',
        contact: {
          firstName: 'Bob',
          lastName: 'Jones',
          email: 'bob.jones@example.com',
          phone: '+27 21 555 0177',
        },
        role: 'Groundsman',
      }),
    ])

    renderList('test-club-id')

    await screen.findByText('Jane Smith')
    expect(screen.getByText('Bob Jones')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'jane' } })

    expect(await screen.findByText('Jane Smith')).toBeInTheDocument()
    expect(screen.queryByText('Bob Jones')).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'zzz' } })

    expect(await screen.findByText('No matching contacts')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Add Contact' }))
    expect(await screen.findByText('Add Contact Page')).toBeInTheDocument()
  })

  it('clicking Deactivate on an active contact calls deactivateClubContact and reflects a pending state', async () => {
    const user = userEvent.setup()
    listClubContacts.mockResolvedValueOnce([makeContact({ active: true })])
    let resolveDeactivate: (value: ClubContact) => void = () => {}
    deactivateClubContact.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveDeactivate = resolve
      }),
    )
    // onSuccess invalidates the list query while this card is still mounted, triggering a
    // refetch that also needs a value to resolve to — same gotcha as the refetch-after-mutation
    // note in ManageClubProfilePage.test.tsx/ClubContactFormPage.test.tsx.
    listClubContacts.mockResolvedValueOnce([makeContact({ active: false })])

    renderList('test-club-id')

    await screen.findByText('Jane Smith')
    await user.click(screen.getByRole('button', { name: 'Deactivate' }))

    expect(deactivateClubContact).toHaveBeenCalledWith('test-club-id', 'contact-1')
    expect(await screen.findByRole('button', { name: 'Deactivating…' })).toBeInTheDocument()

    resolveDeactivate(makeContact({ active: false }))

    expect(await screen.findByRole('button', { name: 'Reactivate' })).toBeInTheDocument()
  })

  it('clicking Reactivate on an inactive contact calls reactivateClubContact', async () => {
    const user = userEvent.setup()
    listClubContacts.mockResolvedValueOnce([makeContact({ active: false })])
    reactivateClubContact.mockResolvedValueOnce(makeContact({ active: true }))
    // onSuccess invalidates the list query, triggering a refetch.
    listClubContacts.mockResolvedValueOnce([makeContact({ active: true })])

    renderList('test-club-id')

    await screen.findByText('Jane Smith')
    await user.click(screen.getByRole('button', { name: 'Reactivate' }))

    expect(reactivateClubContact).toHaveBeenCalledWith('test-club-id', 'contact-1')
  })
})
