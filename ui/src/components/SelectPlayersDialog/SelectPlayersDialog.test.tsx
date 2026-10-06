import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SelectPlayersDialog } from './SelectPlayersDialog'
import type { SelectPlayersDialogProps } from './SelectPlayersDialog'
import { formatMatchDateTime } from '../../utils/matchDateTime'
import type { SelectionPool, SelectionPoolEntry, SelectionTaken } from '../../api/matchSelectionApi'

function entry(id: string, firstName: string, lastName: string, overrides: Partial<SelectionPoolEntry> = {}): SelectionPoolEntry {
  return {
    playerProfileId: id,
    firstName,
    lastName,
    jerseyNumber: null,
    availability: 'AVAILABLE',
    selected: false,
    selectable: true,
    reason: null,
    reasonText: null,
    taken: null,
    ...overrides,
  }
}

function taken(overrides: Partial<SelectionTaken> = {}): SelectionTaken {
  return {
    teamId: 'team-2',
    teamName: 'Villagers 2',
    matchId: 'match-2',
    matchDate: '2026-10-03T09:00:00Z',
    sideId: 'side-2',
    sameMatch: false,
    announced: false,
    canRelease: true,
    ...overrides,
  }
}

function pool(entries: SelectionPoolEntry[], kind: 'NONE' | 'SQUAD' | 'GROUP' = 'SQUAD', extra: Partial<SelectionPool> = {}): SelectionPool {
  return {
    matchId: 'match-1',
    teamId: 'team-1',
    sideId: 'side-1',
    basis: 'ROSTER',
    wholeSection: false,
    coveringPoll: { kind, pollId: kind === 'SQUAD' ? 'poll-1' : null, roundId: kind === 'GROUP' ? 'round-1' : null, matchId: 'match-1' },
    truncated: false,
    entries,
    ...extra,
  }
}

function setup(overrides: Partial<SelectPlayersDialogProps> = {}) {
  const props: SelectPlayersDialogProps = {
    teamName: 'Villagers 1',
    kickoffLabel: 'Sat, 3 Oct, 10:00',
    maxSelected: 12,
    initialSelectedIds: [],
    pool: pool([entry('p1', 'Ann', 'Ash'), entry('p2', 'Bob', 'Birch')]),
    poolLoading: false,
    poolError: false,
    source: 'squad',
    onSourceChange: vi.fn(),
    previousMatches: [],
    previousMatchesLoading: false,
    previousMatchId: null,
    onPreviousMatchChange: vi.fn(),
    previousOrder: null,
    previousOrderLoading: false,
    search: '',
    onSearchChange: vi.fn(),
    onApply: vi.fn().mockResolvedValue({ ok: true }),
    onRelease: vi.fn().mockResolvedValue(undefined),
    onAddNewPlayer: vi.fn(),
    onSetAnswer: vi.fn().mockResolvedValue(undefined),
    onClose: vi.fn(),
    ...overrides,
  }
  render(<SelectPlayersDialog {...props} />)
  return props
}

