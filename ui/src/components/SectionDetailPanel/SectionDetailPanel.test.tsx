import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { SectionDetailPanel } from './SectionDetailPanel'
import type { SectionDetailPanelProps } from './SectionDetailPanel'
import type { Section } from '../../api/sectionApi'
import type { ClubContact } from '../../api/clubContactApi'
import type { Team } from '../../api/teamApi'

// Minimal coverage for now — test-writer fleshes this out per docs/plans/025-club-structure.md's
// Frontend tests section (field round-trip, link/unlink/create-and-link wiring).

const SECTION: Section = {
  id: 'u13',
  clubId: 'club-1',
  parentSectionId: 'juniors',
  name: 'U13',
  minAge: 11,
  maxAge: 13,
  gender: null,
  active: true,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  updatedBy: null,
}

const CONTACT: ClubContact = {
  id: 'contact-1',
  clubId: 'club-1',
  contact: { firstName: 'Jane', lastName: 'Smith', email: 'jane@example.com', phone: '+27 21 555 0100' },
  role: 'Coach',
  isPrimary: false,
  active: true,
  photoUrl: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  updatedBy: null,
}

function makeTeam(overrides: Partial<Team> = {}): Team {
  return {
    id: 'team-1',
    clubId: 'club-1',
    sectionId: 'u13',
    name: '1st XI',
    logoUrl: null,
    active: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: null,
    ...overrides,
  }
}

const DEFAULT_PROPS: SectionDetailPanelProps = {
  clubId: 'club-1',
  section: SECTION,
  breadcrumb: [],
  onUpdate: vi.fn(),
  contacts: [],
  teams: [],
  onLinkExisting: vi.fn(),
  onCreateAndLink: vi.fn(),
  onUnlink: vi.fn(),
}

// The new "Manage Teams" block (docs/specs/026-teams.md) renders a real RouterLink-backed button,
// so every render needs a Router context — same MemoryRouter wrapper other page/component tests
// already use for RouterLink-backed content.
function renderPanel(props: Partial<SectionDetailPanelProps> = {}) {
  return render(
    <MemoryRouter>
      <SectionDetailPanel {...DEFAULT_PROPS} {...props} />
    </MemoryRouter>,
  )
}

