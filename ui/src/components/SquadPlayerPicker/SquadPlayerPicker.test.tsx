import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SquadPlayerPicker } from './SquadPlayerPicker'
import type { SquadPlayerPickerProps } from './SquadPlayerPicker'
import type { Player } from '../../api/playerApi'
import type { Section } from '../../api/sectionApi'

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'player-1',
    personId: 'person-1',
    clubId: 'club-1',
    firstName: 'Jane',
    lastName: 'Smith',
    dateOfBirth: null,
    gender: null,
    photoUrl: null,
    clubMembershipNumber: null,
    medicalAidProvider: null,
    medicalAidMemberNumber: null,
    phone: null,
    email: null,
    altContactName: null,
    altContactPhone: null,
    battingStance: null,
    bowlingArm: null,
    bowlingType: null,
    isWicketKeeper: false,
    active: true,
    sectionIds: [],
    jerseyNumber: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: null,
    verificationStatus: 'VERIFIED',
    gamesThisSeason: 0,
    gamesOverall: 0,
    ...overrides,
  }
}

function makeSection(overrides: Partial<Section> = {}): Section {
  return {
    id: 'section-men',
    clubId: 'club-1',
    parentSectionId: null,
    name: 'Men',
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

const sections = [makeSection(), makeSection({ id: 'section-u15', name: 'U15' })]

const candidates = [
  makePlayer({ id: 'p-bob', firstName: 'Bob', lastName: 'Jones', dateOfBirth: '1990-03-02', sectionIds: ['section-men'] }),
  makePlayer({ id: 'p-amy', firstName: 'Amy', lastName: 'Adams', dateOfBirth: '2012-06-10', sectionIds: ['section-u15', 'section-men'] }),
  makePlayer({ id: 'p-kid', firstName: 'Kim', lastName: 'Young', dateOfBirth: null, sectionIds: ['section-u15'] }),
]

function renderPicker(overrides: Partial<SquadPlayerPickerProps> = {}) {
  const props: SquadPlayerPickerProps = {
    open: true,
    onClose: vi.fn(),
    candidates,
    sections,
    defaultSectionId: 'section-men',
    onAdd: vi.fn(),
    ...overrides,
  }
  render(<SquadPlayerPicker {...props} />)
  return props
}

describe('SquadPlayerPicker', () => {
  it('starts on the team section and lists only its players, sorted by surname', () => {
    renderPicker()

    const rows = screen.getAllByTestId('squad-picker-row')
    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveTextContent('Amy Adams')
    expect(rows[1]).toHaveTextContent('Bob Jones')
    expect(screen.queryByText('Kim Young')).not.toBeInTheDocument()
  })

  it('shows each row with age, date of birth and section names, so same-named players can be told apart', () => {
    renderPicker()

    const amy = screen.getAllByTestId('squad-picker-row')[0]
    expect(amy).toHaveTextContent(/Age \d+ · 2012-06-10 · U15, Men/)
  })

  it('shows "No date of birth" for a player without one', async () => {
    const user = userEvent.setup()
    renderPicker()

    await user.click(screen.getByRole('combobox', { name: 'Section' }))
    await user.click(await screen.findByRole('option', { name: 'U15' }))

    expect(screen.getByText(/No date of birth · U15/)).toBeInTheDocument()
  })

  it.each([
    ['an unknown section', 'section-gone', undefined],
    ['an inactive section', 'section-old', [...sections, makeSection({ id: 'section-old', name: 'Old', active: false })]],
  ])('falls back to All Sections when the default is %s', (_label, defaultSectionId, withSections) => {
    renderPicker({ defaultSectionId, sections: withSections ?? sections })

    expect(screen.getAllByTestId('squad-picker-row')).toHaveLength(3)
  })

  it('All Sections lifts the filter', async () => {
    const user = userEvent.setup()
    renderPicker()

    await user.click(screen.getByRole('combobox', { name: 'Section' }))
    await user.click(await screen.findByRole('option', { name: 'All Sections' }))

    expect(screen.getAllByTestId('squad-picker-row')).toHaveLength(3)
    expect(screen.getByText('Kim Young')).toBeInTheDocument()
  })

  it('searches by any part of the name', async () => {
    const user = userEvent.setup()
    renderPicker()

    await user.type(screen.getByLabelText('Search Players'), 'jon')

    const rows = screen.getAllByTestId('squad-picker-row')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toHaveTextContent('Bob Jones')
  })

  it('ticks several players and adds them all at once', async () => {
    const user = userEvent.setup()
    const { onAdd } = renderPicker()

    expect(screen.getByRole('button', { name: 'Add Player' })).toBeDisabled()
    await user.click(screen.getByRole('checkbox', { name: /Bob Jones/ }))
    expect(screen.getByRole('button', { name: 'Add Player' })).toBeEnabled()
    await user.click(screen.getByRole('checkbox', { name: /Amy Adams/ }))
    await user.click(screen.getByRole('button', { name: 'Add 2 Players' }))

    expect(onAdd).toHaveBeenCalledWith(['p-bob', 'p-amy'])
  })

  it('keeps ticked players when the search changes, and unticks on a second click', async () => {
    const user = userEvent.setup()
    const { onAdd } = renderPicker()

    await user.click(screen.getByRole('checkbox', { name: /Bob Jones/ }))
    await user.click(screen.getByRole('checkbox', { name: /Bob Jones/ }))
    await user.click(screen.getByRole('checkbox', { name: /Amy Adams/ }))
    await user.click(screen.getByRole('button', { name: 'Add Player' }))

    expect(onAdd).toHaveBeenCalledWith(['p-amy'])
  })

  it('says so when nobody matches', async () => {
    const user = userEvent.setup()
    renderPicker()

    await user.type(screen.getByLabelText('Search Players'), 'zzz')

    expect(screen.getByText('No players match. Try another section or clear the search.')).toBeInTheDocument()
  })

  it('shows an error alert and disables Add while adding', () => {
    renderPicker({ error: "Couldn't add these players. Please try again.", adding: true })

    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't add these players. Please try again.")
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Add Player' })).toBeDisabled()
  })

  it('shows a spinner instead of the list while loading', () => {
    renderPicker({ loading: true })

    expect(screen.getByRole('progressbar')).toBeInTheDocument()
    expect(screen.queryByTestId('squad-picker-row')).not.toBeInTheDocument()
  })

  it('Cancel closes without adding', async () => {
    const user = userEvent.setup()
    const { onClose, onAdd } = renderPicker()

    const cancel = screen.getByRole('button', { name: 'Cancel' })
    expect(cancel.className).toContain('MuiButton-outlined')
    await user.click(cancel)

    expect(onClose).toHaveBeenCalled()
    expect(onAdd).not.toHaveBeenCalled()
  })
})
