import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ClubContactFormPage from './ClubContactFormPage'
import type { ClubContact } from '../../api/clubContactApi'

const listClubContacts = vi.fn()
const createClubContact = vi.fn()
const updateClubContact = vi.fn()
const deactivateClubContact = vi.fn()
const reactivateClubContact = vi.fn()

vi.mock('../../api/clubContactApi', () => ({
  listClubContacts: (clubId: string) => listClubContacts(clubId),
  createClubContact: (clubId: string, payload: unknown) => createClubContact(clubId, payload),
  updateClubContact: (clubId: string, contactId: string, payload: unknown) =>
    updateClubContact(clubId, contactId, payload),
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

// Same wrapper-route shape as ManageClubProfilePage.test.tsx/ClubContactList.test.tsx, reproducing
// ManagerHome's Outlet context without pulling ManagerHome itself in.
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
            <Route path="club-contacts/new" element={<ClubContactFormPage />} />
            <Route path="club-contacts/:id/edit" element={<ClubContactFormPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('ClubContactFormPage', () => {
  it('renders "Not authorized" and does not fetch when no clubId is in the Outlet context', () => {
    renderPage('/manage/club-contacts/new', undefined)

    expect(screen.getByText('Not authorized')).toBeInTheDocument()
    expect(listClubContacts).not.toHaveBeenCalled()
  })

  it('create mode: renders the form with no fetch, and submit calls createClubContact then navigates to the list', async () => {
    const user = userEvent.setup()
    createClubContact.mockResolvedValueOnce(makeContact())

    renderPage('/manage/club-contacts/new', 'test-club-id')

    expect(screen.getByText('Add Contact')).toBeInTheDocument()
    expect(listClubContacts).not.toHaveBeenCalled()
    // docs/specs/038-move-deactivate-to-edit-screen.md: never rendered on a brand-new, not-yet-
    // saved record.
    expect(screen.queryByRole('button', { name: 'Deactivate' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reactivate' })).not.toBeInTheDocument()

    await user.type(screen.getByLabelText('First name'), 'Jane')
    await user.type(screen.getByLabelText('Last name'), 'Smith')
    await user.type(screen.getByLabelText('Email'), 'jane.smith@example.com')
    await user.type(screen.getByLabelText('Phone'), '+27 21 555 0100')
    await user.type(screen.getByLabelText('Club role'), 'Chairman')
    await user.click(screen.getByRole('button', { name: 'Create contact' }))

    expect(createClubContact).toHaveBeenCalledTimes(1)
    const [clubId, payload] = createClubContact.mock.calls[0]
    expect(clubId).toBe('test-club-id')
    expect(payload).toMatchObject({ role: 'Chairman', isPrimary: false })

    expect(await screen.findByText('Contact List Page')).toBeInTheDocument()
  })

  it('edit mode: fetches the full list and prefills from the matching contact id', async () => {
    listClubContacts.mockResolvedValueOnce([
      makeContact({ id: 'contact-1', role: 'Chairman' }),
      makeContact({ id: 'contact-2', role: 'Treasurer' }),
    ])

    renderPage('/manage/club-contacts/contact-2/edit', 'test-club-id')

    expect(await screen.findByText('Edit Contact')).toBeInTheDocument()
    expect(listClubContacts).toHaveBeenCalledWith('test-club-id')
    expect(await screen.findByDisplayValue('Treasurer')).toBeInTheDocument()
  })

  it('edit mode: renders an error state when the matching contact id is not in the fetched list', async () => {
    listClubContacts.mockResolvedValueOnce([makeContact({ id: 'some-other-id' })])

    renderPage('/manage/club-contacts/contact-2/edit', 'test-club-id')

    expect(await screen.findByText("Couldn't load this contact")).toBeInTheDocument()
    expect(
      screen.getByText('Something went wrong loading this contact. Please try again.'),
    ).toBeInTheDocument()
  })

  it('edit mode: submit calls updateClubContact with the outlet clubId and route contact id, then navigates to the list', async () => {
    const user = userEvent.setup()
    // mockResolvedValue (not Once): saveMutation.onSuccess invalidates this same query key while
    // ClubContactFormPage's own useQuery is still mounted (before navigate() unmounts it),
    // triggering a background refetch that also needs a value to resolve to — same gotcha noted
    // in ManageClubProfilePage.test.tsx.
    listClubContacts.mockResolvedValue([makeContact({ id: 'contact-1', role: 'Chairman' })])
    updateClubContact.mockResolvedValueOnce(makeContact({ id: 'contact-1', role: 'Vice Chairman' }))

    renderPage('/manage/club-contacts/contact-1/edit', 'test-club-id')

    await screen.findByText('Edit Contact')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(updateClubContact).toHaveBeenCalledTimes(1)
    const [clubId, contactId, payload] = updateClubContact.mock.calls[0]
    expect(clubId).toBe('test-club-id')
    expect(contactId).toBe('contact-1')
    expect(payload).toMatchObject({ role: 'Chairman' })

    expect(await screen.findByText('Contact List Page')).toBeInTheDocument()
  })

  // docs/specs/038-move-deactivate-to-edit-screen.md: relocated from ClubContactList's own card.
  describe('Deactivate/Reactivate', () => {
    it('edit mode: renders Deactivate for an active contact, clicking it calls deactivateClubContact and invalidates the contacts list', async () => {
      const user = userEvent.setup()
      listClubContacts.mockResolvedValueOnce([makeContact({ id: 'contact-1', active: true })])
      // onSuccess invalidates the list query while this page's own useQuery is still mounted,
      // triggering a refetch that must resolve to the now-inactive record for the button to
      // relabel.
      listClubContacts.mockResolvedValueOnce([makeContact({ id: 'contact-1', active: false })])
      let resolveDeactivate: (value: ClubContact) => void = () => {}
      deactivateClubContact.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveDeactivate = resolve
        }),
      )

      renderPage('/manage/club-contacts/contact-1/edit', 'test-club-id')

      await screen.findByText('Edit Contact')
      await user.click(screen.getByRole('button', { name: 'Deactivate' }))

      expect(deactivateClubContact).toHaveBeenCalledWith('test-club-id', 'contact-1')
      expect(await screen.findByRole('button', { name: 'Deactivating…' })).toBeInTheDocument()

      resolveDeactivate(makeContact({ id: 'contact-1', active: false }))

      expect(await screen.findByRole('button', { name: 'Reactivate' })).toBeInTheDocument()
    })

    it('edit mode: renders Reactivate for an inactive contact, clicking it calls reactivateClubContact', async () => {
      const user = userEvent.setup()
      listClubContacts.mockResolvedValue([makeContact({ id: 'contact-1', active: false })])
      reactivateClubContact.mockResolvedValueOnce(makeContact({ id: 'contact-1', active: true }))

      renderPage('/manage/club-contacts/contact-1/edit', 'test-club-id')

      await screen.findByText('Edit Contact')
      await user.click(screen.getByRole('button', { name: 'Reactivate' }))

      expect(reactivateClubContact).toHaveBeenCalledWith('test-club-id', 'contact-1')
    })
  })
})
