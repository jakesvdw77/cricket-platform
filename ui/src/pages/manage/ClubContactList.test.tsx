import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ClubContactList from './ClubContactList'
import type { ClubContact } from '../../api/clubContactApi'

const listClubContacts = vi.fn()

// Mirrors ManageClubProfilePage.test.tsx's mock-every-export-individually pattern.
vi.mock('../../api/clubContactApi', () => ({
  listClubContacts: (clubId: string) => listClubContacts(clubId),
  deactivateClubContact: vi.fn(),
  reactivateClubContact: vi.fn(),
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
            <Route path="club-contacts/:id/edit" element={<div>Edit Contact Page</div>} />
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

  // docs/specs/043-list-toolbar-gold-standard.md: the Sort Select was replaced by a compact icon
  // toggle — this exercises the previously-dead `direction === 'desc'` branch for real, not just
  // visually.
  it('clicking the sort icon reverses the card order (sorting by the default Name field), and flips its own accessible name', async () => {
    const user = userEvent.setup()
    listClubContacts.mockResolvedValueOnce([
      makeContact({
        id: 'contact-1',
        contact: { firstName: 'Amy', lastName: 'Adams', email: 'amy@example.com', phone: null },
        role: 'Zookeeper',
      }),
      makeContact({
        id: 'contact-2',
        contact: { firstName: 'Zoe', lastName: 'Brown', email: 'zoe@example.com', phone: null },
        role: 'Assistant',
      }),
    ])

    renderList('test-club-id')

    await screen.findByText('Amy Adams')
    expect(screen.getAllByRole('heading', { level: 3 }).map((el) => el.textContent)).toEqual([
      'Amy Adams',
      'Zoe Brown',
    ])

    await user.click(screen.getByRole('button', { name: 'Name, Z to A' }))

    expect(screen.getAllByRole('heading', { level: 3 }).map((el) => el.textContent)).toEqual([
      'Zoe Brown',
      'Amy Adams',
    ])
    expect(screen.getByRole('button', { name: 'Name, A to Z' })).toBeInTheDocument()
  })

  // docs/specs/043-list-toolbar-gold-standard.md: the one two-sortable-field screen in this
  // rollout — switching the sort field via the picker actually re-sorts by that field, and the
  // currently-active direction (set on the *previous* field) carries over rather than resetting.
  it('switching the sort field to Role re-sorts by role, and the current direction carries over across the switch', async () => {
    const user = userEvent.setup()
    listClubContacts.mockResolvedValueOnce([
      makeContact({
        id: 'contact-1',
        contact: { firstName: 'Amy', lastName: 'Adams', email: 'amy@example.com', phone: null },
        role: 'Zookeeper',
      }),
      makeContact({
        id: 'contact-2',
        contact: { firstName: 'Zoe', lastName: 'Brown', email: 'zoe@example.com', phone: null },
        role: 'Assistant',
      }),
    ])

    renderList('test-club-id')

    await screen.findByText('Amy Adams')
    expect(screen.getByRole('button', { name: 'Sort field: Name' })).toBeInTheDocument()

    // Flip direction to descending while still sorting by Name.
    await user.click(screen.getByRole('button', { name: 'Name, Z to A' }))
    expect(screen.getAllByRole('heading', { level: 3 }).map((el) => el.textContent)).toEqual([
      'Zoe Brown',
      'Amy Adams',
    ])

    // Switch the sort field to Role via the picker.
    await user.click(screen.getByRole('button', { name: 'Sort field: Name' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Role' }))

    expect(screen.getByRole('button', { name: 'Sort field: Role' })).toBeInTheDocument()
    // Direction is still descending (carried over from the Name sort) — Role descending puts
    // 'Zookeeper' (Amy Adams) ahead of 'Assistant' (Zoe Brown).
    expect(screen.getByRole('button', { name: 'Role, A to Z' })).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 3 }).map((el) => el.textContent)).toEqual([
      'Amy Adams',
      'Zoe Brown',
    ])
  })

  // docs/specs/049-record-list-edit-action-rollout.md: mirrors MatchList.test.tsx's own
  // precedent test for the View+Edit dual-render footer.
  it('renders View and Edit together on a card, both pointing at the contact\'s own routes', async () => {
    listClubContacts.mockResolvedValueOnce([makeContact({ id: 'contact-1' })])

    renderList('test-club-id')

    await screen.findByText('Jane Smith')
    expect(screen.getByRole('link', { name: 'View' })).toHaveAttribute('href', '/manage/club-contacts/contact-1')
    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute(
      'href',
      '/manage/club-contacts/contact-1/edit',
    )
  })

  // docs/specs/038-move-deactivate-to-edit-screen.md: Deactivate/Reactivate no longer renders on
  // the list card at all — active or inactive — it moved to ClubContactFormPage's own actions bar.
  it('never renders a Deactivate/Reactivate button on the card, active or inactive', async () => {
    listClubContacts.mockResolvedValueOnce([
      makeContact({ id: 'contact-1', active: true }),
      makeContact({
        id: 'contact-2',
        contact: { firstName: 'Past', lastName: 'Treasurer', email: 'past@example.com', phone: '+27 21 555 0199' },
        active: false,
      }),
    ])

    renderList('test-club-id')

    await screen.findByText('Jane Smith')
    expect(screen.getByText('Past Treasurer')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Deactivate' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reactivate' })).not.toBeInTheDocument()
  })
})