const group = (name: string) => screen.getByRole('group', { name })
const tick = (name: string) => userEvent.click(screen.getByRole('checkbox', { name }))

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('SelectPlayersDialog', () => {
  it('splits the pool into groups: Available, Not polled, Selected not confirmed, Needs an answer, Not possible', () => {
    setup({
      initialSelectedIds: ['sel'],
      pool: pool([
        entry('p1', 'Ann', 'Ash'),
        entry('p2', 'Bob', 'Birch', { availability: 'NOT_POLLED' }),
        entry('sel', 'Sue', 'Selected', { availability: 'UNSURE', selected: true, selectable: false, reason: 'NOT_CONFIRMED' }),
        entry('p4', 'Dee', 'Dale', { availability: 'NO_RESPONSE', selectable: false, reason: 'NOT_CONFIRMED', reasonText: 'Dee hasn\'t confirmed.' }),
        entry('p5', 'Eve', 'Elm', { availability: 'UNAVAILABLE', selectable: false, reason: 'SAID_UNAVAILABLE' }),
        entry('p6', 'Fay', 'Fir', { selectable: false, reason: 'AGE_INELIGIBLE', reasonText: 'Fay is too old.' }),
      ]),
    })

    expect(within(group('Available')).getByText('Ann Ash')).toBeInTheDocument()
    expect(within(group('Not polled')).getByText('Bob Birch')).toBeInTheDocument()
    const selectedNotConfirmed = group('Selected, not confirmed')
    expect(within(selectedNotConfirmed).getByText('Sue Selected')).toBeInTheDocument()
    expect(within(selectedNotConfirmed).getByRole('checkbox', { name: /Sue Selected/ })).toBeChecked()
    expect(within(group('Needs an answer')).getByText('Dee Dale')).toBeInTheDocument()
    expect(within(group('Needs an answer')).getByText("Dee hasn't confirmed.")).toBeInTheDocument()
    const notPossible = group('Not possible')
    expect(within(notPossible).getByText('Eve Elm')).toBeInTheDocument()
    expect(within(notPossible).getByText('Said unavailable')).toBeInTheDocument()
    expect(within(notPossible).getByText('Fay Fir')).toBeInTheDocument()
    expect(within(notPossible).getByText('Fay is too old.')).toBeInTheDocument()
    // A blocked row has a disabled checkbox.
    expect(within(notPossible).getByRole('checkbox', { name: 'Eve Elm cannot be selected' })).toBeDisabled()
  })

  it('shows the team squad and Whole section chips, "Said available" for a group poll, and reports the chosen source', async () => {
    const props = setup()
    expect(screen.getByRole('button', { name: 'Villagers 1 squad' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Whole section' })).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(screen.getByRole('button', { name: 'Whole section' }))
    expect(props.onSourceChange).toHaveBeenCalledWith('section')
    await userEvent.click(screen.getByRole('button', { name: 'From previous match' }))
    expect(props.onSourceChange).toHaveBeenCalledWith('previous')
  })

  it('labels the first chip "Said available" when a group poll covers the match, with the slot caption', () => {
    setup({ pool: pool([entry('p1', 'Ann', 'Ash')], 'GROUP') })
    expect(screen.getByRole('button', { name: 'Said available' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Villagers 1 squad' })).not.toBeInTheDocument()
    expect(screen.getByText(/apply to the whole slot/)).toBeInTheDocument()
  })

  it('reports search text through onSearchChange', () => {
    const props = setup()
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search players' }), { target: { value: 'ann' } })
    expect(props.onSearchChange).toHaveBeenCalledWith('ann')
  })

  it('says when the pool is truncated', () => {
    setup({ pool: pool([entry('p1', 'Ann', 'Ash')], 'SQUAD', { truncated: true }) })
    expect(screen.getByText('Showing the first 500. Refine your search.')).toBeInTheDocument()
  })

  it('shows a loading line while the pool loads', () => {
    setup({ pool: undefined, poolLoading: true })
    expect(screen.getByText('Loading players…')).toBeInTheDocument()
  })

  it('shows an error alert when the pool failed to load', () => {
    setup({ pool: undefined, poolError: true })
    expect(screen.getByText("Couldn't load the players. Please try again.")).toBeInTheDocument()
  })

  it('shows "No players match." for an empty pool', () => {
    setup({ pool: pool([]) })
    expect(screen.getByText('No players match.')).toBeInTheDocument()
  })

  describe('ticking', () => {
    it('ticks and unticks, updating the footer count, and enables Done only after a change', async () => {
      setup()
      expect(screen.getByText('0 of 12')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Done' })).toBeDisabled()

      await tick('Ann Ash')
      expect(screen.getByText('1 of 12')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Done' })).toBeEnabled()

      await tick('Ann Ash')
      expect(screen.getByText('0 of 12')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Done' })).toBeDisabled()
    })

    it('starts with the selected players ticked', () => {
      setup({
        initialSelectedIds: ['p1'],
        pool: pool([entry('p1', 'Ann', 'Ash', { selected: true }), entry('p2', 'Bob', 'Birch')]),
      })
      expect(screen.getByRole('checkbox', { name: 'Ann Ash' })).toBeChecked()
      expect(screen.getByText('1 of 12')).toBeInTheDocument()
    })

    it('greys out the rest with "Team is full" at the limit, and unticking frees them', async () => {
      setup({
        maxSelected: 2,
        pool: pool([entry('p1', 'Ann', 'Ash'), entry('p2', 'Bob', 'Birch'), entry('p3', 'Cal', 'Cedar')]),
      })
      await tick('Ann Ash')
      await tick('Bob Birch')

      expect(screen.getByRole('checkbox', { name: 'Cal Cedar' })).toBeDisabled()
      expect(within(screen.getByTestId('pool-row-p3')).getByText('Team is full')).toBeInTheDocument()
      expect(screen.getByText(/selected · Team is full/)).toBeInTheDocument()

      await tick('Ann Ash')
      expect(screen.getByRole('checkbox', { name: 'Cal Cedar' })).toBeEnabled()
    })

    it('notes ticked players the current search does not list', async () => {
      setup({
        initialSelectedIds: ['hidden'],
        pool: pool([entry('p1', 'Ann', 'Ash')]),
      })
      expect(screen.getByText(/1 selected player is not shown by the current search/)).toBeInTheDocument()
    })
  })

  describe('Select all available', () => {
    it('is always visible with its count, and ticks only Available players', async () => {
      setup({
        pool: pool([
          entry('p1', 'Ann', 'Ash'),
          entry('p2', 'Bob', 'Birch'),
          entry('p3', 'Cal', 'Cedar', { availability: 'NOT_POLLED' }),
        ]),
      })
      const button = screen.getByRole('button', { name: 'Select all available players not yet selected (2)' })
      expect(button).toHaveTextContent('Select all available (2)')
      await userEvent.click(button)
      expect(screen.getByRole('checkbox', { name: 'Ann Ash' })).toBeChecked()
      expect(screen.getByRole('checkbox', { name: 'Bob Birch' })).toBeChecked()
      expect(screen.getByRole('checkbox', { name: 'Cal Cedar' })).not.toBeChecked()
      expect(screen.getByRole('button', { name: 'Select all available players not yet selected (0)' })).toBeDisabled()
    })

    it('stops at the limit', async () => {
      setup({
        maxSelected: 1,
        pool: pool([entry('p1', 'Ann', 'Ash'), entry('p2', 'Bob', 'Birch')]),
      })
      await userEvent.click(screen.getByRole('button', { name: 'Select all available players not yet selected (1)' }))
      expect(screen.getByRole('checkbox', { name: 'Ann Ash' })).toBeChecked()
      expect(screen.getByRole('checkbox', { name: 'Bob Birch' })).not.toBeChecked()
    })

    it('is disabled, still visible, with no available players', () => {
      setup({ pool: pool([entry('p1', 'Ann', 'Ash', { availability: 'NOT_POLLED' })]) })
      expect(screen.getByRole('button', { name: 'Select all available players not yet selected (0)' })).toBeDisabled()
    })
  })

  describe('Done', () => {
    it('sends the ticked ids (no roles, no positions) in tick order', async () => {
      const props = setup({ initialSelectedIds: ['p1'], pool: pool([entry('p1', 'Ann', 'Ash', { selected: true }), entry('p2', 'Bob', 'Birch')]) })
      await tick('Bob Birch')
      await userEvent.click(screen.getByRole('button', { name: 'Done' }))
      expect(props.onApply).toHaveBeenCalledTimes(1)
      expect(props.onApply).toHaveBeenCalledWith(['p1', 'p2'])
    })

    it('a refused apply keeps the dialog open, shows per-row messages and unticks the refused players', async () => {
      const props = setup({
        onApply: vi.fn().mockResolvedValue({
          ok: false,
          message: 'Some players can\'t be selected.',
          rejections: [
            { playerProfileId: 'p2', playerName: 'Bob Birch', reason: 'TAKEN_FOR_SLOT', message: 'Bob is already in Villagers 2.', taken: null },
            { playerProfileId: null, playerName: null, reason: 'TEAM_FULL', message: 'The team is full.', taken: null },
          ],
        }),
      })
      await tick('Ann Ash')
      await tick('Bob Birch')
      await userEvent.click(screen.getByRole('button', { name: 'Done' }))

      expect(await screen.findByText("Some players can't be selected")).toBeInTheDocument()
      expect(screen.getByText('The team is full.')).toBeInTheDocument()
      expect(within(screen.getByTestId('pool-row-p2')).getByText('Bob is already in Villagers 2.')).toBeInTheDocument()
      expect(screen.getByRole('checkbox', { name: 'Bob Birch' })).not.toBeChecked()
      expect(screen.getByRole('checkbox', { name: 'Ann Ash' })).toBeChecked()
      expect(props.onClose).not.toHaveBeenCalled()
    })

    it('names a refused player the current list does not show in the alert', async () => {
      setup({
        initialSelectedIds: ['hidden'],
        pool: pool([entry('p1', 'Ann', 'Ash')]),
        onApply: vi.fn().mockResolvedValue({
          ok: false,
          rejections: [{ playerProfileId: 'hidden', playerName: 'Hal Hidden', reason: 'SAID_UNAVAILABLE', message: 'Hal said he is unavailable.', taken: null }],
        }),
      })
      await tick('Ann Ash')
      await userEvent.click(screen.getByRole('button', { name: 'Done' }))
      expect(await screen.findByText('Hal Hidden: Hal said he is unavailable.')).toBeInTheDocument()
    })

    it('a failure without rejections shows its message', async () => {
      setup({ onApply: vi.fn().mockResolvedValue({ ok: false, message: 'Server down.', rejections: [] }) })
      await tick('Ann Ash')
      await userEvent.click(screen.getByRole('button', { name: 'Done' }))
      expect(await screen.findByText('Server down.')).toBeInTheDocument()
    })

    it('Cancel closes without applying', async () => {
      const props = setup()
      await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
      expect(props.onClose).toHaveBeenCalled()
      expect(props.onApply).not.toHaveBeenCalled()
    })
  })

  describe('blocked rows', () => {
    const TAKEN_ENTRY = (takenOverrides: Partial<SelectionTaken> = {}) =>
      entry('p3', 'Jaden', 'Brooks', {
        selectable: false,
        reason: 'TAKEN_FOR_SLOT',
        taken: taken(takenOverrides),
      })

    it('shows the other team and time, with Release when the manager can release', () => {
      setup({ pool: pool([TAKEN_ENTRY()]) })
      const row = screen.getByTestId('pool-row-p3')
      expect(within(row).getByText(`In Villagers 2 · ${formatMatchDateTime('2026-10-03T09:00:00Z')}`)).toBeInTheDocument()
      expect(within(row).getByRole('button', { name: 'Release from Villagers 2' })).toBeInTheDocument()
    })

    it('says to ask that team\'s manager when he cannot release', () => {
      setup({ pool: pool([TAKEN_ENTRY({ canRelease: false })]) })
      const row = screen.getByTestId('pool-row-p3')
      expect(within(row).getByText("Ask that team's manager to release this player")).toBeInTheDocument()
      expect(within(row).queryByRole('button', { name: /Release from/ })).not.toBeInTheDocument()
    })

    it('confirms with the exact text, releases with the entry, refetch is the page\'s job, and does not tick him', async () => {
      const props = setup({ pool: pool([TAKEN_ENTRY()]) })
      await userEvent.click(screen.getByRole('button', { name: 'Release from Villagers 2' }))

      expect(screen.getByText('Release Jaden Brooks from Villagers 2?')).toBeInTheDocument()
      expect(screen.getByText("Removes Jaden from Villagers 2's selection")).toBeInTheDocument()
      expect(screen.queryByText(/is announced/)).not.toBeInTheDocument()

      await userEvent.click(screen.getByRole('button', { name: 'Release' }))
      await waitFor(() => expect(props.onRelease).toHaveBeenCalledTimes(1))
      expect(props.onRelease).toHaveBeenCalledWith(expect.objectContaining({ playerProfileId: 'p3' }))
      await waitFor(() => expect(screen.queryByText('Release Jaden Brooks from Villagers 2?')).not.toBeInTheDocument())
      expect(screen.getByText('0 of 12')).toBeInTheDocument()
    })

    it('adds the announced warning when the other team is announced', async () => {
      setup({ pool: pool([TAKEN_ENTRY({ announced: true })]) })
      await userEvent.click(screen.getByRole('button', { name: 'Release from Villagers 2' }))
      expect(screen.getByText("Villagers 2's team is announced. This changes a published team.")).toBeInTheDocument()
    })

    it('keeps the confirmation open with an error when the release fails', async () => {
      setup({ pool: pool([TAKEN_ENTRY()]), onRelease: vi.fn().mockRejectedValue(new Error('boom')) })
      await userEvent.click(screen.getByRole('button', { name: 'Release from Villagers 2' }))
      await userEvent.click(screen.getByRole('button', { name: 'Release' }))
      expect(await screen.findByText("Couldn't release this player. Please try again.")).toBeInTheDocument()
      expect(screen.getByText('Release Jaden Brooks from Villagers 2?')).toBeInTheDocument()
    })

    it('cancelling the release confirmation does not release', async () => {
      const props = setup({ pool: pool([TAKEN_ENTRY()]) })
      await userEvent.click(screen.getByRole('button', { name: 'Release from Villagers 2' }))
      const dialog = screen.getByText('Release Jaden Brooks from Villagers 2?').closest('[role="dialog"]') as HTMLElement
      await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
      expect(props.onRelease).not.toHaveBeenCalled()
    })
  })

  describe('Set answer', () => {
    const UNSURE_ENTRY = entry('p4', 'Dee', 'Dale', { availability: 'UNSURE', selectable: false, reason: 'NOT_CONFIRMED' })

    it('offers Available / Unsure / Unavailable (the current answer disabled) and calls onSetAnswer, keeping the dialog open', async () => {
      const props = setup({ pool: pool([UNSURE_ENTRY]) })
      await userEvent.click(screen.getByRole('button', { name: 'Set answer for Dee Dale' }))
      expect(screen.getByRole('menuitem', { name: 'Unsure' })).toHaveAttribute('aria-disabled', 'true')
      await userEvent.click(screen.getByRole('menuitem', { name: 'Available' }))

      expect(props.onSetAnswer).toHaveBeenCalledWith(expect.objectContaining({ playerProfileId: 'p4' }), 'AVAILABLE')
      expect(props.onClose).not.toHaveBeenCalled()
      expect(screen.getByText('Select players · Villagers 1')).toBeInTheDocument()
    })

    it('is offered on No response and Unavailable rows, but not on Available rows', () => {
      setup({
        pool: pool([
          entry('p1', 'Ann', 'Ash'),
          entry('p5', 'Eve', 'Elm', { availability: 'UNAVAILABLE', selectable: false, reason: 'SAID_UNAVAILABLE' }),
          entry('p6', 'Nia', 'Nash', { availability: 'NO_RESPONSE', selectable: false, reason: 'NOT_CONFIRMED' }),
        ]),
      })
      expect(screen.getByRole('button', { name: 'Set answer for Eve Elm' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Set answer for Nia Nash' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Set answer for Ann Ash' })).not.toBeInTheDocument()
    })

    it('is not offered when no poll covers the match', () => {
      setup({ pool: pool([UNSURE_ENTRY], 'NONE') })
      expect(screen.queryByRole('button', { name: /Set answer for/ })).not.toBeInTheDocument()
    })

    it('unticks a ticked player who has just been marked unavailable, and says so', async () => {
      setup({
        initialSelectedIds: ['p4'],
        pool: pool([{ ...UNSURE_ENTRY, selected: true }]),
      })
      expect(screen.getByRole('checkbox', { name: /Dee Dale/ })).toBeChecked()
      await userEvent.click(screen.getByRole('button', { name: 'Set answer for Dee Dale' }))
      await userEvent.click(screen.getByRole('menuitem', { name: 'Unavailable' }))
      expect(await screen.findByText('Dee Dale is now marked unavailable, so he was unticked.')).toBeInTheDocument()
      expect(screen.getByText('0 of 12')).toBeInTheDocument()
    })

    it('keeps ticks and shows an alert when saving the answer fails', async () => {
      setup({
        initialSelectedIds: ['p4'],
        pool: pool([{ ...UNSURE_ENTRY, selected: true }]),
        onSetAnswer: vi.fn().mockRejectedValue(new Error('nope')),
      })
      await userEvent.click(screen.getByRole('button', { name: 'Set answer for Dee Dale' }))
      await userEvent.click(screen.getByRole('menuitem', { name: 'Available' }))
      expect(await screen.findByText(/Couldn't save Dee Dale's answer\./)).toBeInTheDocument()
      expect(screen.getByRole('checkbox', { name: /Dee Dale/ })).toBeChecked()
    })
  })

  describe('From previous match', () => {
    it('says there are no previous matches', () => {
      setup({ source: 'previous', previousMatches: [] })
      expect(screen.getByText('No previous matches for this team and season')).toBeInTheDocument()
    })

    it('asks to choose a match until one is chosen, then reports the choice', async () => {
      const props = setup({ source: 'previous', previousMatches: [{ id: 'm0', label: '1 Sep - vs Hawks' }] })
      expect(screen.getByText('Choose a match to show the players who played in it.')).toBeInTheDocument()
      await userEvent.click(screen.getByRole('combobox', { name: 'Previous match' }))
      await userEvent.click(await screen.findByRole('option', { name: '1 Sep - vs Hawks' }))
      expect(props.onPreviousMatchChange).toHaveBeenCalledWith('m0')
    })

    it('lists only the previous match\'s players, in its order', () => {
      setup({
        source: 'previous',
        previousMatches: [{ id: 'm0', label: 'prev' }],
        previousMatchId: 'm0',
        previousOrder: ['p2', 'p1'],
        pool: pool([entry('p1', 'Ann', 'Ash'), entry('p2', 'Bob', 'Birch'), entry('p3', 'Cal', 'Cedar')]),
      })
      const rows = screen.getAllByTestId(/^pool-row-/).map((row) => row.getAttribute('data-testid'))
      expect(rows).toEqual(['pool-row-p2', 'pool-row-p1'])
      expect(screen.queryByText('Cal Cedar')).not.toBeInTheDocument()
    })
  })

  it('Add new player calls onAddNewPlayer', async () => {
    const props = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Add new player' }))
    expect(props.onAddNewPlayer).toHaveBeenCalledTimes(1)
  })

  it('is full screen on a phone-width viewport and a regular dialog otherwise', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: true,
      media: query,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
    }))
    setup()
    expect(screen.getByRole('dialog').className).toContain('MuiDialog-paperFullScreen')
  })

  it('is not full screen on desktop', () => {
    setup()
    expect(screen.getByRole('dialog').className).not.toContain('MuiDialog-paperFullScreen')
  })
})
