import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '@mui/material/styles'
import { describe, expect, it, vi } from 'vitest'
import { PlayingXiBuilder } from './PlayingXiBuilder'
import type { AvailabilityStatus, PlayingXiBuilderProps } from './PlayingXiBuilder'
import type { SquadMember } from '../../api/teamSquadApi'
import type { MatchSidePlayer } from '../../api/matchSideApi'
import { baseTheme } from '../../theme'

// `id` (the TeamSquadMember row's own id) is deliberately distinct from `playerProfileId` below —
// docs/specs/031-jersey-numbers.md — every join in PlayingXiBuilder is keyed by playerProfileId,
// not `id`, so a fixture that (wrongly) reused the same value for both would hide a regression.
function makeSquadMember(overrides: Partial<SquadMember> = {}): SquadMember {
  return {
    id: 'squad-row-1',
    playerProfileId: 'player-1',
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
    squadJerseyNumber: null,
    isCaptain: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: null,
    ...overrides,
  }
}

const PLAYER_1 = makeSquadMember({ id: 'squad-row-1', playerProfileId: 'player-1', firstName: 'Jane', lastName: 'Smith' })
const PLAYER_2 = makeSquadMember({ id: 'squad-row-2', playerProfileId: 'player-2', firstName: 'Bob', lastName: 'Jones' })
const PLAYER_3 = makeSquadMember({ id: 'squad-row-3', playerProfileId: 'player-3', firstName: 'Amy', lastName: 'Lee' })

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

  // docs/specs/037-match-improvements.md item 6
  it('renders the Captain/Wicketkeeper/Twelfth Man block before the Playing XI heading', () => {
    render(<PlayingXiBuilder {...baseProps({ xi: XI_WITH_TWO })} />)

    const captainSelect = screen.getByLabelText('Captain')
    const playingXiHeading = screen.getByText('Playing XI')

    // DOCUMENT_POSITION_FOLLOWING on the heading (relative to the Captain select) confirms the
    // Captain/Wicketkeeper/Twelfth Man block renders first in DOM order.
    // eslint-disable-next-line no-bitwise
    expect(captainSelect.compareDocumentPosition(playingXiHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  // docs/specs/037-match-improvements.md item 7
  describe('click-to-edit batting-order stepper', () => {
    it('reveals a numeric stepper when the batting-order number is clicked, and commits a reordered array on blur', async () => {
      const user = userEvent.setup()
      const onReorderPlayers = vi.fn()
      render(<PlayingXiBuilder {...baseProps({ xi: XI_WITH_TWO, onReorderPlayers })} />)

      await user.click(screen.getByLabelText('Edit batting order for Jane Smith'))
      const input = screen.getByLabelText('Batting order for Jane Smith')
      await user.clear(input)
      await user.type(input, '2')
      await user.tab()

      expect(onReorderPlayers).toHaveBeenCalledWith(['player-2', 'player-1'])
    })

    it('commits on Enter as well as blur', async () => {
      const user = userEvent.setup()
      const onReorderPlayers = vi.fn()
      render(<PlayingXiBuilder {...baseProps({ xi: XI_WITH_TWO, onReorderPlayers })} />)

      await user.click(screen.getByLabelText('Edit batting order for Bob Jones'))
      const input = screen.getByLabelText('Batting order for Bob Jones')
      await user.clear(input)
      await user.type(input, '1{Enter}')

      expect(onReorderPlayers).toHaveBeenCalledWith(['player-2', 'player-1'])
    })

    it('clamps a too-large typed value to the end of the order rather than erroring', async () => {
      const user = userEvent.setup()
      const onReorderPlayers = vi.fn()
      render(<PlayingXiBuilder {...baseProps({ xi: XI_WITH_TWO, onReorderPlayers })} />)

      await user.click(screen.getByLabelText('Edit batting order for Jane Smith'))
      const input = screen.getByLabelText('Batting order for Jane Smith')
      await user.clear(input)
      await user.type(input, '99')
      await user.tab()

      expect(onReorderPlayers).toHaveBeenCalledWith(['player-2', 'player-1'])
    })

    it('does not call onReorderPlayers when the committed position is unchanged', async () => {
      const user = userEvent.setup()
      const onReorderPlayers = vi.fn()
      render(<PlayingXiBuilder {...baseProps({ xi: XI_WITH_TWO, onReorderPlayers })} />)

      await user.click(screen.getByLabelText('Edit batting order for Jane Smith'))
      const input = screen.getByLabelText('Batting order for Jane Smith')
      await user.clear(input)
      await user.type(input, '1')
      await user.tab()

      expect(onReorderPlayers).not.toHaveBeenCalled()
    })

    it('leaves the existing up/down IconButtons working unchanged alongside the stepper', async () => {
      const user = userEvent.setup()
      const onReorderPlayers = vi.fn()
      render(<PlayingXiBuilder {...baseProps({ xi: XI_WITH_TWO, onReorderPlayers })} />)

      await user.click(screen.getByLabelText('Move Jane Smith down'))
      expect(onReorderPlayers).toHaveBeenCalledWith(['player-2', 'player-1'])
    })
  })

  // docs/specs/037-match-improvements.md item 8
  describe('Add Squad Member', () => {
    it('is omitted entirely when onAddSquadMember is not passed', () => {
      render(<PlayingXiBuilder {...baseProps()} />)
      expect(screen.queryByRole('button', { name: 'Add Squad Member' })).not.toBeInTheDocument()
    })

    it('renders and fires onAddSquadMember when passed', async () => {
      const user = userEvent.setup()
      const onAddSquadMember = vi.fn()
      render(<PlayingXiBuilder {...baseProps({ onAddSquadMember })} />)

      await user.click(screen.getByRole('button', { name: 'Add Squad Member' }))
      expect(onAddSquadMember).toHaveBeenCalledTimes(1)
    })
  })

  // docs/specs/037-match-improvements.md item 9
  describe('Re-select from Previous Match', () => {
    it('is omitted entirely when onReselectFromPreviousMatch is not passed', () => {
      render(<PlayingXiBuilder {...baseProps()} />)
      expect(screen.queryByRole('button', { name: 'Re-select from Previous Match' })).not.toBeInTheDocument()
    })

    it('renders and fires onReselectFromPreviousMatch when passed', async () => {
      const user = userEvent.setup()
      const onReselectFromPreviousMatch = vi.fn()
      render(<PlayingXiBuilder {...baseProps({ onReselectFromPreviousMatch })} />)

      await user.click(screen.getByRole('button', { name: 'Re-select from Previous Match' }))
      expect(onReselectFromPreviousMatch).toHaveBeenCalledTimes(1)
    })
  })

  // docs/specs/031-jersey-numbers.md
  describe('squad jersey number display', () => {
    const PLAYER_1_NUMBERED = makeSquadMember({
      id: 'squad-row-1',
      playerProfileId: 'player-1',
      firstName: 'Jane',
      lastName: 'Smith',
      squadJerseyNumber: 7,
    })

    it('prefixes the ordered XI list row with #N when the squad member has a squad number', () => {
      render(
        <PlayingXiBuilder
          {...baseProps({ squad: [PLAYER_1_NUMBERED, PLAYER_2, PLAYER_3], xi: XI_WITH_TWO })}
        />,
      )

      expect(screen.getByText('#7 Jane Smith')).toBeInTheDocument()
      expect(screen.getByText('Bob Jones')).toBeInTheDocument()
    })

    it('falls back to the plain name (no stray "#") when a squad member has no squad number', () => {
      render(<PlayingXiBuilder {...baseProps({ squad: [PLAYER_1, PLAYER_2, PLAYER_3], xi: XI_WITH_TWO })} />)

      expect(screen.getByText('Jane Smith')).toBeInTheDocument()
      expect(screen.queryByText(/^#/)).not.toBeInTheDocument()
    })

    it('shows the #N prefix in the "Add player" Autocomplete option', async () => {
      const user = userEvent.setup()
      render(<PlayingXiBuilder {...baseProps({ squad: [PLAYER_1_NUMBERED, PLAYER_2, PLAYER_3] })} />)

      await user.click(screen.getByLabelText('Add player'))
      expect(await screen.findByText('#7 Jane Smith')).toBeInTheDocument()
    })

    it('shows the #N prefix in the Captain/Wicketkeeper/Twelfth Man Select options', async () => {
      const user = userEvent.setup()
      render(
        <PlayingXiBuilder
          {...baseProps({ squad: [PLAYER_1_NUMBERED, PLAYER_2, PLAYER_3], xi: XI_WITH_TWO })}
        />,
      )

      await user.click(screen.getByLabelText('Captain'))
      expect(await screen.findByRole('option', { name: '#7 Jane Smith' })).toBeInTheDocument()
      await user.keyboard('{Escape}')

      await user.click(screen.getByLabelText('Wicketkeeper'))
      expect(await screen.findByRole('option', { name: '#7 Jane Smith' })).toBeInTheDocument()
      await user.keyboard('{Escape}')

      await user.click(screen.getByLabelText('Twelfth man'))
      expect(await screen.findByRole('option', { name: 'Amy Lee' })).toBeInTheDocument()
    })
  })

  // docs/specs/040-announce-team.md
  describe('Announce/Un-announce toggle', () => {
    it('is omitted entirely when announced/onToggleAnnounced are not passed', () => {
      render(<PlayingXiBuilder {...baseProps({ xi: XI_WITH_TWO })} />)

      expect(screen.queryByText('Announced')).not.toBeInTheDocument()
      expect(screen.queryByText('Not Announced')).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Announce Team' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Un-announce' })).not.toBeInTheDocument()
    })

    it('shows a "Not Announced" chip and a disabled "Announce Team" button with zero players', () => {
      render(<PlayingXiBuilder {...baseProps({ announced: false, onToggleAnnounced: vi.fn() })} />)

      expect(screen.getByText('Not Announced')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Announce Team' })).toBeDisabled()
    })

    it('enables "Announce Team" once the side has at least one player, and calls onToggleAnnounced', async () => {
      const user = userEvent.setup()
      const onToggleAnnounced = vi.fn()
      render(
        <PlayingXiBuilder {...baseProps({ xi: XI_WITH_TWO, announced: false, onToggleAnnounced })} />,
      )

      const button = screen.getByRole('button', { name: 'Announce Team' })
      expect(button).not.toBeDisabled()
      await user.click(button)

      expect(onToggleAnnounced).toHaveBeenCalledTimes(1)
    })

    it('shows an "Announced" chip and an enabled "Un-announce" button when announced is true', async () => {
      const user = userEvent.setup()
      const onToggleAnnounced = vi.fn()
      render(
        <PlayingXiBuilder {...baseProps({ xi: XI_WITH_TWO, announced: true, onToggleAnnounced })} />,
      )

      expect(screen.getByText('Announced')).toBeInTheDocument()
      const button = screen.getByRole('button', { name: 'Un-announce' })
      expect(button).not.toBeDisabled()
      await user.click(button)

      expect(onToggleAnnounced).toHaveBeenCalledTimes(1)
    })

    it('swaps to the pending label and disables the button while togglingAnnounced is true', () => {
      render(
        <PlayingXiBuilder
          {...baseProps({ xi: XI_WITH_TWO, announced: false, onToggleAnnounced: vi.fn(), togglingAnnounced: true })}
        />,
      )

      expect(screen.getByRole('button', { name: 'Announcing…' })).toBeDisabled()
    })

    it('swaps to the un-announcing pending label and disables the button while togglingAnnounced is true', () => {
      render(
        <PlayingXiBuilder
          {...baseProps({ xi: XI_WITH_TWO, announced: true, onToggleAnnounced: vi.fn(), togglingAnnounced: true })}
        />,
      )

      expect(screen.getByRole('button', { name: 'Un-announcing…' })).toBeDisabled()
    })
  })

  // docs/specs/033-availability-aware-xi-builder.md
  describe('availability indicators', () => {
    // Wrapped in the real app theme (docs/standards/design-system.md's palette tokens) rather than
    // MUI's own default theme, so the tinted-background assertions below check against the actual
    // theme.ts error.main this component renders with, not MUI's default red.
    function renderXi(props: Partial<PlayingXiBuilderProps> = {}) {
      return render(
        <ThemeProvider theme={baseTheme}>
          <PlayingXiBuilder {...baseProps(props)} />
        </ThemeProvider>,
      )
    }

    it('renders no indicator anywhere when availabilityByPlayerId is omitted', async () => {
      const user = userEvent.setup()
      renderXi({ xi: XI_WITH_TWO })

      expect(screen.queryByText('Marked Unsure for this match')).not.toBeInTheDocument()

      await user.click(screen.getByLabelText('Add player'))
      const option = await screen.findByText('Amy Lee')
      expect(option.closest('li')).not.toHaveStyle({ backgroundColor: 'rgba(176, 64, 46, 0.16)' })
    })

    it('renders no indicator anywhere when availabilityByPlayerId is empty', () => {
      renderXi({ xi: XI_WITH_TWO, availabilityByPlayerId: new Map() })
      expect(screen.queryByText('Marked Unsure for this match')).not.toBeInTheDocument()
    })

    it('tints the Add-player option red and shows the caption for an UNAVAILABLE candidate', async () => {
      const user = userEvent.setup()
      renderXi({ availabilityByPlayerId: new Map<string, AvailabilityStatus>([['player-2', 'UNAVAILABLE']]) })

      await user.click(screen.getByLabelText('Add player'))
      const option = await screen.findByText('Bob Jones')
      expect(option.closest('li')).toHaveStyle({ backgroundColor: 'rgba(176, 64, 46, 0.16)' })
      expect(await screen.findByText('Unavailable for this match')).toBeInTheDocument()
    })

    it('tints an UNAVAILABLE player\'s own ordered-XI row red and shows the caption', () => {
      renderXi({
        xi: XI_WITH_TWO,
        availabilityByPlayerId: new Map<string, AvailabilityStatus>([['player-2', 'UNAVAILABLE']]),
      })

      // The row's own outer Box wraps the "move up" IconButton two levels up (the action-buttons
      // Stack's parent is the row Box itself).
      const rowContainer = screen.getByLabelText('Move Bob Jones up').closest('div')?.parentElement
      expect(rowContainer).toHaveStyle({ backgroundColor: 'rgba(176, 64, 46, 0.16)' })
      expect(screen.getByText('Unavailable for this match')).toBeInTheDocument()
    })

    it('shows the exact Unsure caption and an orange tint on the Add-player option', async () => {
      const user = userEvent.setup()
      renderXi({ availabilityByPlayerId: new Map<string, AvailabilityStatus>([['player-2', 'UNSURE']]) })

      await user.click(screen.getByLabelText('Add player'))
      const caption = await screen.findByText('Marked Unsure for this match')
      expect(caption).toBeInTheDocument()
      expect(caption.closest('li')).toHaveStyle({ backgroundColor: 'rgba(183, 121, 31, 0.16)' })
    })

    it('shows the exact Unsure caption and an orange tint on that player\'s own ordered-XI row', () => {
      renderXi({
        xi: XI_WITH_TWO,
        availabilityByPlayerId: new Map<string, AvailabilityStatus>([['player-2', 'UNSURE']]),
      })

      expect(screen.getByText('Marked Unsure for this match')).toBeInTheDocument()
      const rowContainer = screen.getByLabelText('Move Bob Jones up').closest('div')?.parentElement
      expect(rowContainer).toHaveStyle({ backgroundColor: 'rgba(183, 121, 31, 0.16)' })
    })

    it('renders no visual change for an AVAILABLE entry', () => {
      renderXi({
        xi: XI_WITH_TWO,
        availabilityByPlayerId: new Map<string, AvailabilityStatus>([['player-2', 'AVAILABLE']]),
      })

      expect(screen.queryByText('Marked Unsure for this match')).not.toBeInTheDocument()
      const rowContainer = screen.getByLabelText('Move Bob Jones up').closest('div')?.parentElement
      expect(rowContainer).not.toHaveStyle({ backgroundColor: 'rgba(176, 64, 46, 0.16)' })
      expect(rowContainer).not.toHaveStyle({ backgroundColor: 'rgba(183, 121, 31, 0.16)' })
    })

    it('applies the same treatment to Twelfth Man options as the Add-player Autocomplete', async () => {
      const user = userEvent.setup()
      renderXi({
        xi: XI_WITH_TWO,
        availabilityByPlayerId: new Map<string, AvailabilityStatus>([['player-3', 'UNAVAILABLE']]),
      })

      await user.click(screen.getByLabelText('Twelfth man'))
      const option = await screen.findByRole('option', { name: /Amy Lee/ })
      expect(option).toHaveStyle({ backgroundColor: 'rgba(176, 64, 46, 0.16)' })
    })

    it('shows the Unsure caption and orange tint inside the Twelfth Man option', async () => {
      const user = userEvent.setup()
      renderXi({
        xi: XI_WITH_TWO,
        availabilityByPlayerId: new Map<string, AvailabilityStatus>([['player-3', 'UNSURE']]),
      })

      await user.click(screen.getByLabelText('Twelfth man'))
      const option = await screen.findByRole('option', { name: /Amy Lee/ })
      expect(option).toHaveStyle({ backgroundColor: 'rgba(183, 121, 31, 0.16)' })
      expect(await screen.findByText('Marked Unsure for this match')).toBeInTheDocument()
    })

    it('shows no indicator on Captain/Wicketkeeper options regardless of status', async () => {
      const user = userEvent.setup()
      renderXi({
        xi: XI_WITH_TWO,
        availabilityByPlayerId: new Map<string, AvailabilityStatus>([
          ['player-1', 'UNAVAILABLE'],
          ['player-2', 'UNSURE'],
        ]),
      })

      await user.click(screen.getByLabelText('Captain'))
      const captainListbox = await screen.findByRole('listbox')
      expect(captainListbox).not.toHaveTextContent('Marked Unsure for this match')
      const captainOption = within(captainListbox).getByRole('option', { name: 'Jane Smith' })
      expect(captainOption).not.toHaveStyle({ backgroundColor: 'rgba(176, 64, 46, 0.16)' })
      await user.keyboard('{Escape}')

      await user.click(screen.getByLabelText('Wicketkeeper'))
      const keeperListbox = await screen.findByRole('listbox')
      expect(keeperListbox).not.toHaveTextContent('Marked Unsure for this match')
      const keeperOption = within(keeperListbox).getByRole('option', { name: 'Bob Jones' })
      expect(keeperOption).not.toHaveStyle({ backgroundColor: 'rgba(176, 64, 46, 0.16)' })
    })

    it('still calls onAddPlayer normally for a flagged candidate', async () => {
      const user = userEvent.setup()
      const onAddPlayer = vi.fn()
      renderXi({
        onAddPlayer,
        availabilityByPlayerId: new Map<string, AvailabilityStatus>([['player-2', 'UNAVAILABLE']]),
      })

      await user.click(screen.getByLabelText('Add player'))
      await user.click(await screen.findByText('Bob Jones'))
      await user.click(screen.getByRole('button', { name: 'Add player' }))

      expect(onAddPlayer).toHaveBeenCalledWith('player-2', 'BATSMAN')
    })
  })
})
