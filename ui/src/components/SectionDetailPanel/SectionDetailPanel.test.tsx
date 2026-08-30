import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SectionDetailPanel } from './SectionDetailPanel'
import type { Section } from '../../api/sectionApi'
import type { ClubContact } from '../../api/clubContactApi'

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

describe('SectionDetailPanel', () => {
  it('renders the breadcrumb, name, and eligibility fields for the selected section', () => {
    render(
      <SectionDetailPanel
        section={SECTION}
        breadcrumb={['Juniors']}
        onUpdate={vi.fn()}
        contacts={[]}
        onLinkExisting={vi.fn()}
        onCreateAndLink={vi.fn()}
        onUnlink={vi.fn()}
      />,
    )

    expect(screen.getByText('Juniors')).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toHaveValue('U13')
    expect(screen.getByLabelText('Minimum age')).toHaveValue(11)
    expect(screen.getByLabelText('Maximum age')).toHaveValue(13)
  })

  it('commits a renamed name on blur', async () => {
    const user = userEvent.setup()
    const onUpdate = vi.fn()
    render(
      <SectionDetailPanel
        section={SECTION}
        breadcrumb={[]}
        onUpdate={onUpdate}
        contacts={[]}
        onLinkExisting={vi.fn()}
        onCreateAndLink={vi.fn()}
        onUnlink={vi.fn()}
      />,
    )

    const nameField = screen.getByLabelText('Name')
    await user.clear(nameField)
    await user.type(nameField, 'U13A')
    await user.tab()

    expect(onUpdate).toHaveBeenCalledWith({ name: 'U13A' })
  })

  it('renders linked contacts and calls onUnlink', async () => {
    const user = userEvent.setup()
    const onUnlink = vi.fn()
    render(
      <SectionDetailPanel
        section={SECTION}
        breadcrumb={[]}
        onUpdate={vi.fn()}
        contacts={[CONTACT]}
        onLinkExisting={vi.fn()}
        onCreateAndLink={vi.fn()}
        onUnlink={onUnlink}
      />,
    )

    expect(screen.getByText('Jane Smith')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Unlink Jane Smith' }))
    expect(onUnlink).toHaveBeenCalledWith('contact-1')
  })

  it('calls onLinkExisting and onCreateAndLink from their respective actions', async () => {
    const user = userEvent.setup()
    const onLinkExisting = vi.fn()
    const onCreateAndLink = vi.fn()
    render(
      <SectionDetailPanel
        section={SECTION}
        breadcrumb={[]}
        onUpdate={vi.fn()}
        contacts={[]}
        onLinkExisting={onLinkExisting}
        onCreateAndLink={onCreateAndLink}
        onUnlink={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Link existing' }))
    await user.click(screen.getByRole('button', { name: '+ New contact' }))

    expect(onLinkExisting).toHaveBeenCalledTimes(1)
    expect(onCreateAndLink).toHaveBeenCalledTimes(1)
  })

  it('does not call onUpdate when the name field is blurred without an actual change', async () => {
    const user = userEvent.setup()
    const onUpdate = vi.fn()
    render(
      <SectionDetailPanel
        section={SECTION}
        breadcrumb={[]}
        onUpdate={onUpdate}
        contacts={[]}
        onLinkExisting={vi.fn()}
        onCreateAndLink={vi.fn()}
        onUnlink={vi.fn()}
      />,
    )

    await user.click(screen.getByLabelText('Name'))
    await user.tab()

    expect(onUpdate).not.toHaveBeenCalled()
  })

  it('shows a validation error and does not call onUpdate when minAge > maxAge', async () => {
    const user = userEvent.setup()
    const onUpdate = vi.fn()
    render(
      <SectionDetailPanel
        section={SECTION}
        breadcrumb={[]}
        onUpdate={onUpdate}
        contacts={[]}
        onLinkExisting={vi.fn()}
        onCreateAndLink={vi.fn()}
        onUnlink={vi.fn()}
      />,
    )

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
    render(
      <SectionDetailPanel
        section={SECTION}
        breadcrumb={[]}
        onUpdate={onUpdate}
        contacts={[]}
        onLinkExisting={vi.fn()}
        onCreateAndLink={vi.fn()}
        onUnlink={vi.fn()}
      />,
    )

    const minAgeField = screen.getByLabelText('Minimum age')
    await user.clear(minAgeField)
    await user.type(minAgeField, '12')
    await user.tab()

    expect(onUpdate).toHaveBeenCalledWith({ minAge: 12, maxAge: 13 })
  })

  it('round-trips the gender select\'s "Not specified" option to null', async () => {
    const user = userEvent.setup()
    const onUpdate = vi.fn()
    render(
      <SectionDetailPanel
        section={{ ...SECTION, gender: 'MALE' }}
        breadcrumb={[]}
        onUpdate={onUpdate}
        contacts={[]}
        onLinkExisting={vi.fn()}
        onCreateAndLink={vi.fn()}
        onUnlink={vi.fn()}
      />,
    )

    await user.click(screen.getByLabelText('Gender'))
    await user.click(await screen.findByRole('option', { name: 'Not specified' }))

    expect(onUpdate).toHaveBeenCalledWith({ gender: null })
  })

  it('selecting a real gender option calls onUpdate with that value', async () => {
    const user = userEvent.setup()
    const onUpdate = vi.fn()
    render(
      <SectionDetailPanel
        section={SECTION}
        breadcrumb={[]}
        onUpdate={onUpdate}
        contacts={[]}
        onLinkExisting={vi.fn()}
        onCreateAndLink={vi.fn()}
        onUnlink={vi.fn()}
      />,
    )

    await user.click(screen.getByLabelText('Gender'))
    await user.click(await screen.findByRole('option', { name: 'Female' }))

    expect(onUpdate).toHaveBeenCalledWith({ gender: 'FEMALE' })
  })

  it('shows an inactive banner with a reactivate action, and calls onReactivate when clicked', async () => {
    const user = userEvent.setup()
    const onReactivate = vi.fn()
    render(
      <SectionDetailPanel
        section={{ ...SECTION, active: false }}
        breadcrumb={[]}
        onUpdate={vi.fn()}
        contacts={[]}
        onLinkExisting={vi.fn()}
        onCreateAndLink={vi.fn()}
        onUnlink={vi.fn()}
        onReactivate={onReactivate}
      />,
    )

    expect(screen.getByText(/this section is inactive/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Reactivate' }))

    expect(onReactivate).toHaveBeenCalledTimes(1)
  })

  it('does not render an inactive banner for an active section', () => {
    render(
      <SectionDetailPanel
        section={SECTION}
        breadcrumb={[]}
        onUpdate={vi.fn()}
        contacts={[]}
        onLinkExisting={vi.fn()}
        onCreateAndLink={vi.fn()}
        onUnlink={vi.fn()}
      />,
    )

    expect(screen.queryByText(/this section is inactive/i)).not.toBeInTheDocument()
  })
})
