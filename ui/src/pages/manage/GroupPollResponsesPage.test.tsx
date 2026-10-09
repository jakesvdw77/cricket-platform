import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AxiosError } from 'axios'
import GroupPollResponsesPage from './GroupPollResponsesPage'
import type {
  SectionAvailabilityRound,
  SectionAvailabilityRoundMatch,
  SectionAvailabilityRoundResponses,
} from '../../api/sectionAvailabilityApi'

const listRounds = vi.fn()
const getRoundResponses = vi.fn()
const getRoundMatches = vi.fn()
const setRoundPlayerStatus = vi.fn()
const updateRoundCloseTime = vi.fn()
const openRound = vi.fn()
const closeRound = vi.fn()

vi.mock('../../api/sectionAvailabilityApi', async () => {
  const actual = await vi.importActual<typeof import('../../api/sectionAvailabilityApi')>('../../api/sectionAvailabilityApi')
  return {
    ...actual,
    listRounds: (clubId: string, params: unknown) => listRounds(clubId, params),
    getRoundResponses: (clubId: string, roundId: string) => getRoundResponses(clubId, roundId),
    getRoundMatches: (clubId: string, roundId: string) => getRoundMatches(clubId, roundId),
    updateRoundCloseTime: (clubId: string, roundId: string, payload: unknown) => updateRoundCloseTime(clubId, roundId, payload),
    openRound: (clubId: string, roundId: string) => openRound(clubId, roundId),
    closeRound: (clubId: string, roundId: string) => closeRound(clubId, roundId),
    setRoundPlayerStatus: (clubId: string, roundId: string, playerProfileId: string, windowId: string, status: string) =>
      setRoundPlayerStatus(clubId, roundId, playerProfileId, windowId, status),
  }
})

const BRACKETS: SectionAvailabilityRound['brackets'] = [
  { dayPart: 'MORNING', windowDate: '2026-06-06', windowId: 'window-1', availableCount: 1, unavailableCount: 0, unsureCount: 1, noResponseCount: 2, coveredMatchCount: 1 },
  { dayPart: 'AFTERNOON', windowDate: '2026-06-06', windowId: 'window-2', availableCount: 1, unavailableCount: 1, unsureCount: 0, noResponseCount: 2, coveredMatchCount: 1 },
]

function makeRound(overrides: Partial<SectionAvailabilityRound> = {}): SectionAvailabilityRound {
  return {
    id: 'round-1',
    sectionId: 'section-1',
    sectionName: 'U13 Boys',
    description: 'Sat 6 Jun - U13 Boys fixtures',
    firstMatchDate: '2026-06-06T09:00:00Z',
    lastMatchDate: '2026-06-06T09:00:00Z',
    firstMatchKickoff: '2026-06-06T09:00:00Z',
    autoClose: true,
    scheduledCloseAt: '2026-06-05T09:00:00Z',
    canReopen: true,
    open: true,
    brackets: BRACKETS,
    ...overrides,
  }
}

type Status = 'AVAILABLE' | 'UNAVAILABLE' | 'UNSURE' | null

function player(id: string, firstName: string, lastName: string, jerseyNumber: number | null, morning: Status, afternoon: Status) {
  return {
    playerProfileId: id,
    firstName,
    lastName,
    jerseyNumber,
    statuses: [
      { windowId: 'window-1', dayPart: 'MORNING' as const, windowDate: '2026-06-06', status: morning },
      { windowId: 'window-2', dayPart: 'AFTERNOON' as const, windowDate: '2026-06-06', status: afternoon },
    ],
  }
}

function makeResponses(overrides: Partial<SectionAvailabilityRoundResponses> = {}): SectionAvailabilityRoundResponses {
  return {
    roundId: 'round-1',
    sectionId: 'section-1',
    sectionName: 'U13 Boys',
    description: 'Sat 6 Jun - U13 Boys fixtures',
    open: true,
    brackets: BRACKETS,
    responses: [
      player('player-1', 'Jane', 'Smith', 7, 'AVAILABLE', null),
      player('player-2', 'Bob', 'Jones', null, 'UNSURE', 'AVAILABLE'),
      player('player-3', 'Amy', 'Lee', null, null, 'UNAVAILABLE'),
      player('player-4', 'Cal', 'Ng', null, null, null),
    ],
    publicPath: '/section-availability/round-1',
    ...overrides,
  }
}

