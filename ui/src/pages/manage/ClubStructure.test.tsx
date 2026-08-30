import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ClubStructure from './ClubStructure'
import type { Section } from '../../api/sectionApi'
import type { ClubContact } from '../../api/clubContactApi'

const listSections = vi.fn()
const createSection = vi.fn()
const updateSection = vi.fn()
const deactivateSection = vi.fn()
const reactivateSection = vi.fn()
const listSectionContacts = vi.fn()
const linkSectionContact = vi.fn()
const unlinkSectionContact = vi.fn()

vi.mock('../../api/sectionApi', () => ({
  listSections: (clubId: string) => listSections(clubId),
  createSection: (clubId: string, payload: unknown) => createSection(clubId, payload),
  updateSection: (clubId: string, sectionId: string, payload: unknown) => updateSection(clubId, sectionId, payload),
  deactivateSection: (clubId: string, sectionId: string) => deactivateSection(clubId, sectionId),
  reactivateSection: (clubId: string, sectionId: string) => reactivateSection(clubId, sectionId),
  listSectionContacts: (clubId: string, sectionId: string) => listSectionContacts(clubId, sectionId),
  linkSectionContact: (clubId: string, sectionId: string, contactId: string) =>
    linkSectionContact(clubId, sectionId, contactId),
  unlinkSectionContact: (clubId: string, sectionId: string, contactId: string) =>
    unlinkSectionContact(clubId, sectionId, contactId),
}))

const listClubContacts = vi.fn()
const createClubContact = vi.fn()

vi.mock('../../api/clubContactApi', () => ({
  listClubContacts: (clubId: string) => listClubContacts(clubId),
  createClubContact: (clubId: string, payload: unknown) => createClubContact(clubId, payload),
}))

beforeEach(() => {
  vi.clearAllMocks()
  // Low-priority defaults so a background refetch beyond a test's own queued
  // mockResolvedValueOnce calls (e.g. after a mutation's onSuccess invalidates a query the
  // component is still subscribed to) resolves to something rather than undefined.
  listSectionContacts.mockResolvedValue([])
  listClubContacts.mockResolvedValue([])
})

function makeSection(overrides: Partial<Section> = {}): Section {
  return {
    id: 'juniors',
    clubId: 'test-club-id',
    parentSectionId: null,
    name: 'Juniors',
    minAge: null,
    maxAge: null,
    gender: null,
    active: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: null,
    ...overrides,
  }
}

function makeContact(overrides: Partial<ClubContact> = {}): ClubContact {
  return {
    id: 'contact-1',
    clubId: 'test-club-id',
    contact: { firstName: 'Jane', lastName: 'Smith', email: 'jane.smith@example.com', phone: '+27 21 555 0100' },
    role: 'Treasurer',
    isPrimary: false,
    active: true,
    photoUrl: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: null,
    ...overrides,
  }
}

// Same wrapper-route shape as ClubContactList.test.tsx, reproducing ManagerHome's Outlet context
// without pulling ManagerHome itself in.
function OutletContextWrapper({ clubId }: { clubId?: string }) {
  return <Outlet context={{ clubId }} />
}

