import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SponsorContactFormPage from './SponsorContactFormPage'
import type { SponsorContact } from '../../api/sponsorContactApi'

const listSponsorContacts = vi.fn()
const createSponsorContact = vi.fn()
const updateSponsorContact = vi.fn()

vi.mock('../../api/sponsorContactApi', () => ({
  listSponsorContacts: (clubId: string, sponsorId: string) => listSponsorContacts(clubId, sponsorId),
  createSponsorContact: (clubId: string, sponsorId: string, payload: unknown) =>
    createSponsorContact(clubId, sponsorId, payload),
  updateSponsorContact: (clubId: string, sponsorId: string, contactId: string, payload: unknown) =>
    updateSponsorContact(clubId, sponsorId, contactId, payload),
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

// Same wrapper-route shape as ClubContactFormPage.test.tsx, reproducing ManagerHome's Outlet
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
            <Route path="sponsors/:sponsorId/contacts" element={<div>Contact List Page</div>} />
            <Route path="sponsors/:sponsorId/contacts/new" element={<SponsorContactFormPage />} />
            <Route path="sponsors/:sponsorId/contacts/:contactId/edit" element={<SponsorContactFormPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('SponsorContactFormPage', () => {
  it('renders "Not authorized" and does not fetch when no clubId is in the Outlet context', () => {
    renderPage('/manage/sponsors/test-sponsor-id/contacts/new', undefined)

    expect(screen.getByText('Not authorized')).toBeInTheDocument()
    expect(listSponsorContacts).not.toHaveBeenCalled()
  })

  it('create mode: renders the form with no fetch, and submit calls createSponsorContact then navigates to the list', async () => {
    const user = userEvent.setup()
    createSponsorContact.mockResolvedValueOnce(makeContact())

    renderPage('/manage/sponsors/test-sponsor-id/contacts/new', 'test-club-id')

    expect(screen.getByText('Add Contact')).toBeInTheDocument()
    expect(listSponsorContacts).not.toHaveBeenCalled()

    await user.type(screen.getByLabelText('First name'), 'Jane')
    await user.type(screen.getByLabelText('Last name'), 'Smith')
    await user.type(screen.getByLabelText('Email'), 'jane.smith@example.com')
    await user.type(screen.getByLabelText('Phone'), '+27 21 555 0100')
    await user.type(screen.getByLabelText('Role'), 'Marketing Contact')
    await user.click(screen.getByRole('button', { name: 'Create contact' }))

    expect(createSponsorContact).toHaveBeenCalledTimes(1)
    const [clubId, sponsorId, payload] = createSponsorContact.mock.calls[0]
    expect(clubId).toBe('test-club-id')
    expect(sponsorId).toBe('test-sponsor-id')
    expect(payload).toMatchObject({ role: 'Marketing Contact', isPrimary: false })

    expect(await screen.findByText('Contact List Page')).toBeInTheDocument()
  })

  it('edit mode: fetches the full list and prefills from the matching contact id', async () => {
    listSponsorContacts.mockResolvedValueOnce([
      makeContact({ id: 'contact-1', role: 'Marketing Contact' }),
      makeContact({ id: 'contact-2', role: 'Account Manager' }),
    ])

    renderPage('/manage/sponsors/test-sponsor-id/contacts/contact-2/edit', 'test-club-id')

    expect(await screen.findByText('Edit Contact')).toBeInTheDocument()
    expect(listSponsorContacts).toHaveBeenCalledWith('test-club-id', 'test-sponsor-id')
    expect(await screen.findByDisplayValue('Account Manager')).toBeInTheDocument()
  })

  it('edit mode: renders an error state when the matching contact id is not in the fetched list', async () => {
    listSponsorContacts.mockResolvedValueOnce([makeContact({ id: 'some-other-id' })])

    renderPage('/manage/sponsors/test-sponsor-id/contacts/contact-2/edit', 'test-club-id')

    expect(await screen.findByText("Couldn't load this contact")).toBeInTheDocument()
    expect(
      screen.getByText('Something went wrong loading this contact. Please try again.'),
    ).toBeInTheDocument()
  })

  it('edit mode: submit calls updateSponsorContact with the outlet clubId, route sponsorId, and route contact id, then navigates to the list', async () => {
    const user = userEvent.setup()
    // mockResolvedValue (not Once): saveMutation.onSuccess invalidates this same query key while
    // SponsorContactFormPage's own useQuery is still mounted (before navigate() unmounts it),
    // triggering a background refetch that also needs a value to resolve to — same gotcha noted
    // in ClubContactFormPage.test.tsx.
    listSponsorContacts.mockResolvedValue([makeContact({ id: 'contact-1', role: 'Marketing Contact' })])
    updateSponsorContact.mockResolvedValueOnce(makeContact({ id: 'contact-1', role: 'Senior Marketing Contact' }))

    renderPage('/manage/sponsors/test-sponsor-id/contacts/contact-1/edit', 'test-club-id')

    await screen.findByText('Edit Contact')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(updateSponsorContact).toHaveBeenCalledTimes(1)
    const [clubId, sponsorId, contactId, payload] = updateSponsorContact.mock.calls[0]
    expect(clubId).toBe('test-club-id')
    expect(sponsorId).toBe('test-sponsor-id')
    expect(contactId).toBe('contact-1')
    expect(payload).toMatchObject({ role: 'Marketing Contact' })

    expect(await screen.findByText('Contact List Page')).toBeInTheDocument()
  })
})
