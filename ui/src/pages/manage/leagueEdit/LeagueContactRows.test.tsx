import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { LeagueContactRows } from './LeagueContactRows'
import type { LeagueContact } from '../../../api/leagueContactApi'

function makeContact(overrides: Partial<LeagueContact> = {}): LeagueContact {
  return {
    id: 'contact-1',
    leagueId: 'league-1',
    contact: { firstName: 'Jane', lastName: 'Smith', email: 'jane.smith@example.com', phone: '+27 21 555 0100' },
    role: 'League Administrator',
    isPrimary: false,
    active: true,
    createdAt: '',
    updatedAt: '',
    updatedBy: null,
    ...overrides,
  }
}

function setPhone(phone: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: phone && query.includes('max-width'),
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}

afterEach(() => {
  delete (window as { matchMedia?: unknown }).matchMedia
})

function renderRows(contacts: LeagueContact[]) {
  return render(
    <MemoryRouter initialEntries={['/start']}>
      <Routes>
        <Route path="/start" element={<LeagueContactRows leagueId="league-1" contacts={contacts} />} />
        <Route path="/manage/fixtures/leagues/:leagueId/contacts/new" element={<div>Add contact page</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('LeagueContactRows', () => {
  it('shows the heading with the count and a row per contact with name, role, email and phone', () => {
    renderRows([
      makeContact(),
      makeContact({ id: 'contact-2', contact: { firstName: 'Sam', lastName: 'Jones', email: '', phone: '' }, role: 'Umpire Coordinator' }),
    ])

    expect(screen.getByRole('heading', { name: 'Contacts · 2' })).toBeInTheDocument()
    const [first, second] = screen.getAllByTestId('league-contact-row')
    expect(within(first).getByText('Jane Smith')).toBeInTheDocument()
    expect(within(first).getByTestId('league-contact-role')).toHaveTextContent('League Administrator')
    expect(within(first).getByTestId('league-contact-email')).toHaveTextContent('jane.smith@example.com')
    expect(within(first).getByTestId('league-contact-phone')).toHaveTextContent('+27 21 555 0100')
    expect(within(first).getByText('JS')).toBeInTheDocument()
    expect(within(second).getByTestId('league-contact-email')).toHaveTextContent('-')
    expect(within(second).getByTestId('league-contact-phone')).toHaveTextContent('-')
  })

  it('marks Role, Email and Phone as desktop only', () => {
    renderRows([makeContact()])

    const row = screen.getByTestId('league-contact-row')
    for (const id of ['league-contact-role', 'league-contact-email', 'league-contact-phone']) {
      expect(within(row).getByTestId(id)).toHaveAttribute('data-desktop-only', 'true')
    }
  })

  it('shows the Primary badge for a primary contact and Inactive for an inactive one, none otherwise', () => {
    renderRows([
      makeContact({ id: 'c1', isPrimary: true }),
      makeContact({ id: 'c2', active: false }),
      makeContact({ id: 'c3' }),
    ])

    const [primary, inactive, plain] = screen.getAllByTestId('league-contact-row')
    expect(within(primary).getByTestId('league-contact-badge')).toHaveTextContent('Primary')
    expect(within(inactive).getByTestId('league-contact-badge')).toHaveTextContent('Inactive')
    expect(within(plain).queryByTestId('league-contact-badge')).not.toBeInTheDocument()
  })

  it('links the name and the View and Edit icons to the contact routes', () => {
    renderRows([makeContact({ id: 'contact-9' })])

    expect(screen.getByRole('link', { name: 'Jane Smith' })).toHaveAttribute(
      'href',
      '/manage/fixtures/leagues/league-1/contacts/contact-9',
    )
    expect(screen.getByRole('link', { name: 'View Jane Smith' })).toHaveAttribute(
      'href',
      '/manage/fixtures/leagues/league-1/contacts/contact-9',
    )
    expect(screen.getByRole('link', { name: 'Edit Jane Smith' })).toHaveAttribute(
      'href',
      '/manage/fixtures/leagues/league-1/contacts/contact-9/edit',
    )
  })

  it('on a phone shows the role under the name and a three-dot menu holding View and Edit', async () => {
    setPhone(true)
    const user = userEvent.setup()
    renderRows([makeContact({ id: 'contact-9' })])

    expect(screen.getByTestId('league-contact-phone-role')).toHaveTextContent('League Administrator')
    expect(screen.queryByRole('link', { name: 'View Jane Smith' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Jane Smith, more actions' }))

    expect(screen.getByRole('menuitem', { name: 'View' })).toHaveAttribute(
      'href',
      '/manage/fixtures/leagues/league-1/contacts/contact-9',
    )
    expect(screen.getByRole('menuitem', { name: 'Edit' })).toHaveAttribute(
      'href',
      '/manage/fixtures/leagues/league-1/contacts/contact-9/edit',
    )
  })

  it('keeps the empty line and the Add contact button when there are no contacts', async () => {
    const user = userEvent.setup()
    renderRows([])

    expect(screen.getByRole('heading', { name: 'Contacts · 0' })).toBeInTheDocument()
    expect(screen.getByText('No contacts yet for this league.')).toBeInTheDocument()
    expect(screen.queryByTestId('league-contact-row')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Add contact' }))

    expect(await screen.findByText('Add contact page')).toBeInTheDocument()
  })
})
