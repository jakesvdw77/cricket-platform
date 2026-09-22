import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SponsorContactList from './SponsorContactList'
import type { SponsorContact } from '../../api/sponsorContactApi'

const listSponsorContacts = vi.fn()

// Mirrors ClubContactList.test.tsx's mock-every-export-individually pattern.
vi.mock('../../api/sponsorContactApi', () => ({
  listSponsorContacts: (clubId: string, sponsorId: string) => listSponsorContacts(clubId, sponsorId),
  deactivateSponsorContact: vi.fn(),
  reactivateSponsorContact: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

function makeContact(overrides: Partial<SponsorContact> = {}): SponsorContact {
  return {
    id: 'contact-1',
    sponsorId: 'test-sponsor-id',
    contact: {
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane.smith@example.com',
      phone: '+27 21 555 0100',
    },
    role: 'Marketing Contact',
    isPrimary: false,
    active: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: null,
    ...overrides,
  }
}

// SponsorContactList reads clubId via useOutletContext (normally threaded through by
// ManagerHome's own <Outlet context={{ clubId }} />) and sponsorId via useParams — same
// wrapper-route shape as ClubContactList.test.tsx, reproduced here without pulling ManagerHome in.
function OutletContextWrapper({ clubId }: { clubId?: string }) {
  return <Outlet context={{ clubId }} />
}

function renderList(clubId?: string, sponsorId = 'test-sponsor-id') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/manage/sponsors/${sponsorId}/contacts`]}>
        <Routes>
          <Route path="/manage" element={<OutletContextWrapper clubId={clubId} />}>
            <Route path="sponsors/:sponsorId/contacts" element={<SponsorContactList />} />
            <Route path="sponsors/:sponsorId/contacts/new" element={<div>Add Contact Page</div>} />
            <Route path="sponsors/:id/edit" element={<div>Sponsor Edit Page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('SponsorContactList', () => {
  it('renders "Not authorized" and does not fetch when no clubId is in the Outlet context', () => {
    renderList(undefined)

    expect(screen.getByText('Not authorized')).toBeInTheDocument()
    expect(screen.getByText('No club is associated with your account.')).toBeInTheDocument()
    expect(listSponsorContacts).not.toHaveBeenCalled()
  })

  it('renders nothing while the list is loading', () => {
    listSponsorContacts.mockReturnValueOnce(new Promise(() => {}))

    renderList('test-club-id')

    expect(screen.queryByText('No contacts yet')).not.toBeInTheDocument()
    expect(screen.queryByText('Not authorized')).not.toBeInTheDocument()
  })

  it('renders an error state when the fetch fails', async () => {
    listSponsorContacts.mockRejectedValueOnce(new Error('network error'))

    renderList('test-club-id')

    expect(await screen.findByText("Couldn't load contacts")).toBeInTheDocument()
    expect(
      screen.getByText("Something went wrong loading this sponsor's contacts. Please try again."),
    ).toBeInTheDocument()
  })

  it('renders the "No contacts yet" empty state when the sponsor has no contacts', async () => {
    listSponsorContacts.mockResolvedValueOnce([])

    renderList('test-club-id')

    expect(await screen.findByText('No contacts yet')).toBeInTheDocument()
  })

  it('renders a card per contact with the correct name, fields, and Primary/Inactive badges', async () => {
    listSponsorContacts.mockResolvedValueOnce([
      makeContact({ id: 'contact-1', isPrimary: true }),
      makeContact({
        id: 'contact-2',
        contact: {
          firstName: 'Past',
          lastName: 'Contact',
          email: 'past.contact@example.com',
          phone: '+27 21 555 0199',
        },
        role: 'Account Manager',
        active: false,
      }),
    ])

    renderList('test-club-id')

    expect(await screen.findByText('Jane Smith')).toBeInTheDocument()
    expect(screen.getByText('Marketing Contact')).toBeInTheDocument()
    expect(screen.getByText('jane.smith@example.com')).toBeInTheDocument()
    expect(screen.getByText('+27 21 555 0100')).toBeInTheDocument()
    expect(screen.getByText('Primary')).toBeInTheDocument()

    expect(screen.getByText('Past Contact')).toBeInTheDocument()
    expect(screen.getByText('Inactive')).toBeInTheDocument()
  })

  it('filters cards by the search term (matched against full name)', async () => {
    const user = userEvent.setup()
    listSponsorContacts.mockResolvedValueOnce([
      makeContact({ id: 'contact-1' }),
      makeContact({
        id: 'contact-2',
        contact: {
          firstName: 'Bob',
          lastName: 'Jones',
          email: 'bob.jones@example.com',
          phone: '+27 21 555 0177',
        },
        role: 'Account Manager',
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

  // docs/specs/038-move-deactivate-to-edit-screen.md: Deactivate/Reactivate no longer renders on
  // the list card at all — active or inactive — it moved to SponsorContactFormPage's own actions
  // bar.
  it('never renders a Deactivate/Reactivate button on the card, active or inactive', async () => {
    listSponsorContacts.mockResolvedValueOnce([
      makeContact({ id: 'contact-1', active: true }),
      makeContact({
        id: 'contact-2',
        contact: { firstName: 'Past', lastName: 'Contact', email: 'past@example.com', phone: '+27 21 555 0199' },
        active: false,
      }),
    ])

    renderList('test-club-id')

    await screen.findByText('Jane Smith')
    expect(screen.getByText('Past Contact')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Deactivate' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reactivate' })).not.toBeInTheDocument()
  })

  it('the back link targets this sponsor\'s edit screen, not the dashboard', async () => {
    listSponsorContacts.mockResolvedValueOnce([])

    renderList('test-club-id', 'test-sponsor-id')

    const backLink = await screen.findByRole('link', { name: /Back to Sponsor/ })
    expect(backLink).toHaveAttribute('href', '/manage/sponsors/test-sponsor-id/edit')
  })

  it('renders the page title as a real heading', async () => {
    listSponsorContacts.mockResolvedValueOnce([])

    renderList('test-club-id')

    expect(await screen.findByRole('heading', { name: 'Sponsor Contacts' })).toBeInTheDocument()
  })

  // docs/specs/043-list-toolbar-gold-standard.md: the Sort Select was replaced by a compact icon
  // toggle — this exercises the previously-dead `direction === 'desc'` branch for real, not just
  // visually.
  it('clicking the sort icon reverses the card order (sorting by the default Name field), and flips its own accessible name', async () => {
    const user = userEvent.setup()
    listSponsorContacts.mockResolvedValueOnce([
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
    listSponsorContacts.mockResolvedValueOnce([
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
})
