import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LeagueContactFormPage from './LeagueContactFormPage'
import type { LeagueContact } from '../../api/leagueContactApi'

const listLeagueContacts = vi.fn()
const createLeagueContact = vi.fn()
const updateLeagueContact = vi.fn()
const deactivateLeagueContact = vi.fn()
const reactivateLeagueContact = vi.fn()

vi.mock('../../api/leagueContactApi', () => ({
  listLeagueContacts: (clubId: string, leagueId: string) => listLeagueContacts(clubId, leagueId),
  createLeagueContact: (clubId: string, leagueId: string, payload: unknown) =>
    createLeagueContact(clubId, leagueId, payload),
  updateLeagueContact: (clubId: string, leagueId: string, contactId: string, payload: unknown) =>
    updateLeagueContact(clubId, leagueId, contactId, payload),
  deactivateLeagueContact: (clubId: string, leagueId: string, contactId: string) =>
    deactivateLeagueContact(clubId, leagueId, contactId),
  reactivateLeagueContact: (clubId: string, leagueId: string, contactId: string) =>
    reactivateLeagueContact(clubId, leagueId, contactId),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

function makeContact(overrides: Partial<LeagueContact> = {}): LeagueContact {
  return {
    id: 'contact-1',
    leagueId: 'test-league-id',
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

// Same wrapper-route shape as SponsorContactFormPage.test.tsx, reproducing ManagerHome's Outlet
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
            <Route path="fixtures/leagues/:leagueId/edit" element={<div>League Edit Page</div>} />
            <Route path="fixtures/leagues/:leagueId/contacts/new" element={<LeagueContactFormPage />} />
            <Route
              path="fixtures/leagues/:leagueId/contacts/:contactId/edit"
              element={<LeagueContactFormPage />}
            />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('LeagueContactFormPage', () => {
  it('renders "Not authorized" and does not fetch when no clubId is in the Outlet context', () => {
    renderPage('/manage/fixtures/leagues/test-league-id/contacts/new', undefined)

    expect(screen.getByText('Not authorized')).toBeInTheDocument()
    expect(listLeagueContacts).not.toHaveBeenCalled()
  })

  it('create mode: renders the form with no fetch, and submit calls createLeagueContact then navigates back to the league', async () => {
    const user = userEvent.setup()
    createLeagueContact.mockResolvedValueOnce(makeContact())

    renderPage('/manage/fixtures/leagues/test-league-id/contacts/new', 'test-club-id')

    expect(screen.getByText('Add Contact')).toBeInTheDocument()
    expect(listLeagueContacts).not.toHaveBeenCalled()
    // docs/specs/038-move-deactivate-to-edit-screen.md: never rendered on a brand-new, not-yet-
    // saved record.
    expect(screen.queryByRole('button', { name: 'Deactivate' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reactivate' })).not.toBeInTheDocument()

    await user.type(screen.getByLabelText('First name'), 'Jane')
    await user.type(screen.getByLabelText('Last name'), 'Smith')
    await user.type(screen.getByLabelText('Email'), 'jane.smith@example.com')
    await user.type(screen.getByLabelText('Phone'), '+27 21 555 0100')
    await user.type(screen.getByLabelText('Role'), 'League Administrator')
    await user.click(screen.getByRole('button', { name: 'Create contact' }))

    expect(createLeagueContact).toHaveBeenCalledTimes(1)
    const [clubId, leagueId, payload] = createLeagueContact.mock.calls[0]
    expect(clubId).toBe('test-club-id')
    expect(leagueId).toBe('test-league-id')
    expect(payload).toMatchObject({ role: 'League Administrator', isPrimary: false })

    expect(await screen.findByText('League Edit Page')).toBeInTheDocument()
  })

  it('edit mode: fetches the full list and prefills from the matching contact id', async () => {
    listLeagueContacts.mockResolvedValueOnce([
      makeContact({ id: 'contact-1', role: 'League Administrator' }),
      makeContact({ id: 'contact-2', role: 'Umpire Coordinator' }),
    ])

    renderPage('/manage/fixtures/leagues/test-league-id/contacts/contact-2/edit', 'test-club-id')

    expect(await screen.findByText('Edit Contact')).toBeInTheDocument()
    expect(listLeagueContacts).toHaveBeenCalledWith('test-club-id', 'test-league-id')
    expect(await screen.findByDisplayValue('Umpire Coordinator')).toBeInTheDocument()
  })

  it('edit mode: renders an error state when the matching contact id is not in the fetched list', async () => {
    listLeagueContacts.mockResolvedValueOnce([makeContact({ id: 'some-other-id' })])

    renderPage('/manage/fixtures/leagues/test-league-id/contacts/contact-2/edit', 'test-club-id')

    expect(await screen.findByText("Couldn't load this contact")).toBeInTheDocument()
    expect(
      screen.getByText('Something went wrong loading this contact. Please try again.'),
    ).toBeInTheDocument()
  })

  it('edit mode: submit calls updateLeagueContact with the outlet clubId, route leagueId, and route contact id, then navigates back to the league', async () => {
    const user = userEvent.setup()
    // mockResolvedValue (not Once): saveMutation.onSuccess invalidates this same query key while
    // LeagueContactFormPage's own useQuery is still mounted (before navigate() unmounts it),
    // triggering a background refetch that also needs a value to resolve to — same gotcha noted
    // in SponsorContactFormPage.test.tsx.
    listLeagueContacts.mockResolvedValue([makeContact({ id: 'contact-1', role: 'League Administrator' })])
    updateLeagueContact.mockResolvedValueOnce(
      makeContact({ id: 'contact-1', role: 'Senior League Administrator' }),
    )

    renderPage('/manage/fixtures/leagues/test-league-id/contacts/contact-1/edit', 'test-club-id')

    await screen.findByText('Edit Contact')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(updateLeagueContact).toHaveBeenCalledTimes(1)
    const [clubId, leagueId, contactId, payload] = updateLeagueContact.mock.calls[0]
    expect(clubId).toBe('test-club-id')
    expect(leagueId).toBe('test-league-id')
    expect(contactId).toBe('contact-1')
    expect(payload).toMatchObject({ role: 'League Administrator' })

    expect(await screen.findByText('League Edit Page')).toBeInTheDocument()
  })

  // docs/specs/038-move-deactivate-to-edit-screen.md: relocated from a list card onto this
  // screen's own actions bar.
  describe('Deactivate/Reactivate', () => {
    it('edit mode: renders Deactivate for an active contact, clicking it calls deactivateLeagueContact and invalidates the contacts list', async () => {
      const user = userEvent.setup()
      listLeagueContacts.mockResolvedValueOnce([makeContact({ id: 'contact-1', active: true })])
      // onSuccess invalidates the list query while this page's own useQuery is still mounted,
      // triggering a refetch that must resolve to the now-inactive record for the button to
      // relabel.
      listLeagueContacts.mockResolvedValueOnce([makeContact({ id: 'contact-1', active: false })])
      let resolveDeactivate: (value: LeagueContact) => void = () => {}
      deactivateLeagueContact.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveDeactivate = resolve
        }),
      )

      renderPage('/manage/fixtures/leagues/test-league-id/contacts/contact-1/edit', 'test-club-id')

      await screen.findByText('Edit Contact')
      await user.click(screen.getByRole('button', { name: 'Deactivate' }))

      expect(deactivateLeagueContact).toHaveBeenCalledWith('test-club-id', 'test-league-id', 'contact-1')
      expect(await screen.findByRole('button', { name: 'Deactivating…' })).toBeInTheDocument()

      resolveDeactivate(makeContact({ id: 'contact-1', active: false }))

      expect(await screen.findByRole('button', { name: 'Reactivate' })).toBeInTheDocument()
    })

    it('edit mode: renders Reactivate for an inactive contact, clicking it calls reactivateLeagueContact', async () => {
      const user = userEvent.setup()
      listLeagueContacts.mockResolvedValue([makeContact({ id: 'contact-1', active: false })])
      reactivateLeagueContact.mockResolvedValueOnce(makeContact({ id: 'contact-1', active: true }))

      renderPage('/manage/fixtures/leagues/test-league-id/contacts/contact-1/edit', 'test-club-id')

      await screen.findByText('Edit Contact')
      await user.click(screen.getByRole('button', { name: 'Reactivate' }))

      expect(reactivateLeagueContact).toHaveBeenCalledWith('test-club-id', 'test-league-id', 'contact-1')
    })
  })
})