function makeMatch(overrides: Partial<SectionAvailabilityRoundMatch> = {}): SectionAvailabilityRoundMatch {
  return {
    matchId: 'match-1',
    teamId: 'team-1',
    teamName: 'U13 Boys A',
    opponentLabel: 'Rivals CC',
    matchDate: '2026-06-06T09:00:00Z',
    venue: 'Home Ground',
    leagueName: 'Junior League',
    dayPart: 'MORNING',
    windowId: 'window-1',
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  listRounds.mockResolvedValue([makeRound()])
  getRoundResponses.mockResolvedValue(makeResponses())
  getRoundMatches.mockResolvedValue([
    makeMatch(),
    makeMatch({ matchId: 'match-2', teamName: 'U13 Boys B', opponentLabel: 'Town CC', dayPart: 'AFTERNOON', windowId: 'window-2', leagueName: null }),
  ])
})

function renderPage(clubId: string | null = 'test-club-id', roundId = 'round-1') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/manage/availability/group/${roundId}`]}>
        <Routes>
          <Route path="/manage" element={<Outlet context={{ clubId: clubId ?? undefined }} />}>
            <Route path="availability" element={<div>Polls List</div>} />
            <Route path="availability/group/:roundId" element={<GroupPollResponsesPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

// The By time slot block for one Morning/Afternoon slot.
function slotSection(dayPart: 'Morning' | 'Afternoon') {
  const heading = screen.getByRole('heading', { level: 3, name: new RegExp(`· ${dayPart}$`) })
  return within(heading.closest('section') as HTMLElement)
}

function column(dayPart: 'Morning' | 'Afternoon', status: 'Available' | 'Unsure' | 'Unavailable') {
  return screen.getByRole('group', { name: new RegExp(`^${status} players, .*${dayPart}$`) })
}

async function loaded() {
  await screen.findByRole('heading', { level: 1, name: 'Sat 6 Jun - U13 Boys fixtures' })
}

describe('GroupPollResponsesPage', () => {
  it('renders the header with the open badge, section and close time', async () => {
    renderPage()
    await loaded()

    expect(screen.getByText('Open')).toBeInTheDocument()
    expect(screen.getByText('Group poll')).toBeInTheDocument()
    expect(screen.getByText(/U13 Boys · Closes /)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /back to availability polls/i })).toHaveAttribute('href', '/manage/availability')
  })

  it('says "Closes manually" when the poll does not autoclose', async () => {
    listRounds.mockResolvedValue([makeRound({ autoClose: false, scheduledCloseAt: null })])
    renderPage()
    await loaded()

    expect(screen.getByText(/Closes manually/)).toBeInTheDocument()
  })

  it('defaults to By time slot with a block per slot, in order, with its matches', async () => {
    renderPage()
    await loaded()

    const headings = screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)
    expect(headings).toHaveLength(2)
    expect(headings[0]).toMatch(/· Morning$/)
    expect(headings[1]).toMatch(/· Afternoon$/)
    expect(screen.getByRole('button', { name: 'Time slot' })).toHaveAttribute('aria-pressed', 'true')
    expect(slotSection('Morning').getByText(/U13 Boys A v Rivals CC/)).toBeInTheDocument()
    expect(slotSection('Morning').getByText(/Junior League/)).toBeInTheDocument()
    expect(slotSection('Afternoon').getByText(/U13 Boys B v Town CC/)).toBeInTheDocument()
  })

  it('groups players per slot, with counts and None for an empty group', async () => {
    renderPage()
    await loaded()

    // Jane: Available in the morning, no response in the afternoon; Bob differs by slot.
    expect(within(column('Morning', 'Available')).getByText('Jane Smith')).toBeInTheDocument()
    expect(within(column('Morning', 'Available')).queryByText('#7')).toBeNull()
    expect(within(column('Morning', 'Unsure')).getByText('Bob Jones')).toBeInTheDocument()
    expect(within(column('Afternoon', 'Available')).getByText('Bob Jones')).toBeInTheDocument()
    expect(within(column('Afternoon', 'Unavailable')).getByText('Amy Lee')).toBeInTheDocument()

    expect(within(column('Morning', 'Unavailable')).getByText('None')).toBeInTheDocument()
    expect(within(column('Afternoon', 'Unsure')).getByText('None')).toBeInTheDocument()

    const availableHeading = slotSection('Morning').getByRole('heading', { level: 4, name: 'Available' })
    expect(availableHeading.parentElement).toHaveTextContent('Available1')
    const unavailableHeading = slotSection('Morning').getByRole('heading', { level: 4, name: 'Unavailable' })
    expect(unavailableHeading.parentElement).toHaveTextContent('Unavailable0')
  })

  it('collapses No response to its count and expands per slot', async () => {
    const user = userEvent.setup()
    renderPage()
    await loaded()

    expect(screen.getAllByRole('heading', { level: 4, name: 'No response (2)' })).toHaveLength(2)
    expect(screen.queryByText('Cal Ng')).not.toBeInTheDocument()

    await user.click(slotSection('Morning').getByRole('button', { name: /show no response players/i }))

    expect(slotSection('Morning').getByText('Cal Ng')).toBeInTheDocument()
    expect(slotSection('Morning').getByText('Amy Lee')).toBeInTheDocument()
    // The Afternoon slot stays collapsed (independent per slot).
    expect(slotSection('Afternoon').queryByText('Cal Ng')).not.toBeInTheDocument()

    await user.click(slotSection('Morning').getByRole('button', { name: /hide no response players/i }))
    expect(screen.queryByText('Cal Ng')).not.toBeInTheDocument()
  })

  it('puts each answer list in its own labelled group that grows (no inner scrollbar, 085)', async () => {
    renderPage()
    await loaded()

    const box = column('Morning', 'Available')
    expect(box).not.toHaveAttribute('tabindex')
    expect(box).not.toHaveStyle({ overflowY: 'auto' })
    expect(box).not.toHaveStyle({ maxHeight: '392px' })
  })

  it('lists the player names with a divider between them and no shirt number (085)', async () => {
    renderPage()
    await loaded()

    const jane = within(column('Morning', 'Available')).getByRole('button', { name: /Jane Smith/ })
    expect(jane.textContent).toBe('Jane Smith')
    expect(within(jane).queryByTestId('player-number')).toBeNull()
    expect(getComputedStyle(jane).borderBottomWidth).toBe('1px')
  })

  it('shows the arrow, the word Show / Hide and aria-expanded on the whole No response bar (085)', async () => {
    const user = userEvent.setup()
    renderPage()
    await loaded()

    const toggle = slotSection('Morning').getByRole('button', { name: /show no response players/i })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    const label = slotSection('Morning').getByTestId('no-response-toggle-label')
    expect(label).toHaveTextContent('Show')
    expect(label.querySelector('[data-testid="KeyboardArrowDownIcon"]')).not.toBeNull()
    await user.click(toggle)
    const open = slotSection('Morning').getByRole('button', { name: /hide no response players/i })
    expect(open).toHaveAttribute('aria-expanded', 'true')
    expect(slotSection('Morning').getByTestId('no-response-toggle-label')).toHaveTextContent('Hide')
    expect(slotSection('Morning').getByTestId('no-response-toggle-label').querySelector('[data-testid="KeyboardArrowUpIcon"]')).not.toBeNull()
  })

  it('switches to By player: one aligned column per slot, sorted by name', async () => {
    const user = userEvent.setup()
    renderPage()
    await loaded()

    await user.click(screen.getByRole('button', { name: 'Player' }))

    const table = screen.getByRole('table', { name: 'Responses by player' })
    expect(within(table).getAllByRole('columnheader')).toHaveLength(3)
    const bodyRows = within(table).getAllByRole('row').slice(1)
    expect(bodyRows.map((row) => within(row).getAllByRole('cell')[0].textContent)).toEqual([
      'Bob Jones',
      'Amy Lee',
      'Cal Ng',
      'Jane Smith',
    ])
    // Status word is always in the chip.
    expect(within(bodyRows[0]).getByText('Unsure')).toBeInTheDocument()
    expect(within(bodyRows[0]).getByText('Available')).toBeInTheDocument()
    expect(within(bodyRows[2]).getAllByText('No response')).toHaveLength(2)
  })

  it('has no shirt number column and alternates the row tint in By player (085)', async () => {
    const user = userEvent.setup()
    renderPage()
    await loaded()
    await user.click(screen.getByRole('button', { name: 'Player' }))

    const table = screen.getByRole('table', { name: 'Responses by player' })
    expect(within(table).queryByRole('columnheader', { name: '#' })).toBeNull()
    const rows = within(table).getAllByRole('row').slice(1)
    // The first row and every second row after it carry an opaque tint from the theme; the others stay on the panel colour.
    expect(getComputedStyle(rows[0]).backgroundColor).toMatch(/^rgb\(/)
    expect(getComputedStyle(rows[0]).backgroundColor).not.toBe(getComputedStyle(rows[1]).backgroundColor)
  })

  describe('Player tab status chips, sorting and slot selector (085 J)', () => {
    async function openPlayerTab() {
      const user = userEvent.setup()
      renderPage()
      await loaded()
      await user.click(screen.getByRole('button', { name: 'Player' }))
      return user
    }
    const names = () =>
      within(screen.getByRole('table', { name: 'Responses by player' }))
        .getAllByRole('row')
        .slice(1)
        .map((row) => within(row).getAllByRole('cell')[0].textContent)

    it('shows chips with the first slot\'s counts over all players, and a Slot selector for several slots', async () => {
      await openPlayerTab()

      const chips = within(screen.getByRole('group', { name: 'Filter by status' }))
      expect(chips.getByRole('button', { name: 'All 4' })).toHaveAttribute('aria-pressed', 'true')
      expect(chips.getByRole('button', { name: 'Available 1' })).toBeInTheDocument()
      expect(chips.getByRole('button', { name: 'Unsure 1' })).toBeInTheDocument()
      expect(chips.getByRole('button', { name: 'Unavailable 0' })).toBeInTheDocument()
      expect(chips.getByRole('button', { name: 'No response 2' })).toBeInTheDocument()
      expect(screen.getByRole('combobox', { name: 'Slot' })).toHaveTextContent(/Morning/)
    })

    it('a chip shows only those players, again or All shows everyone, and the counts ignore search and chip', async () => {
      const user = await openPlayerTab()

      await user.click(screen.getByRole('button', { name: 'No response 2' }))
      expect(names()).toEqual(['Amy Lee', 'Cal Ng'])
      expect(screen.getByRole('button', { name: 'No response 2' })).toHaveAttribute('aria-pressed', 'true')
      await user.type(screen.getByLabelText('Search players'), 'cal')
      expect(names()).toEqual(['Cal Ng'])
      // Counts still describe all four players.
      expect(screen.getByRole('button', { name: 'All 4' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'No response 2' })).toBeInTheDocument()

      await user.clear(screen.getByLabelText('Search players'))
      await user.click(screen.getByRole('button', { name: 'No response 2' }))
      expect(names()).toHaveLength(4)
      await user.click(screen.getByRole('button', { name: 'Unsure 1' }))
      await user.click(screen.getByRole('button', { name: 'All 4' }))
      expect(names()).toHaveLength(4)
    })

    it('combines the chip with the hide-unanswered switch', async () => {
      const user = await openPlayerTab()

      await user.click(screen.getByRole('checkbox', { name: "Hide players who haven't answered" }))
      await user.click(screen.getByRole('button', { name: 'No response 2' }))
      // Of the two with no answer in Morning, Cal has none at all (hidden); Amy answered Afternoon.
      expect(names()).toEqual(['Amy Lee'])
    })

    it('sorts by name by default, reverses on a second click, and shows aria-sort and an arrow', async () => {
      const user = await openPlayerTab()
      const player = screen.getByRole('columnheader', { name: /Player/ })
      expect(player).toHaveAttribute('aria-sort', 'ascending')
      expect(names()).toEqual(['Bob Jones', 'Amy Lee', 'Cal Ng', 'Jane Smith'])

      await user.click(within(player).getByRole('button'))
      expect(player).toHaveAttribute('aria-sort', 'descending')
      expect(names()).toEqual(['Jane Smith', 'Cal Ng', 'Amy Lee', 'Bob Jones'])
      expect(screen.getByRole('columnheader', { name: /Morning/ })).toHaveAttribute('aria-sort', 'none')
    })

    it('a slot heading sorts by status (Available, Unsure, Unavailable, No response) and reverses on a second click', async () => {
      const user = await openPlayerTab()
      const morning = () => screen.getByRole('columnheader', { name: /Morning/ })

      await user.click(within(morning()).getByRole('button'))
      expect(morning()).toHaveAttribute('aria-sort', 'ascending')
      expect(screen.getByRole('columnheader', { name: /Player/ })).toHaveAttribute('aria-sort', 'none')
      expect(names()).toEqual(['Jane Smith', 'Bob Jones', 'Amy Lee', 'Cal Ng'])

      await user.click(within(morning()).getByRole('button'))
      expect(morning()).toHaveAttribute('aria-sort', 'descending')
      expect(names()).toEqual(['Amy Lee', 'Cal Ng', 'Bob Jones', 'Jane Smith'])
    })

    it('clicking another slot\'s heading selects it: the chips and the status sort follow, the other column stays', async () => {
      const user = await openPlayerTab()

      await user.click(within(screen.getByRole('columnheader', { name: /Afternoon/ })).getByRole('button'))

      expect(screen.getByRole('combobox', { name: 'Slot' })).toHaveTextContent(/Afternoon/)
      expect(screen.getByRole('button', { name: 'Available 1' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Unavailable 1' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'No response 2' })).toBeInTheDocument()
      expect(screen.getByRole('columnheader', { name: /Morning/ })).toBeInTheDocument()
      expect(names()).toEqual(['Bob Jones', 'Amy Lee', 'Cal Ng', 'Jane Smith'])
    })

    it('choosing a slot in the selector changes what the chips count', async () => {
      const user = await openPlayerTab()

      await user.click(screen.getByRole('combobox', { name: 'Slot' }))
      await user.click(screen.getByRole('option', { name: /Afternoon/ }))

      expect(screen.getByRole('button', { name: 'Unavailable 1' })).toBeInTheDocument()
    })
  })

  it('hides players who have not answered in By player', async () => {
    const user = userEvent.setup()
    renderPage()
    await loaded()
    await user.click(screen.getByRole('button', { name: 'Player' }))

    expect(screen.getByText('Cal Ng')).toBeInTheDocument()
    await user.click(screen.getByRole('checkbox', { name: "Hide players who haven't answered" }))

    expect(screen.queryByText('Cal Ng')).not.toBeInTheDocument()
    expect(screen.getByText('Jane Smith')).toBeInTheDocument()
  })

  it('has two tabs only: Time slot and Player, no Summary (085)', async () => {
    renderPage()
    await loaded()

    expect(screen.getByRole('button', { name: 'Time slot' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Player' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Summary' })).not.toBeInTheDocument()
  })

  it('puts the tabs and search inside the filter panel (085)', async () => {
    renderPage()
    await loaded()

    const panel = screen.getByLabelText('Search players').closest('div[class*="MuiBox-root"]')?.parentElement?.parentElement as HTMLElement
    expect(within(panel).getByRole('button', { name: 'Time slot' })).toBeInTheDocument()
    expect(getComputedStyle(panel).boxShadow).not.toBe('none')
  })

  it('shows the header gauge on both tabs: answered all / some / none for a poll with several slots, and a thin bar per slot (085)', async () => {
    const user = userEvent.setup()
    renderPage()
    await loaded()

    // Bob answered both slots; Jane and Amy one; Cal none.
    const gauge = screen.getByRole('group', { name: 'Response summary' })
    expect(gauge).toHaveTextContent('1answered all')
    expect(gauge).toHaveTextContent('2some')
    expect(gauge).toHaveTextContent('1none')
    // Per-slot thin bar from the bracket totals (Morning: 1 / 1 / 0 / 2).
    expect(screen.getByRole('img', { name: '1 Available, 1 Unsure, 0 Unavailable, 2 No response' })).toBeInTheDocument()
    expect(screen.getByTestId('window-1-bar-NONE')).toHaveStyle({ width: '50%' })

    await user.click(screen.getByRole('button', { name: 'Player' }))
    expect(screen.getByRole('group', { name: 'Response summary' })).toHaveTextContent('1answered all')
  })

  it('search filters players in every view while the header gauge stays full', async () => {
    const user = userEvent.setup()
    renderPage()
    await loaded()

    await user.type(screen.getByLabelText('Search players'), 'jane')

    expect(screen.getByText('Jane Smith')).toBeInTheDocument()
    expect(screen.queryByText('Bob Jones')).not.toBeInTheDocument()
    // Only Jane remains: Morning Available 1 / Unsure 0, Afternoon Available 0 / No response 1.
    expect(slotSection('Morning').getByRole('heading', { level: 4, name: 'Available' }).parentElement).toHaveTextContent('Available1')
    expect(slotSection('Morning').getByRole('heading', { level: 4, name: 'Unsure' }).parentElement).toHaveTextContent('Unsure0')
    expect(slotSection('Afternoon').getByRole('heading', { level: 4, name: 'Available' }).parentElement).toHaveTextContent('Available0')
    expect(slotSection('Afternoon').getByRole('heading', { level: 4, name: 'No response (1)' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Player' }))
    expect(screen.getByText('Jane Smith')).toBeInTheDocument()
    expect(screen.queryByText('Bob Jones')).not.toBeInTheDocument()

    expect(screen.getByRole('group', { name: 'Response summary' })).toHaveTextContent('1answered all')
    expect(screen.getByRole('group', { name: 'Response summary' })).toHaveTextContent('2some')
  })

  it("sets a player's answer via the override menu, by windowId, and updates the page", async () => {
    const user = userEvent.setup()
    const updated = makeResponses({
      responses: [
        player('player-1', 'Jane', 'Smith', 7, 'AVAILABLE', 'UNAVAILABLE'),
        player('player-2', 'Bob', 'Jones', null, 'UNSURE', 'AVAILABLE'),
        player('player-3', 'Amy', 'Lee', null, null, 'UNAVAILABLE'),
        player('player-4', 'Cal', 'Ng', null, null, null),
      ],
    })
    setRoundPlayerStatus.mockResolvedValueOnce(updated)
    // The invalidation after a successful override refetches, as the real backend now returns it.
    getRoundResponses.mockResolvedValue(updated)
    renderPage()
    await loaded()
    await user.click(screen.getByRole('button', { name: 'Player' }))

    await user.click(screen.getByLabelText(/Set Jane Smith's.*afternoon availability/i))
    const items = await screen.findAllByRole('menuitem')
    expect(items.map((item) => item.textContent)).toEqual(['Available', 'Unsure', 'Unavailable'])
    await user.click(screen.getByRole('menuitem', { name: 'Unavailable' }))

    expect(setRoundPlayerStatus).toHaveBeenCalledWith('test-club-id', 'round-1', 'player-1', 'window-2', 'UNAVAILABLE')
    await waitFor(() => {
      const janeRow = screen.getByText('Jane Smith').closest('tr') as HTMLElement
      expect(within(janeRow).getByText('Unavailable')).toBeInTheDocument()
    })
  })

  it('moves the player to the new group in By time slot and keeps focus off the page body', async () => {
    const user = userEvent.setup()
    const updated = makeResponses({
      responses: [
        player('player-1', 'Jane', 'Smith', 7, 'UNSURE', null),
        player('player-2', 'Bob', 'Jones', null, 'UNSURE', 'AVAILABLE'),
        player('player-3', 'Amy', 'Lee', null, null, 'UNAVAILABLE'),
        player('player-4', 'Cal', 'Ng', null, null, null),
      ],
    })
    setRoundPlayerStatus.mockResolvedValueOnce(updated)
    renderPage()
    await loaded()
    // The refetch after the save returns the moved player, as the real backend does.
    getRoundResponses.mockResolvedValue(updated)

    await user.click(within(column('Morning', 'Available')).getByLabelText(/Set Jane Smith's.*morning availability/i))
    await user.click(await screen.findByRole('menuitem', { name: 'Unsure' }))

    expect(setRoundPlayerStatus).toHaveBeenCalledWith('test-club-id', 'round-1', 'player-1', 'window-1', 'UNSURE')
    await waitFor(() => {
      expect(within(column('Morning', 'Unsure')).getByText('Jane Smith')).toBeInTheDocument()
    })
    expect(within(column('Morning', 'Available')).queryByText('Jane Smith')).not.toBeInTheDocument()
    expect(within(column('Morning', 'Available')).getByText('None')).toBeInTheDocument()
    // The old trigger is gone; focus sits on the slot heading, not <body>.
    await waitFor(() => {
      expect(document.body).not.toHaveFocus()
      expect(screen.getByRole('heading', { level: 3, name: /· Morning$/ })).toHaveFocus()
    })
  })

  it('keeps the trigger focusable (aria-disabled, clicks ignored) while its own override is pending', async () => {
    const user = userEvent.setup()
    let resolveSave: (value: SectionAvailabilityRoundResponses) => void = () => {}
    setRoundPlayerStatus.mockReturnValueOnce(new Promise<SectionAvailabilityRoundResponses>((resolve) => { resolveSave = resolve }))
    renderPage()
    await loaded()
    await user.click(screen.getByRole('button', { name: 'Player' }))

    const trigger = screen.getByLabelText(/Set Jane Smith's.*afternoon availability/i)
    await user.click(trigger)
    await user.click(await screen.findByRole('menuitem', { name: 'Unavailable' }))

    await waitFor(() => expect(trigger).toHaveAttribute('aria-disabled', 'true'))
    expect(trigger).not.toBeDisabled()
    trigger.focus()
    expect(trigger).toHaveFocus()
    await user.click(trigger)
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument()

    resolveSave(makeResponses())
    await waitFor(() => expect(trigger).toHaveAttribute('aria-disabled', 'false'))
  })

  it('shows the server error when an override fails', async () => {
    const user = userEvent.setup()
    setRoundPlayerStatus.mockRejectedValueOnce(
      new AxiosError('Conflict', 'ERR_BAD_REQUEST', undefined, undefined, {
        status: 409,
        statusText: 'Conflict',
        data: { detail: 'Round is closed.' },
        headers: {},
        config: {} as never,
      }),
    )
    renderPage()
    await loaded()

    await user.click(within(column('Morning', 'Available')).getByLabelText(/Set Jane Smith's.*morning availability/i))
    await user.click(await screen.findByRole('menuitem', { name: 'Unsure' }))

    expect(await screen.findByText('Round is closed.')).toBeInTheDocument()
  })

  it('keeps overrides enabled on a closed poll and notes that changes are manager corrections', async () => {
    const user = userEvent.setup()
    listRounds.mockResolvedValue([makeRound({ open: false })])
    getRoundResponses.mockResolvedValue(makeResponses({ open: false }))
    setRoundPlayerStatus.mockResolvedValue(makeResponses({ open: false }))
    renderPage()
    await loaded()

    expect(screen.getByText('Closed')).toBeInTheDocument()
    expect(screen.getByText('This poll is closed. Changes are recorded as a manager correction.')).toBeInTheDocument()
    const chip = within(column('Morning', 'Available')).getByLabelText(/Set Jane Smith's.*morning availability/i)
    expect(chip).not.toHaveAttribute('aria-disabled', 'true')
    await user.click(chip)
    await user.click(await screen.findByRole('menuitem', { name: 'Unsure' }))
    await waitFor(() => expect(setRoundPlayerStatus).toHaveBeenCalledWith('test-club-id', 'round-1', 'player-1', 'window-1', 'UNSURE'))
  })

  it('keeps the By player chips enabled when the poll is closed', async () => {
    const user = userEvent.setup()
    listRounds.mockResolvedValue([makeRound({ open: false })])
    getRoundResponses.mockResolvedValue(makeResponses({ open: false }))
    renderPage()
    await loaded()
    await user.click(screen.getByRole('button', { name: 'Player' }))

    expect(screen.getByText('This poll is closed. Changes are recorded as a manager correction.')).toBeInTheDocument()
    expect(screen.getByLabelText(/Set Jane Smith's.*afternoon availability/i)).not.toHaveAttribute('aria-disabled', 'true')
  })

  it('opens Edit close time from the header pencil and saves the chosen close time', async () => {
    const user = userEvent.setup()
    updateRoundCloseTime.mockResolvedValue(makeRound())
    renderPage()
    await loaded()

    await user.click(screen.getByRole('button', { name: 'Edit close time' }))
    expect(await screen.findByRole('heading', { name: 'Edit close time' })).toBeInTheDocument()
    await user.click(screen.getByRole('checkbox', { name: 'Autoclose' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(updateRoundCloseTime).toHaveBeenCalledWith('test-club-id', 'round-1', { autoClose: false, scheduledCloseAt: null }),
    )
  })

  it('opens the dialog in Reopen mode on a closed poll', async () => {
    const user = userEvent.setup()
    listRounds.mockResolvedValue([makeRound({ open: false, autoClose: false, scheduledCloseAt: null })])
    getRoundResponses.mockResolvedValue(makeResponses({ open: false }))
    updateRoundCloseTime.mockResolvedValue(makeRound({ autoClose: false, scheduledCloseAt: null }))
    openRound.mockResolvedValue(makeRound({ autoClose: false, scheduledCloseAt: null }))
    renderPage()
    await loaded()

    await user.click(screen.getByRole('button', { name: 'Edit close time' }))
    expect(await screen.findByRole('heading', { name: 'Reopen this poll' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Reopen poll' }))
    await waitFor(() => expect(openRound).toHaveBeenCalledWith('test-club-id', 'round-1'))
  })

  // docs/specs/090: Close poll / Reopen poll in the header.
  describe('close and reopen from the page', () => {
    it('closes an open poll after confirming, then shows it closed with Reopen poll', async () => {
      const user = userEvent.setup()
      closeRound.mockResolvedValue({})
      renderPage()
      await loaded()

      await user.click(screen.getByRole('button', { name: 'Close poll' }))
      expect(await screen.findByRole('dialog', { name: 'Close this poll?' })).toBeInTheDocument()
      expect(closeRound).not.toHaveBeenCalled()

      listRounds.mockResolvedValue([makeRound({ open: false })])
      getRoundResponses.mockResolvedValue(makeResponses({ open: false }))
      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close poll' }))

      await waitFor(() => expect(closeRound).toHaveBeenCalledWith('test-club-id', 'round-1'))
      expect(await screen.findByRole('button', { name: 'Reopen poll' })).toBeEnabled()
      expect(screen.queryByRole('button', { name: 'Close poll' })).not.toBeInTheDocument()
    })

    it('does nothing when the confirmation is cancelled', async () => {
      const user = userEvent.setup()
      renderPage()
      await loaded()

      await user.click(screen.getByRole('button', { name: 'Close poll' }))
      await user.click(await screen.findByRole('button', { name: 'Cancel' }))

      expect(closeRound).not.toHaveBeenCalled()
    })

    it('offers Reopen poll on a closed poll, disabled with the reason when it cannot be reopened', async () => {
      listRounds.mockResolvedValue([makeRound({ open: false, canReopen: false })])
      getRoundResponses.mockResolvedValue(makeResponses({ open: false }))
      renderPage()
      await loaded()

      expect(screen.queryByRole('button', { name: 'Close poll' })).not.toBeInTheDocument()
      const reopen = screen.getByRole('button', { name: 'Reopen poll' })
      expect(reopen).toBeDisabled()
      expect(reopen.closest('span')).toHaveAttribute('title', 'The matches in this poll are in the past')
    })
  })

  it('disables the reopen pencil with the reason on a closed poll that cannot be reopened', async () => {
    listRounds.mockResolvedValue([makeRound({ open: false, canReopen: false })])
    getRoundResponses.mockResolvedValue(makeResponses({ open: false }))
    renderPage()
    await loaded()

    const pencil = screen.getByRole('button', { name: 'The matches in this poll are in the past' })
    expect(pencil).toBeDisabled()
    expect(pencil.parentElement).toHaveAttribute('title', 'The matches in this poll are in the past')
    expect(screen.queryByRole('button', { name: 'Edit close time' })).not.toBeInTheDocument()
  })

  it('keeps the close-time pencil enabled on an open poll even when canReopen is false', async () => {
    listRounds.mockResolvedValue([makeRound({ canReopen: false })])
    renderPage()
    await loaded()

    expect(screen.getByRole('button', { name: 'Edit close time' })).toBeEnabled()
  })

  it('opens the share dialog', async () => {
    const user = userEvent.setup()
    renderPage()
    await loaded()

    await user.click(screen.getByRole('button', { name: /share invite/i }))

    const textarea = (await screen.findByLabelText('Invite text')) as HTMLTextAreaElement
    expect(textarea.value).toContain('/section-availability/round-1')
  })

  it('disables the header Share invite with an explanation on a closed poll', async () => {
    listRounds.mockResolvedValue([makeRound({ open: false })])
    getRoundResponses.mockResolvedValue(makeResponses({ open: false }))
    renderPage()
    await loaded()

    expect(screen.queryByRole('button', { name: 'Share invite' })).not.toBeInTheDocument()
    const share = screen.getByRole('button', { name: 'Share invite is unavailable: this poll is closed' })
    expect(share).toBeDisabled()
    expect(share.parentElement).toHaveAttribute('title', 'Share invite is unavailable: this poll is closed')
    await userEvent.setup({ pointerEventsCheck: 0 }).click(share)
    expect(screen.queryByLabelText('Invite text')).not.toBeInTheDocument()
  })

  it('goes back to the polls list', async () => {
    const user = userEvent.setup()
    renderPage()
    await loaded()

    await user.click(screen.getByRole('link', { name: /back to availability polls/i }))

    expect(await screen.findByText('Polls List')).toBeInTheDocument()
  })

  it('shows a clean not-found state when the round is missing from the list', async () => {
    // Responses resolve; only the list-and-find comes up empty (the !round branch).
    renderPage('test-club-id', 'missing-round')

    expect(await screen.findByText("Couldn't load this poll")).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /back to availability polls/i })).toBeInTheDocument()
  })

  it('shows the same state when the responses fail to load', async () => {
    getRoundResponses.mockRejectedValue(new AxiosError('Not found', 'ERR_BAD_REQUEST'))
    renderPage()

    expect(await screen.findByText("Couldn't load this poll")).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /back to availability polls/i })).toBeInTheDocument()
  })

  it('renders "Not authorized" and fetches nothing without a club', () => {
    renderPage(null)

    expect(screen.getByText('Not authorized')).toBeInTheDocument()
    expect(getRoundResponses).not.toHaveBeenCalled()
  })
})
