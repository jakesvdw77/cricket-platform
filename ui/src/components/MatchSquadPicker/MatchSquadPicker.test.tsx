import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { MatchSquadPicker } from './MatchSquadPicker'
import type { MatchSquadPickerProps } from './MatchSquadPicker'
import type { MatchSquadCandidate, MatchSquadMember } from '../../api/matchSquadApi'

function makeCandidate(overrides: Partial<MatchSquadCandidate> = {}): MatchSquadCandidate {
  return {
    playerProfileId: 'p1',
    firstName: 'Jane',
    lastName: 'Smith',
    jerseyNumber: 7,
    pickedElsewhere: null,
    ...overrides,
  }
}

function makeMember(overrides: Partial<MatchSquadMember> = {}): MatchSquadMember {
  return {
    id: 'squad-row-1',
    playerProfileId: 'p2',
    personId: 'person-2',
    clubId: 'club-1',
    firstName: 'Bob',
    lastName: 'Jones',
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
    squadJerseyNumber: 4,
    isCaptain: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: null,
    ...overrides,
  }
}

function baseProps(overrides: Partial<MatchSquadPickerProps> = {}): MatchSquadPickerProps {
  return {
    candidates: [makeCandidate()],
    selected: [makeMember()],
    windowId: 'window-1',
    windowOpen: true,
    label: 'the home side',
    createWindowHref: '/manage/availability/new?type=group&sectionId=section-1',
    onAdd: vi.fn(),
    onRemove: vi.fn(),
    onUpdateJerseyNumber: vi.fn(),
    ...overrides,
  }
}

function renderPicker(props: MatchSquadPickerProps) {
  return render(
    <MemoryRouter>
      <MatchSquadPicker {...props} />
    </MemoryRouter>,
  )
}

describe('MatchSquadPicker', () => {
  it('renders the no-window empty state with a pre-filled shortcut when windowId is null', () => {
    renderPicker(baseProps({ windowId: null }))

    expect(screen.getByText('No section availability window yet')).toBeInTheDocument()
    const link = screen.getByRole('link', { name: /open a window for this bracket/i })
    expect(link).toHaveAttribute('href', '/manage/availability/new?type=group&sectionId=section-1')
  })

  it('renders available candidates and selected squad members in separate panes', () => {
    renderPicker(baseProps())

    expect(screen.getByText('#7 Jane Smith')).toBeInTheDocument()
    expect(screen.getByText('#4 Bob Jones')).toBeInTheDocument()
  })

  it('calls onAdd when adding an available candidate', async () => {
    const user = userEvent.setup()
    const onAdd = vi.fn()
    renderPicker(baseProps({ onAdd }))

    await user.click(screen.getByRole('button', { name: /add #7 jane smith to the squad/i }))
    expect(onAdd).toHaveBeenCalledWith('p1')
  })

  it('calls onRemove when removing a selected squad member', async () => {
    const user = userEvent.setup()
    const onRemove = vi.fn()
    renderPicker(baseProps({ onRemove }))

    await user.click(screen.getByRole('button', { name: /remove bob jones from the squad/i }))
    expect(onRemove).toHaveBeenCalledWith('p2')
  })

  it('shows the pickedElsewhere badge and disables the add action, rather than hiding the candidate', () => {
    renderPicker(
      baseProps({
        candidates: [
          makeCandidate({ pickedElsewhere: { matchId: 'match-2', teamId: 'team-2', teamName: 'U13 Girls' } }),
        ],
      }),
    )

    expect(screen.getByText('Already picked for U13 Girls')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /add #7 jane smith to the squad/i })).toBeDisabled()
  })

  it('commits an inline jersey-number edit on blur via onUpdateJerseyNumber', async () => {
    const user = userEvent.setup()
    const onUpdateJerseyNumber = vi.fn()
    renderPicker(baseProps({ onUpdateJerseyNumber }))

    const input = screen.getByLabelText('Bob Jones squad number')
    await user.clear(input)
    await user.type(input, '9')
    await user.tab()

    expect(onUpdateJerseyNumber).toHaveBeenCalledWith('p2', 9)
  })

  it('surfaces a server rejection inline', () => {
    renderPicker(baseProps({ errorMessage: 'Already picked for this bracket elsewhere.' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Already picked for this bracket elsewhere.')
  })

  it('shows a non-blocking notice when the bracket window is closed', () => {
    renderPicker(baseProps({ windowOpen: false }))
    expect(screen.getByText(/availability window is closed/i)).toBeInTheDocument()
    // Still interactive — a closed window doesn't block squad management.
    expect(screen.getByRole('button', { name: /add #7 jane smith to the squad/i })).not.toBeDisabled()
  })

  it('excludes an already-selected player from the Available pane', () => {
    renderPicker(
      baseProps({
        candidates: [makeCandidate({ playerProfileId: 'p2', firstName: 'Bob', lastName: 'Jones', jerseyNumber: 4 })],
        selected: [makeMember({ playerProfileId: 'p2' })],
      }),
    )

    expect(screen.getByText('Available (0)')).toBeInTheDocument()
  })
})