describe('SectionDetailPanel', () => {
  it('renders the breadcrumb, name, and eligibility fields for the selected section', () => {
    renderPanel({ breadcrumb: ['Juniors'] })

    expect(screen.getByText('Juniors')).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toHaveValue('U13')
    expect(screen.getByLabelText('Minimum age')).toHaveValue(11)
    expect(screen.getByLabelText('Maximum age')).toHaveValue(13)
  })

  it('commits a renamed name on blur', async () => {
    const user = userEvent.setup()
    const onUpdate = vi.fn()
    renderPanel({ onUpdate })

    const nameField = screen.getByLabelText('Name')
    await user.clear(nameField)
    await user.type(nameField, 'U13A')
    await user.tab()

    expect(onUpdate).toHaveBeenCalledWith({ name: 'U13A' })
  })

  it('renders linked contacts and calls onUnlink', async () => {
    const user = userEvent.setup()
    const onUnlink = vi.fn()
    renderPanel({ contacts: [CONTACT], onUnlink })

    expect(screen.getByText('Jane Smith')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Unlink Jane Smith' }))
    expect(onUnlink).toHaveBeenCalledWith('contact-1')
  })

  it('calls onLinkExisting and onCreateAndLink from their respective actions', async () => {
    const user = userEvent.setup()
    const onLinkExisting = vi.fn()
    const onCreateAndLink = vi.fn()
    renderPanel({ onLinkExisting, onCreateAndLink })

    await user.click(screen.getByRole('button', { name: 'Link existing' }))
    await user.click(screen.getByRole('button', { name: '+ New contact' }))

    expect(onLinkExisting).toHaveBeenCalledTimes(1)
    expect(onCreateAndLink).toHaveBeenCalledTimes(1)
  })

  it('does not call onUpdate when the name field is blurred without an actual change', async () => {
    const user = userEvent.setup()
    const onUpdate = vi.fn()
    renderPanel({ onUpdate })

    await user.click(screen.getByLabelText('Name'))
    await user.tab()

    expect(onUpdate).not.toHaveBeenCalled()
  })

  it('shows a validation error and does not call onUpdate when minAge > maxAge', async () => {
    const user = userEvent.setup()
    const onUpdate = vi.fn()
    renderPanel({ onUpdate })

    const minAgeField = screen.getByLabelText('Minimum age')
    await user.clear(minAgeField)
    await user.type(minAgeField, '20')
    await user.tab()

    expect(await screen.findByText(/minimum age must not be greater than maximum age/i)).toBeInTheDocument()
    expect(onUpdate).not.toHaveBeenCalled()
  })

  it('commits an eligibility field change on blur when the value actually changed', async () => {
    const user = userEvent.setup()
    const onUpdate = vi.fn()
    renderPanel({ onUpdate })

    const minAgeField = screen.getByLabelText('Minimum age')
    await user.clear(minAgeField)
    await user.type(minAgeField, '12')
    await user.tab()

    expect(onUpdate).toHaveBeenCalledWith({ minAge: 12, maxAge: 13 })
  })

  it('round-trips the gender select\'s "Not specified" option to null', async () => {
    const user = userEvent.setup()
    const onUpdate = vi.fn()
    renderPanel({ section: { ...SECTION, gender: 'MALE' }, onUpdate })

    await user.click(screen.getByLabelText('Gender'))
    await user.click(await screen.findByRole('option', { name: 'Not specified' }))

    expect(onUpdate).toHaveBeenCalledWith({ gender: null })
  })

  it('selecting a real gender option calls onUpdate with that value', async () => {
    const user = userEvent.setup()
    const onUpdate = vi.fn()
    renderPanel({ onUpdate })

    await user.click(screen.getByLabelText('Gender'))
    await user.click(await screen.findByRole('option', { name: 'Female' }))

    expect(onUpdate).toHaveBeenCalledWith({ gender: 'FEMALE' })
  })

  it('shows an inactive banner with a reactivate action, and calls onReactivate when clicked', async () => {
    const user = userEvent.setup()
    const onReactivate = vi.fn()
    renderPanel({ section: { ...SECTION, active: false }, onReactivate })

    expect(screen.getByText(/this section is inactive/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Reactivate' }))

    expect(onReactivate).toHaveBeenCalledTimes(1)
  })

  it('focuses and selects the Name field when focusNameSignal changes — the tree toolbar\'s "Rename" action, which only shows on an already-selected node and so has no other observable effect', async () => {
    const { rerender } = render(
      <MemoryRouter>
        <SectionDetailPanel {...DEFAULT_PROPS} focusNameSignal={0} />
      </MemoryRouter>,
    )

    const nameField = screen.getByLabelText('Name')
    expect(nameField).not.toHaveFocus()

    rerender(
      <MemoryRouter>
        <SectionDetailPanel {...DEFAULT_PROPS} focusNameSignal={1} />
      </MemoryRouter>,
    )

    await waitFor(() => expect(nameField).toHaveFocus())
  })

  it('does not render an inactive banner for an active section', () => {
    renderPanel()

    expect(screen.queryByText(/this section is inactive/i)).not.toBeInTheDocument()
  })

  it('renders the "Manage Teams" entry point linking to this section\'s teams route', () => {
    renderPanel({ section: { ...SECTION, id: 'section-42' } })

    const link = screen.getByRole('link', { name: 'Manage Teams' })
    expect(link).toHaveAttribute('href', '/manage/sections/section-42/teams')
  })

  it('renders the "Manage Teams" entry point regardless of the section\'s active state', () => {
    renderPanel({ section: { ...SECTION, id: 'section-99', active: false }, onReactivate: vi.fn() })

    expect(screen.getByRole('link', { name: 'Manage Teams' })).toHaveAttribute(
      'href',
      '/manage/sections/section-99/teams',
    )
  })

  it('shows a "No teams yet" caption when the section has no teams', () => {
    renderPanel({ teams: [] })

    expect(screen.getByText('No teams yet')).toBeInTheDocument()
  })

  it('renders a badge per team, muted for inactive ones', () => {
    renderPanel({
      teams: [makeTeam({ id: 'team-active', name: '1st XI', active: true }), makeTeam({ id: 'team-inactive', name: '2nd XI', active: false })],
    })

    expect(screen.queryByText('No teams yet')).not.toBeInTheDocument()
    expect(screen.getByText('1st XI')).toBeInTheDocument()
    expect(screen.getByText('2nd XI')).toBeInTheDocument()
    // The muted chip carries reduced opacity — assert via the chip root's computed style rather
    // than a snapshot, matching how the rest of this suite avoids brittle style assertions
    // elsewhere; opacity is the one distinguishing inline style MUTED_CHIP_SX sets.
    const inactiveChip = screen.getByText('2nd XI').closest('.MuiChip-root')
    expect(inactiveChip).toHaveStyle({ opacity: '0.7' })
    const activeChip = screen.getByText('1st XI').closest('.MuiChip-root')
    expect(activeChip).not.toHaveStyle({ opacity: '0.7' })
  })
})
