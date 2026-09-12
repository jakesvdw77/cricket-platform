import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PlayingXiBuilder } from './PlayingXiBuilder'
import type { PlayingXiBuilderProps } from './PlayingXiBuilder'
import type { Player } from '../../api/playerApi'
import type { MatchSidePlayer } from '../../api/matchSideApi'

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
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: null,
    ...overrides,
  }
}

const PLAYER_1 = makePlayer({ id: 'player-1', firstName: 'Jane', lastName: 'Smith' })
const PLAYER_2 = makePlayer({ id: 'player-2', firstName: 'Bob', lastName: 'Jones' })
const PLAYER_3 = makePlayer({ id: 'player-3', firstName: 'Amy', lastName: 'Lee' })

function baseProps(overrides: Partial<PlayingXiBuilderProps> = {}): PlayingXiBuilderProps {
  return {
    squad: [PLAYER_1, PLAYER_2, PLAYER_3],
    xi: [],
    captainPlayerId: null,
    wicketKeeperPlayerId: null,
    twelfthManPlayerId: null,
    cap: 11,
    onAddPlayer: vi.fn(),
    onRemovePlayer: vi.fn(),
    onChangeRole: vi.fn(),
    onReorderPlayers: vi.fn(),
    onChangeCaptain: vi.fn(),
    onChangeWicketKeeper: vi.fn(),
    onChangeTwelfthMan: vi.fn(),
    ...overrides,
  }
}

const XI_WITH_TWO: MatchSidePlayer[] = [
  { playerProfileId: 'player-1', battingOrder: 1, role: 'BATSMAN' },
  { playerProfileId: 'player-2', battingOrder: 2, role: 'BOWLER' },
]

describe('PlayingXiBuilder', () => {
  it('shows a 0 / cap count with no players added', () => {
    render(<PlayingXiBuilder {...baseProps()} />)
    expect(screen.getByText('0 / 11')).toBeInTheDocument()
  })

  it('adds a player at the end of the order via the Autocomplete + role select', async () => {
    const user = userEvent.setup()
    const onAddPlayer = vi.fn()
    render(<PlayingXiBuilder {...baseProps({ onAddPlayer })} />)

    await user.click(screen.getByLabelText('Add player'))
    await user.click(await screen.findByText('Bob Jones'))
    await user.click(screen.getByRole('button', { name: 'Add player' }))

    expect(onAddPlayer).toHaveBeenCalledWith('player-2', 'BATSMAN')
  })

  it('renders the ordered XI with batting order, name, and role select', () => {
    render(<PlayingXiBuilder {...baseProps({ xi: XI_WITH_TWO })} />)

    expect(screen.getByText('Jane Smith')).toBeInTheDocument()
    expect(screen.getByText('Bob Jones')).toBeInTheDocument()
    expect(screen.getByText('2 / 11')).toBeInTheDocument()
  })

  it('shows Captain/Keeper badges on the matching row', () => {
    render(
      <PlayingXiBuilder
        {...baseProps({ xi: XI_WITH_TWO, captainPlayerId: 'player-1', wicketKeeperPlayerId: 'player-2' })}
      />,
    )

    expect(screen.getByText('C')).toBeInTheDocument()
    expect(screen.getByText('WK')).toBeInTheDocument()
  })

  it('removes a player via the row remove action', async () => {
    const user = userEvent.setup()
    const onRemovePlayer = vi.fn()
    render(<PlayingXiBuilder {...baseProps({ xi: XI_WITH_TWO, onRemovePlayer })} />)

    await user.click(screen.getByLabelText('Remove Jane Smith'))
    expect(onRemovePlayer).toHaveBeenCalledWith('player-1')
  })

  it('changes a player\'s role via that row\'s role select', async () => {
    const user = userEvent.setup()
    const onChangeRole = vi.fn()
    render(<PlayingXiBuilder {...baseProps({ xi: XI_WITH_TWO, onChangeRole })} />)

    const roleSelects = screen.getAllByLabelText('Role')
    await user.click(roleSelects[0])
    await user.click(await screen.findByRole('option', { name: 'All-rounder' }))

    expect(onChangeRole).toHaveBeenCalledWith('player-1', 'ALL_ROUNDER')
  })

  it('disables "move up" on the first row and "move down" on the last row', () => {
    render(<PlayingXiBuilder {...baseProps({ xi: XI_WITH_TWO })} />)

    expect(screen.getByLabelText('Move Jane Smith up')).toBeDisabled()
    expect(screen.getByLabelText('Move Jane Smith down')).not.toBeDisabled()
    expect(screen.getByLabelText('Move Bob Jones down')).toBeDisabled()
    expect(screen.getByLabelText('Move Bob Jones up')).not.toBeDisabled()
  })

  it('reorders by swapping with the adjacent player when moved down', async () => {
    const user = userEvent.setup()
    const onReorderPlayers = vi.fn()
    render(<PlayingXiBuilder {...baseProps({ xi: XI_WITH_TWO, onReorderPlayers })} />)

    await user.click(screen.getByLabelText('Move Jane Smith down'))
    expect(onReorderPlayers).toHaveBeenCalledWith(['player-2', 'player-1'])
  })

  it('disables the add control once the cap is reached', () => {
    render(<PlayingXiBuilder {...baseProps({ xi: XI_WITH_TWO, cap: 2 })} />)

    expect(screen.getByLabelText('Add player')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Add player' })).toBeDisabled()
    expect(screen.getByText(/playing xi is full/i)).toBeInTheDocument()
  })

  it('scopes Captain/Wicketkeeper options to current XI members only', async () => {
    const user = userEvent.setup()
    render(<PlayingXiBuilder {...baseProps({ xi: XI_WITH_TWO })} />)

    await user.click(screen.getByLabelText('Captain'))
    const listbox = await screen.findByRole('listbox')
    expect(listbox).toHaveTextContent('Jane Smith')
    expect(listbox).toHaveTextContent('Bob Jones')
    expect(listbox).not.toHaveTextContent('Amy Lee')
  })

  it('scopes Twelfth Man options to squad members NOT currently in the XI', async () => {
    const user = userEvent.setup()
    render(<PlayingXiBuilder {...baseProps({ xi: XI_WITH_TWO })} />)

    await user.click(screen.getByLabelText('Twelfth man'))
    const listbox = await screen.findByRole('listbox')
    expect(listbox).toHaveTextContent('Amy Lee')
    expect(listbox).not.toHaveTextContent('Jane Smith')
    expect(listbox).not.toHaveTextContent('Bob Jones')
  })

  it('calls onChangeCaptain/onChangeWicketKeeper/onChangeTwelfthMan when a Select changes', async () => {
    const user = userEvent.setup()
    const onChangeCaptain = vi.fn()
    render(<PlayingXiBuilder {...baseProps({ xi: XI_WITH_TWO, onChangeCaptain })} />)

    await user.click(screen.getByLabelText('Captain'))
    await user.click(await screen.findByRole('option', { name: 'Bob Jones' }))

    expect(onChangeCaptain).toHaveBeenCalledWith('player-2')
  })

  it('surfaces a server rejection as an inline Alert, not a silent failure', () => {
    render(<PlayingXiBuilder {...baseProps({ errorMessage: 'This player is outside the league\'s age range.' })} />)

    expect(screen.getByRole('alert')).toHaveTextContent(/outside the league's age range/i)
  })
})
