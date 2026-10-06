import { createEvent, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { TeamSelectionList } from './TeamSelectionList'
import type { TeamSelectionListProps, TeamSelectionPlayer } from './TeamSelectionList'

function player(id: string, name: string, battingOrder: number | null, overrides: Partial<TeamSelectionPlayer> = {}): TeamSelectionPlayer {
  return { playerProfileId: id, name, battingOrder, role: 'BATSMAN', availability: null, alsoIn: null, ...overrides }
}

const LIMITS = { battingPlaces: 11, twelfthManAllowed: true, maxSelected: 12 }

function setup(overrides: Partial<TeamSelectionListProps> = {}) {
  const handlers = {
    onReorder: vi.fn(),
    onSetCaptain: vi.fn(),
    onSetWicketKeeper: vi.fn(),
    onMakeTwelfthMan: vi.fn(),
    onChangeRole: vi.fn(),
    onRemove: vi.fn(),
  }
  const props: TeamSelectionListProps = {
    players: [player('a', 'Ann Ash', 1), player('b', 'Bob Birch', 2), player('c', 'Cal Cedar', 3)],
    captainPlayerId: null,
    wicketKeeperPlayerId: null,
    twelfthManPlayerId: null,
    limits: LIMITS,
    ...handlers,
    ...overrides,
  }
  render(<TeamSelectionList {...props} />)
  return handlers
}

// jsdom has no DataTransfer; the list only calls setData and sets effectAllowed.
const dataTransfer = () => ({ setData: vi.fn(), effectAllowed: '' })

// jsdom's drag events ignore clientY, so set it on the event: the list reads it against the row's
// (all-zero in jsdom) rectangle to pick the top or bottom half.
function dragOverAt(target: HTMLElement, clientY: number) {
  const event = createEvent.dragOver(target)
  Object.defineProperty(event, 'clientY', { value: clientY })
  fireEvent(target, event)
}

async function openMenu(name: string) {
  await userEvent.click(screen.getByRole('button', { name: `${name}, open menu` }))
}

describe('TeamSelectionList', () => {
  it('numbers the places in batting order and shows the placeholder when nobody is selected', () => {
    setup({ players: [player('b', 'Bob Birch', 2), player('a', 'Ann Ash', 1)] })
    const rows = screen.getAllByTestId(/^selection-row-/)
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining('1Ann Ash'),
      expect.stringContaining('2Bob Birch'),
    ])
    expect(screen.queryByTestId('holding-area')).not.toBeInTheDocument()
  })

  it('shows the placeholder for an empty team', () => {
    setup({ players: [] })
    expect(screen.getByText('No players selected yet.')).toBeInTheDocument()
  })

  it('draws the holding area (with a count) only when someone has no position, after the numbered places', () => {
    setup({ players: [player('a', 'Ann Ash', 1), player('w', 'Wes Willow', null)] })
    const holding = screen.getByTestId('holding-area')
    expect(within(holding).getByText('Not in the batting order yet (1)')).toBeInTheDocument()
    expect(within(holding).getByText('Wes Willow')).toBeInTheDocument()
    expect(within(holding).queryByText('Ann Ash')).not.toBeInTheDocument()
  })

  it('hides the 12th man row when the format has none and nobody holds it', () => {
    setup({ limits: { ...LIMITS, twelfthManAllowed: false, maxSelected: 11 } })
    expect(screen.queryByText('12th man')).not.toBeInTheDocument()
  })

  it('shows "None chosen" when a 12th man is allowed but nobody is chosen', () => {
    setup()
    expect(screen.getByText(/None chosen/)).toBeInTheDocument()
  })

  it('draws a chosen 12th man in his own row without a number', () => {
    setup({
      players: [player('a', 'Ann Ash', 1), player('t', 'Tom Twelfth', null)],
      twelfthManPlayerId: 't',
    })
    expect(screen.getByText('12th man')).toBeInTheDocument()
    const row = screen.getByTestId('selection-row-t')
    expect(row.textContent).toContain('Tom Twelfth')
    expect(screen.queryByTestId('holding-area')).not.toBeInTheDocument()
  })

  it('shows Captain and Wicketkeeper word badges on one player each, plus the role badge', () => {
    setup({ captainPlayerId: 'a', wicketKeeperPlayerId: 'b' })
    expect(screen.getAllByText('Captain')).toHaveLength(1)
    expect(screen.getAllByText('Wicketkeeper')).toHaveLength(1)
    expect(within(screen.getByTestId('selection-row-a')).getByText('Captain')).toBeInTheDocument()
    expect(within(screen.getByTestId('selection-row-b')).getByText('Wicketkeeper')).toBeInTheDocument()
    expect(within(screen.getByTestId('selection-row-c')).getByText('Batsman')).toBeInTheDocument()
  })

  it('draws the availability badges (Unsure, No response, Not polled, Said unavailable) and Also in, and none for Available or null', () => {
    setup({
      players: [
        player('a', 'Ann Ash', 1, { availability: 'UNSURE' }),
        player('b', 'Bob Birch', 2, { availability: 'NO_RESPONSE' }),
        player('c', 'Cal Cedar', 3, { availability: 'NOT_POLLED' }),
        player('d', 'Dee Dale', 4, { availability: 'UNAVAILABLE' }),
        player('e', 'Eve Elm', 5, { availability: 'AVAILABLE' }),
        player('f', 'Fay Fir', 6, { availability: null, alsoIn: '2nd XI' }),
      ],
    })
    expect(screen.getByText('Unsure')).toBeInTheDocument()
    expect(screen.getByText('No response')).toBeInTheDocument()
    expect(screen.getByText('Not polled')).toBeInTheDocument()
    expect(screen.getByText('Said unavailable')).toBeInTheDocument()
    expect(screen.queryByText('Available')).not.toBeInTheDocument()
    expect(screen.getByText('Also in 2nd XI')).toBeInTheDocument()
  })

  it('has no per-row buttons beyond the name and the role/captain/keeper badges', () => {
    setup({ captainPlayerId: 'a' })
    const buttons = within(screen.getByTestId('selection-row-a')).getAllByRole('button')
    expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual([
      'Ann Ash, open menu',
      'Ann Ash, role Batsman, change role',
      'Ann Ash, captain, open options',
    ])
    expect(screen.queryByRole('button', { name: /remove|delete/i })).not.toBeInTheDocument()
  })

  describe('the name menu', () => {
    it('offers Make captain, Wicketkeeper, Make 12th man, Role, Move up/down and Remove for a numbered player', async () => {
      setup()
      await openMenu('Bob Birch')
      expect(screen.getByRole('menuitem', { name: 'Make captain' })).toBeInTheDocument()
      expect(screen.getByRole('menuitemcheckbox', { name: 'Wicketkeeper' })).toBeInTheDocument()
      expect(screen.getByRole('menuitem', { name: 'Make 12th man' })).toBeInTheDocument()
      expect(screen.getByRole('menuitem', { name: /Role: Batsman/ })).toBeInTheDocument()
      expect(screen.getByRole('menuitem', { name: 'Move up' })).toBeEnabled()
      expect(screen.getByRole('menuitem', { name: 'Move down' })).toBeEnabled()
      expect(screen.getByRole('menuitem', { name: 'Remove from team' })).toBeInTheDocument()
    })

    it('hides Make 12th man when the format has none', async () => {
      setup({ limits: { ...LIMITS, twelfthManAllowed: false, maxSelected: 11 } })
      await openMenu('Bob Birch')
      expect(screen.queryByRole('menuitem', { name: 'Make 12th man' })).not.toBeInTheDocument()
    })

    it('hides captain and keeper for the 12th man and offers Move into the batting order instead', async () => {
      const handlers = setup({
        players: [player('a', 'Ann Ash', 1), player('t', 'Tom Twelfth', null)],
        twelfthManPlayerId: 't',
      })
      await openMenu('Tom Twelfth')
      expect(screen.queryByRole('menuitem', { name: 'Make captain' })).not.toBeInTheDocument()
      expect(screen.queryByRole('menuitemcheckbox', { name: 'Wicketkeeper' })).not.toBeInTheDocument()
      expect(screen.queryByRole('menuitem', { name: 'Make 12th man' })).not.toBeInTheDocument()
      expect(screen.queryByRole('menuitem', { name: 'Move up' })).not.toBeInTheDocument()
      await userEvent.click(screen.getByRole('menuitem', { name: 'Move into the batting order' }))
      expect(handlers.onReorder).toHaveBeenCalledWith(['a', 't'])
    })

    it('disables Move up for the first player and Move down for the last', async () => {
      setup()
      await openMenu('Ann Ash')
      expect(screen.getByRole('menuitem', { name: 'Move up' })).toHaveAttribute('aria-disabled', 'true')
      await userEvent.keyboard('{Escape}')
      await openMenu('Cal Cedar')
      expect(screen.getByRole('menuitem', { name: 'Move down' })).toHaveAttribute('aria-disabled', 'true')
    })

    it('Make captain toggles to Remove as captain for the current captain', async () => {
      const handlers = setup({ captainPlayerId: 'a' })
      await openMenu('Ann Ash')
      await userEvent.click(screen.getByRole('menuitem', { name: 'Remove as captain' }))
      expect(handlers.onSetCaptain).toHaveBeenCalledWith(null)
    })

    it('Make captain, Wicketkeeper and Make 12th man call their handlers with the player', async () => {
      const handlers = setup()
      await openMenu('Bob Birch')
      await userEvent.click(screen.getByRole('menuitem', { name: 'Make captain' }))
      expect(handlers.onSetCaptain).toHaveBeenCalledWith('b')

      await openMenu('Bob Birch')
      await userEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Wicketkeeper' }))
      expect(handlers.onSetWicketKeeper).toHaveBeenCalledWith('b')

      await openMenu('Bob Birch')
      await userEvent.click(screen.getByRole('menuitem', { name: 'Make 12th man' }))
      expect(handlers.onMakeTwelfthMan).toHaveBeenCalledWith('b')
    })

    it('Role submenu changes the role', async () => {
      const handlers = setup()
      await openMenu('Bob Birch')
      await userEvent.click(screen.getByRole('menuitem', { name: /Role: Batsman/ }))
      await userEvent.click(await screen.findByRole('menuitem', { name: 'All-rounder' }))
      expect(handlers.onChangeRole).toHaveBeenCalledWith('b', 'ALL_ROUNDER')
    })

    it('Remove from team calls onRemove', async () => {
      const handlers = setup()
      await openMenu('Bob Birch')
      await userEvent.click(screen.getByRole('menuitem', { name: 'Remove from team' }))
      expect(handlers.onRemove).toHaveBeenCalledWith('b')
    })

    it('Move up and Move down send the full new order', async () => {
      const handlers = setup()
      await openMenu('Bob Birch')
      await userEvent.click(screen.getByRole('menuitem', { name: 'Move up' }))
      expect(handlers.onReorder).toHaveBeenLastCalledWith(['b', 'a', 'c'])

      await openMenu('Bob Birch')
      await userEvent.click(screen.getByRole('menuitem', { name: 'Move down' }))
      expect(handlers.onReorder).toHaveBeenLastCalledWith(['a', 'c', 'b'])
    })
  })

  describe('the clickable badges', () => {
    it('the role badge opens the role menu and picking a role changes it', async () => {
      const handlers = setup()
      await userEvent.click(screen.getByRole('button', { name: 'Cal Cedar, role Batsman, change role' }))
      await userEvent.click(await screen.findByRole('menuitem', { name: 'Bowler' }))
      expect(handlers.onChangeRole).toHaveBeenCalledWith('c', 'BOWLER')
    })

    it('the Captain badge opens a Remove menu', async () => {
      const handlers = setup({ captainPlayerId: 'a' })
      await userEvent.click(screen.getByRole('button', { name: 'Ann Ash, captain, open options' }))
      await userEvent.click(await screen.findByRole('menuitem', { name: 'Remove as captain' }))
      expect(handlers.onSetCaptain).toHaveBeenCalledWith(null)
    })

    it('the Wicketkeeper badge opens a Remove menu', async () => {
      const handlers = setup({ wicketKeeperPlayerId: 'b' })
      await userEvent.click(screen.getByRole('button', { name: 'Bob Birch, wicketkeeper, open options' }))
      await userEvent.click(await screen.findByRole('menuitem', { name: 'Remove as wicketkeeper' }))
      expect(handlers.onSetWicketKeeper).toHaveBeenCalledWith(null)
    })
  })

  describe('the batting position spinner', () => {
    it('commits on Enter and builds the full order', async () => {
      const handlers = setup()
      await openMenu('Ann Ash')
      await userEvent.type(screen.getByLabelText('Batting position for Ann Ash'), '3{Enter}')
      expect(handlers.onReorder).toHaveBeenCalledTimes(1)
      expect(handlers.onReorder).toHaveBeenCalledWith(['b', 'c', 'a'])
    })

    it('commits on blur, once', async () => {
      const handlers = setup()
      await openMenu('Cal Cedar')
      const input = screen.getByLabelText('Batting position for Cal Cedar')
      await userEvent.type(input, '1')
      fireEvent.blur(input)
      expect(handlers.onReorder).toHaveBeenCalledTimes(1)
      expect(handlers.onReorder).toHaveBeenCalledWith(['c', 'a', 'b'])
    })

    it('does nothing when the typed position is the player\'s current one', async () => {
      const handlers = setup()
      await openMenu('Bob Birch')
      await userEvent.type(screen.getByLabelText('Batting position for Bob Birch'), '2{Enter}')
      expect(handlers.onReorder).not.toHaveBeenCalled()
    })

    it('clamps to the last occupied place', async () => {
      const handlers = setup()
      await openMenu('Ann Ash')
      await userEvent.type(screen.getByLabelText('Batting position for Ann Ash'), '9{Enter}')
      expect(handlers.onReorder).toHaveBeenCalledWith(['b', 'c', 'a'])
    })

    it('brings a waiting player into the chosen place', async () => {
      const handlers = setup({
        players: [player('a', 'Ann Ash', 1), player('b', 'Bob Birch', 2), player('w', 'Wes Willow', null)],
      })
      await openMenu('Wes Willow')
      await userEvent.type(screen.getByLabelText('Batting position for Wes Willow'), '2{Enter}')
      expect(handlers.onReorder).toHaveBeenCalledWith(['a', 'w', 'b'])
    })

    it('is disabled with the reason for a waiting player when every place is full', async () => {
      setup({
        players: [player('a', 'Ann Ash', 1), player('b', 'Bob Birch', 2), player('w', 'Wes Willow', null)],
        limits: { battingPlaces: 2, twelfthManAllowed: true, maxSelected: 3 },
      })
      await openMenu('Wes Willow')
      expect(screen.getByLabelText('Batting position for Wes Willow')).toBeDisabled()
      expect(screen.getByText('All 2 places are filled. Remove a player or make someone 12th man first.')).toBeInTheDocument()
    })

    it('words the full reason without the 12th man when none is allowed', async () => {
      setup({
        players: [player('a', 'Ann Ash', 1), player('w', 'Wes Willow', null)],
        limits: { battingPlaces: 1, twelfthManAllowed: false, maxSelected: 1 },
      })
      await openMenu('Wes Willow')
      expect(screen.getByText('All 1 places are filled. Remove a player first.')).toBeInTheDocument()
    })
  })

  describe('drag and drop (native HTML5 events)', () => {
    it('dropping a row on the top half of another reorders', () => {
      const handlers = setup()
      fireEvent.dragStart(screen.getByTestId('selection-row-c'), { dataTransfer: dataTransfer() })
      const target = screen.getByTestId('selection-row-a')
      dragOverAt(target, -1)
      fireEvent.drop(target)
      expect(handlers.onReorder).toHaveBeenCalledWith(['c', 'a', 'b'])
    })

    it('dropping on the "Drop here to place last" zone moves the player to the end', () => {
      const handlers = setup()
      fireEvent.dragStart(screen.getByTestId('selection-row-a'), { dataTransfer: dataTransfer() })
      const zone = screen.getByTestId('batting-end-drop')
      expect(zone).toHaveTextContent('Drop here to place last')
      fireEvent.dragOver(zone)
      fireEvent.drop(zone)
      expect(handlers.onReorder).toHaveBeenCalledWith(['b', 'c', 'a'])
    })

    it('dropping a row onto itself does not reorder', () => {
      const handlers = setup()
      const row = screen.getByTestId('selection-row-b')
      fireEvent.dragStart(row, { dataTransfer: dataTransfer() })
      dragOverAt(row, -1)
      fireEvent.drop(row)
      expect(handlers.onReorder).not.toHaveBeenCalled()
    })

    it('dropping a numbered player into the holding area removes his position', () => {
      const handlers = setup({
        players: [player('a', 'Ann Ash', 1), player('b', 'Bob Birch', 2), player('w', 'Wes Willow', null)],
      })
      fireEvent.dragStart(screen.getByTestId('selection-row-a'), { dataTransfer: dataTransfer() })
      const holding = screen.getByTestId('holding-area')
      fireEvent.dragOver(holding)
      fireEvent.drop(holding)
      expect(handlers.onReorder).toHaveBeenCalledWith(['b'])
    })

    it('dragging a waiting player onto the numbered places brings him in', () => {
      const handlers = setup({
        players: [player('a', 'Ann Ash', 1), player('b', 'Bob Birch', 2), player('w', 'Wes Willow', null)],
      })
      fireEvent.dragStart(screen.getByTestId('selection-row-w'), { dataTransfer: dataTransfer() })
      const target = screen.getByTestId('selection-row-b')
      dragOverAt(target, -1)
      fireEvent.drop(target)
      expect(handlers.onReorder).toHaveBeenCalledWith(['a', 'w', 'b'])
    })

    it('shows "Drop here to start the batting order" when nobody is numbered yet', () => {
      setup({ players: [player('w', 'Wes Willow', null)] })
      fireEvent.dragStart(screen.getByTestId('selection-row-w'), { dataTransfer: dataTransfer() })
      expect(screen.getByTestId('batting-end-drop')).toHaveTextContent('Drop here to start the batting order')
    })

    it('refuses a waiting player when every place is full (no drop zone, no reorder)', () => {
      const handlers = setup({
        players: [player('a', 'Ann Ash', 1), player('b', 'Bob Birch', 2), player('w', 'Wes Willow', null)],
        limits: { battingPlaces: 2, twelfthManAllowed: true, maxSelected: 3 },
      })
      fireEvent.dragStart(screen.getByTestId('selection-row-w'), { dataTransfer: dataTransfer() })
      expect(screen.queryByTestId('batting-end-drop')).not.toBeInTheDocument()
      const target = screen.getByTestId('selection-row-a')
      dragOverAt(target, -1)
      fireEvent.drop(target)
      expect(handlers.onReorder).not.toHaveBeenCalled()
    })

    it('rows are not draggable while the side is announced, but the menu still works', async () => {
      const handlers = setup({ dragDisabled: true })
      expect(screen.getByTestId('selection-row-a')).toHaveAttribute('draggable', 'false')
      await openMenu('Ann Ash')
      await userEvent.click(screen.getByRole('menuitem', { name: 'Make captain' }))
      expect(handlers.onSetCaptain).toHaveBeenCalledWith('a')
    })
  })
})