function renderPage(clubId?: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/manage/sections']}>
        <Routes>
          <Route path="/manage" element={<OutletContextWrapper clubId={clubId} />}>
            <Route path="sections" element={<ClubStructure />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('ClubStructure', () => {
  it('renders "Not authorized" and does not fetch when no clubId is in the Outlet context', () => {
    renderPage(undefined)

    expect(screen.getByText('Not authorized')).toBeInTheDocument()
    expect(listSections).not.toHaveBeenCalled()
  })

  it('renders the "start from a template" / "start blank" choice when the club has no sections yet', async () => {
    listSections.mockResolvedValueOnce([])

    renderPage('test-club-id')

    expect(await screen.findByText("Build your club's section tree")).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start from a template' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start blank' })).toBeInTheDocument()
  })

  it('"Start blank" leaves the tree empty and renders the tree editor instead of the template choice', async () => {
    const user = userEvent.setup()
    listSections.mockResolvedValueOnce([])

    renderPage('test-club-id')

    await user.click(await screen.findByRole('button', { name: 'Start blank' }))

    expect(screen.queryByText("Build your club's section tree")).not.toBeInTheDocument()
    expect(screen.getByText(/no sections yet/i)).toBeInTheDocument()
    expect(createSection).not.toHaveBeenCalled()
  })

  it('"Start from a template" builds the starter tree via createSection calls', async () => {
    const user = userEvent.setup()
    listSections.mockResolvedValueOnce([])
    createSection.mockImplementation((_clubId, payload) =>
      Promise.resolve(makeSection({ id: `${payload.name}-id`, name: payload.name, parentSectionId: payload.parentSectionId })),
    )
    // onSuccess invalidates the sections list, triggering a refetch.
    listSections.mockResolvedValueOnce([makeSection({ id: 'Open Sides-id', name: 'Open Sides' })])

    renderPage('test-club-id')

    await user.click(await screen.findByRole('button', { name: 'Start from a template' }))

    await waitFor(() => expect(createSection).toHaveBeenCalled())
    // 3 top-level groups + 6 children (2 each) from ClubStructure.tsx's STARTER_TEMPLATE.
    await waitFor(() => expect(createSection).toHaveBeenCalledTimes(9))
  })

  it('selecting a node loads its linked contacts via a real query', async () => {
    const user = userEvent.setup()
    listSections.mockResolvedValueOnce([makeSection({ id: 'juniors', name: 'Juniors' })])
    listSectionContacts.mockResolvedValueOnce([])

    renderPage('test-club-id')

    await user.click(await screen.findByText('Juniors'))

    await waitFor(() => expect(listSectionContacts).toHaveBeenCalledWith('test-club-id', 'juniors'))
  })

  it('clicking "Add top-level section" calls createSection with the right club and payload', async () => {
    const user = userEvent.setup()
    listSections.mockResolvedValueOnce([])
    createSection.mockResolvedValueOnce(makeSection({ id: 'new-section' }))
    listSections.mockResolvedValueOnce([makeSection({ id: 'new-section', name: 'New section' })])

    renderPage('test-club-id')

    await user.click(await screen.findByRole('button', { name: 'Start blank' }))
    await user.click(screen.getByRole('button', { name: /add top-level section/i }))

    expect(createSection).toHaveBeenCalledWith('test-club-id', {
      name: 'New section',
      parentSectionId: null,
      minAge: null,
      maxAge: null,
      gender: null,
    })
  })

  it('renaming the selected node via the detail panel calls updateSection with the merged payload', async () => {
    const user = userEvent.setup()
    listSections.mockResolvedValueOnce([makeSection({ id: 'juniors', name: 'Juniors', minAge: 6, maxAge: 18 })])
    listSectionContacts.mockResolvedValueOnce([])
    updateSection.mockResolvedValueOnce(makeSection({ id: 'juniors', name: 'Youth' }))
    listSections.mockResolvedValueOnce([makeSection({ id: 'juniors', name: 'Youth', minAge: 6, maxAge: 18 })])

    renderPage('test-club-id')

    await user.click(await screen.findByText('Juniors'))
    const nameField = await screen.findByLabelText('Name')
    await user.clear(nameField)
    await user.type(nameField, 'Youth')
    await user.tab()

    await waitFor(() =>
      expect(updateSection).toHaveBeenCalledWith('test-club-id', 'juniors', {
        name: 'Youth',
        minAge: 6,
        maxAge: 18,
        gender: null,
      }),
    )
  })

  it('removing a leaf node calls deactivateSection with the right club and section id', async () => {
    const user = userEvent.setup()
    listSections.mockResolvedValueOnce([makeSection({ id: 'juniors', name: 'Juniors' })])
    listSectionContacts.mockResolvedValueOnce([])
    deactivateSection.mockResolvedValueOnce(makeSection({ id: 'juniors', active: false }))
    listSections.mockResolvedValueOnce([makeSection({ id: 'juniors', name: 'Juniors', active: false })])

    renderPage('test-club-id')

    await user.click(await screen.findByText('Juniors'))
    await user.click(await screen.findByRole('button', { name: 'Remove Juniors' }))

    expect(deactivateSection).toHaveBeenCalledWith('test-club-id', 'juniors')
  })

  it('removing a section with nothing attached (deactivateSection resolves null) clears the selection instead of showing the removed node\'s detail panel', async () => {
    const user = userEvent.setup()
    // A second section stays behind so the tree/detail-panel view remains after the removal —
    // isolates the selectedId-clearing behavior from the separate "zero sections at all" empty
    // state, which is its own, already-covered case.
    listSections.mockResolvedValueOnce([
      makeSection({ id: 'juniors', name: 'Juniors' }),
      makeSection({ id: 'vets', name: 'Vets' }),
    ])
    listSectionContacts.mockResolvedValueOnce([])
    // null = the section had nothing attached and was actually deleted server-side, not
    // soft-deactivated (docs/specs/025-club-structure.md's Data Model Changes Remove rule).
    deactivateSection.mockResolvedValueOnce(null)
    listSections.mockResolvedValueOnce([makeSection({ id: 'vets', name: 'Vets' })])

    renderPage('test-club-id')

    await user.click(await screen.findByText('Juniors'))
    await screen.findByLabelText('Name')
    await user.click(screen.getByRole('button', { name: 'Remove Juniors' }))

    await waitFor(() => expect(deactivateSection).toHaveBeenCalledWith('test-club-id', 'juniors'))
    expect(await screen.findByText('Select a section')).toBeInTheDocument()
  })

  it('reactivating an inactive selected node calls reactivateSection', async () => {
    const user = userEvent.setup()
    listSections.mockResolvedValueOnce([makeSection({ id: 'juniors', name: 'Juniors', active: false })])
    listSectionContacts.mockResolvedValueOnce([])
    reactivateSection.mockResolvedValueOnce(makeSection({ id: 'juniors', active: true }))
    listSections.mockResolvedValueOnce([makeSection({ id: 'juniors', name: 'Juniors', active: true })])

    renderPage('test-club-id')

    await user.click(await screen.findByText('Juniors'))
    await user.click(await screen.findByRole('button', { name: 'Reactivate' }))

    expect(reactivateSection).toHaveBeenCalledWith('test-club-id', 'juniors')
  })

  it('the "link existing contact" dialog filters out contacts already linked to the selected section', async () => {
    const user = userEvent.setup()
    listSections.mockResolvedValueOnce([makeSection({ id: 'juniors', name: 'Juniors' })])
    listSectionContacts.mockResolvedValueOnce([makeContact({ id: 'linked-contact' })])
    listClubContacts.mockResolvedValueOnce([
      makeContact({ id: 'linked-contact' }),
      makeContact({
        id: 'linkable-contact',
        contact: { firstName: 'Bob', lastName: 'Jones', email: 'bob@example.com', phone: '+27 21 555 0199' },
        role: 'Coach',
      }),
    ])

    renderPage('test-club-id')

    await user.click(await screen.findByText('Juniors'))
    await screen.findByText('Jane Smith')
    await user.click(screen.getByRole('button', { name: 'Link existing' }))

    const combobox = await screen.findByRole('combobox', { name: 'Search contacts' })
    await user.click(combobox)

    const listbox = await screen.findByRole('listbox')
    expect(within(listbox).getByText(/Bob Jones/)).toBeInTheDocument()
    expect(within(listbox).queryByText(/Jane Smith/)).not.toBeInTheDocument()
  })

  it('selecting a contact from the "link existing" dialog calls linkSectionContact', async () => {
    const user = userEvent.setup()
    listSections.mockResolvedValueOnce([makeSection({ id: 'juniors', name: 'Juniors' })])
    listSectionContacts.mockResolvedValueOnce([])
    listClubContacts.mockResolvedValueOnce([makeContact({ id: 'linkable-contact' })])
    linkSectionContact.mockResolvedValueOnce(undefined)
    listSectionContacts.mockResolvedValueOnce([makeContact({ id: 'linkable-contact' })])

    renderPage('test-club-id')

    await user.click(await screen.findByText('Juniors'))
    await user.click(screen.getByRole('button', { name: 'Link existing' }))

    const combobox = await screen.findByRole('combobox', { name: 'Search contacts' })
    await user.click(combobox)
    await user.click(await screen.findByText(/Jane Smith/))

    expect(linkSectionContact).toHaveBeenCalledWith('test-club-id', 'juniors', 'linkable-contact')
  })

  it('unlinking a contact from the detail panel calls unlinkSectionContact with the right contact id', async () => {
    const user = userEvent.setup()
    listSections.mockResolvedValueOnce([makeSection({ id: 'juniors', name: 'Juniors' })])
    listSectionContacts.mockResolvedValueOnce([makeContact({ id: 'linked-contact' })])
    unlinkSectionContact.mockResolvedValueOnce(undefined)
    listSectionContacts.mockResolvedValueOnce([])

    renderPage('test-club-id')

    await user.click(await screen.findByText('Juniors'))
    await screen.findByText('Jane Smith')
    await user.click(screen.getByRole('button', { name: 'Unlink Jane Smith' }))

    expect(unlinkSectionContact).toHaveBeenCalledWith('test-club-id', 'juniors', 'linked-contact')
  })

  it('the "create and link" dialog calls createClubContact then linkSectionContact in sequence', async () => {
    const user = userEvent.setup()
    listSections.mockResolvedValueOnce([makeSection({ id: 'juniors', name: 'Juniors' })])
    listSectionContacts.mockResolvedValueOnce([])
    createClubContact.mockResolvedValueOnce(makeContact({ id: 'new-contact' }))
    linkSectionContact.mockResolvedValueOnce(undefined)
    listSectionContacts.mockResolvedValueOnce([makeContact({ id: 'new-contact' })])

    renderPage('test-club-id')

    await user.click(await screen.findByText('Juniors'))
    await user.click(screen.getByRole('button', { name: '+ New contact' }))

    await user.type(await screen.findByLabelText('First name'), 'Bob')
    await user.type(screen.getByLabelText('Last name'), 'Jones')
    await user.type(screen.getByLabelText('Email'), 'bob.jones@example.com')
    await user.type(screen.getByLabelText('Phone'), '+27 21 555 0199')
    await user.type(screen.getByLabelText('Role'), 'Coach')
    await user.click(screen.getByRole('button', { name: 'Create & link' }))

    await waitFor(() => expect(createClubContact).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(linkSectionContact).toHaveBeenCalledWith('test-club-id', 'juniors', 'new-contact'))

    const createOrder = createClubContact.mock.invocationCallOrder[0]
    const linkOrder = linkSectionContact.mock.invocationCallOrder[0]
    expect(createOrder).toBeLessThan(linkOrder)
  })
})
