import { createRef } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AvailabilityGrid, DATE_ROW_HEIGHT, SCROLL_BOX_MIN_HEIGHT, SLOT_ROW_HEIGHT } from './AvailabilityGrid'
import type { AvailabilityGridHandle } from './AvailabilityGrid'
import { at, makeGame, makePlayer } from './testData'

const GROUP_AM = makeGame({ matchId: 'm1', matchDate: at(10, 3, 9), dayPart: 'MORNING', pollType: 'GROUP', pollId: 'round-1', roundId: 'round-1' })
const SQUAD_AM = makeGame({
  matchId: 'm2',
  matchDate: at(10, 3, 10, 30),
  dayPart: 'MORNING',
  label: 'Villagers 2 v Town',
  leagueName: null,
  pollType: 'SQUAD',
  pollId: 'poll-2',
  roundId: null,
})
const NO_POLL_PM = makeGame({
  matchId: 'm3',
  matchDate: at(10, 4, 14),
  dayPart: 'AFTERNOON',
  label: 'Villagers 3 v Rovers',
  sectionId: 'section-9',
  pollType: null,
  pollId: null,
  roundId: null,
})
const GAMES = [GROUP_AM, SQUAD_AM, NO_POLL_PM]

const PLAYERS = [
  makePlayer('p1', 'Anton', 'de Villiers', 17, [['m1', 'AVAILABLE', true], ['m2', 'UNSURE'], ['m3', 'NOT_IN_POLL']]),
  makePlayer('p2', 'Bob', 'Jones', null, [['m1', 'UNAVAILABLE'], ['m2', 'NO_RESPONSE'], ['m3', 'NOT_IN_POLL']]),
  makePlayer('p3', 'Amy', 'Lee', 4, [['m1', 'AVAILABLE'], ['m2', 'NOT_IN_POLL', true], ['m3', 'NOT_IN_POLL']]),
]

function Where() {
  const location = useLocation()
  return <div data-testid="where">{location.pathname + location.search}</div>
}

function renderGrid(props: Partial<React.ComponentProps<typeof AvailabilityGrid>> = {}, ref?: React.Ref<AvailabilityGridHandle>) {
  return render(
    <MemoryRouter initialEntries={['/grid']}>
      <Routes>
        <Route path="/grid" element={<AvailabilityGrid ref={ref} games={GAMES} players={PLAYERS} now={new Date(2026, 9, 2, 12)} {...props} />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('AvailabilityGrid', () => {
  it('groups the header date, then slot, then game, omitting empty slots', () => {
    renderGrid()
    const table = screen.getByRole('table', { name: 'Player availability by game' })

    const dates = within(table).getAllByRole('columnheader').filter((header) => header.getAttribute('scope') === 'colgroup')
    // Date row first (Sat 3 Oct over 2 games, Sun 4 Oct over 1), then the slot row: Sunday has no
    // Morning game, so there is no Morning slot for it at all.
    expect(dates.map((header) => header.textContent)).toEqual(['Sat 3 OctTomorrow', 'Sun 4 Oct', 'MorningAM', 'AfternoonPM'])
    expect(dates.map((header) => header.getAttribute('colspan'))).toEqual(['2', '1', '2', '1'])
    expect(within(table).getAllByRole('columnheader', { name: 'Morning' })).toHaveLength(1)
    expect(within(table).getAllByRole('columnheader', { name: 'Afternoon' })).toHaveLength(1)
    // Third header row: one column per game.
    expect(within(table).getAllByRole('columnheader', { name: /Villagers/ })).toHaveLength(3)
  })

  it('shows label, kickoff and league on each game header', () => {
    renderGrid()

    const header = screen.getByRole('link', { name: 'Villagers 1 v CBC: open poll' }).closest('th') as HTMLElement
    expect(within(header).getByText('09:00')).toBeInTheDocument()
    expect(within(header).getByText('Premier League')).toBeInTheDocument()
    const second = screen.getByRole('link', { name: 'Villagers 2 v Town: open poll' }).closest('th') as HTMLElement
    expect(within(second).getByText('10:30')).toBeInTheDocument()
  })

  it('renders each player with name only (no shirt number), cells with accessible names, Answered and Picked', () => {
    renderGrid()

    const anton = screen.getByRole('row', { name: /Anton de Villiers/ })
    expect(within(anton).getByRole('rowheader')).toHaveTextContent(/^Anton de Villiers$/)
    expect(within(anton).getByRole('img', { name: 'Anton de Villiers, Sat 3 Oct Morning, Villagers 1 v CBC: Available, group poll, picked' })).toBeInTheDocument()
    expect(within(anton).getByRole('img', { name: 'Anton de Villiers, Sat 3 Oct Morning, Villagers 2 v Town: Unsure, squad poll' })).toBeInTheDocument()
    expect(within(anton).getByRole('img', { name: /Sun 4 Oct Afternoon, Villagers 3 v Rovers: Not in this poll, no poll$/ })).toBeInTheDocument()
    // Answered (2 of 3 cells) and Picked (1), as plain numbers in the last two cells.
    const cells = within(anton).getAllByRole('cell')
    expect(cells.slice(-2).map((cell) => cell.textContent)).toEqual(['2', '1'])

    const amy = screen.getByRole('row', { name: /Amy Lee/ })
    expect(within(amy).getAllByRole('cell').slice(-2).map((cell) => cell.textContent)).toEqual(['1', '1'])
    expect(screen.getByRole('columnheader', { name: 'Answered' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Picked' })).toBeInTheDocument()
  })

  it('keeps the server row order and sizes the sticky name column to its content', () => {
    renderGrid()

    const names = screen.getAllByRole('rowheader').map((header) => header.textContent)
    expect(names.slice(0, 3)).toEqual(['Anton de Villiers', 'Bob Jones', 'Amy Lee'])
    for (const header of [screen.getByRole('columnheader', { name: 'Player' }), screen.getByRole('rowheader', { name: 'Anton de Villiers' })]) {
      expect(header).toHaveStyle({ width: 'max-content', maxWidth: '320px', position: 'sticky', left: '0px' })
    }
    expect(screen.getByText('Anton de Villiers')).not.toHaveStyle({ textOverflow: 'ellipsis' })
  })

  it('stripes alternate player rows with an opaque tint, first body row tinted, including the sticky name cell', () => {
    renderGrid()

    const first = screen.getByRole('rowheader', { name: 'Anton de Villiers' })
    const second = screen.getByRole('rowheader', { name: 'Bob Jones' })
    const third = screen.getByRole('rowheader', { name: 'Amy Lee' })
    const firstCell = screen.getByTestId('cell-p1-m1')
    const background = (element: HTMLElement) => getComputedStyle(element).backgroundColor
    const solid = (color: string) => /^rgb\(/.test(color)
    expect(solid(background(first))).toBe(true)
    expect(solid(background(second))).toBe(true)
    expect(background(first)).not.toBe(background(second))
    expect(background(third)).toBe(background(first))
    expect(background(firstCell)).toBe(background(first))
  })

  it('totals Available / Unsure / Unavailable per game in the footer, from the rows given', () => {
    const { unmount } = renderGrid()
    expect(screen.getByLabelText('2 available, 0 unsure, 1 unavailable')).toHaveTextContent('2 / 0 / 1')
    expect(screen.getByLabelText('0 available, 1 unsure, 0 unavailable')).toHaveTextContent('0 / 1 / 0')
    expect(screen.getByLabelText('0 available, 0 unsure, 0 unavailable')).toHaveTextContent('0 / 0 / 0')
    unmount()

    renderGrid({ players: [PLAYERS[1]] })
    expect(screen.getByLabelText('0 available, 0 unsure, 1 unavailable')).toHaveTextContent('0 / 0 / 1')
  })

  it('has its own scroll box with sticky first column, sticky header rows and a sticky footer', () => {
    renderGrid()

    const box = screen.getByRole('region', { name: /player availability grid/i })
    expect(box).toHaveStyle({ overflow: 'auto', minHeight: `${SCROLL_BOX_MIN_HEIGHT}px`, overscrollBehavior: 'contain' })
    expect(box).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('table')).toHaveStyle({ borderCollapse: 'separate' })

    expect(screen.getByRole('columnheader', { name: 'Player' })).toHaveStyle({ position: 'sticky', left: '0px', top: '0px' })
    expect(screen.getByRole('rowheader', { name: /Anton de Villiers/ })).toHaveStyle({ position: 'sticky', left: '0px' })
    expect(screen.getByRole('link', { name: 'Villagers 1 v CBC: open poll' }).closest('th')).toHaveStyle({ position: 'sticky' })
    expect(screen.getByRole('columnheader', { name: 'Answered' })).toHaveStyle({ position: 'sticky', top: '0px' })
    expect(screen.getByRole('rowheader', { name: 'Available / Unsure / Unavailable' })).toHaveStyle({ position: 'sticky', bottom: '0px' })
  })

  it('pins the date and slot header heights and offsets each sticky row by the exact sum above it', () => {
    renderGrid()

    const dateCell = screen.getByRole('columnheader', { name: /Sat 3 Oct/ })
    const slotCell = screen.getByRole('columnheader', { name: 'Morning' })
    const gameCell = screen.getByRole('link', { name: 'Villagers 1 v CBC: open poll' }).closest('th') as HTMLElement

    expect(dateCell).toHaveStyle({ top: '0px', height: `${DATE_ROW_HEIGHT}px`, maxHeight: `${DATE_ROW_HEIGHT}px`, boxSizing: 'border-box' })
    expect(slotCell).toHaveStyle({ top: `${DATE_ROW_HEIGHT}px`, height: `${SLOT_ROW_HEIGHT}px`, maxHeight: `${SLOT_ROW_HEIGHT}px`, boxSizing: 'border-box' })
    expect(gameCell).toHaveStyle({ top: `${DATE_ROW_HEIGHT + SLOT_ROW_HEIGHT}px` })
  })

  it('never puts a literal null in the Open a poll link when the game has no section', () => {
    renderGrid({ games: [GROUP_AM, makeGame({ ...NO_POLL_PM, sectionId: null, teamId: null })] })

    expect(screen.getByRole('link', { name: 'Open a poll for Villagers 3 v Rovers' })).toHaveAttribute(
      'href',
      '/manage/availability/new?type=group&matchId=m3',
    )
  })

  it('links a group game header to its round, a squad game to its poll, and offers Open a poll when there is none', () => {
    renderGrid()

    expect(screen.getByRole('link', { name: 'Villagers 1 v CBC: open poll' })).toHaveAttribute('href', '/manage/availability/group/round-1')
    expect(screen.getByRole('link', { name: 'Villagers 2 v Town: open poll' })).toHaveAttribute('href', '/manage/availability/squad/m2/poll-2')
    expect(screen.getByRole('link', { name: 'Open a poll for Villagers 3 v Rovers' })).toHaveAttribute(
      'href',
      '/manage/availability/new?type=group&sectionId=section-9&matchId=m3',
    )
  })

  it('opens the poll when a cell is clicked, and does nothing for a game without one', async () => {
    const user = userEvent.setup()
    renderGrid()

    await user.click(screen.getByTestId('cell-p1-m2'))
    expect(screen.getByTestId('where')).toHaveTextContent('/manage/availability/squad/m2/poll-2')
  })

  it('does not navigate from a no-poll cell', async () => {
    const user = userEvent.setup()
    renderGrid()

    await user.click(screen.getByTestId('cell-p1-m3'))
    expect(screen.queryByTestId('where')).not.toBeInTheDocument()
    expect(screen.getByRole('table')).toBeInTheDocument()
  })

  it('keeps cells out of the tab order; only header links are focusable', async () => {
    const user = userEvent.setup()
    renderGrid()
    const table = screen.getByRole('table')

    expect(within(table).queryAllByRole('img').every((mark) => !mark.hasAttribute('tabindex'))).toBe(true)
    await user.tab() // the scroll region
    await user.tab()
    expect(screen.getByRole('link', { name: 'Villagers 1 v CBC: open poll' })).toHaveFocus()
  })

  it('scrolls a game header into view on request, tolerating a missing scrollIntoView', () => {
    const ref = createRef<AvailabilityGridHandle>()
    renderGrid({}, ref)
    expect(() => ref.current?.scrollToGame('m2')).not.toThrow()

    const scroll = vi.fn()
    const target = screen.getByRole('link', { name: 'Villagers 2 v Town: open poll' }).closest('th') as HTMLElement
    target.scrollIntoView = scroll
    ref.current?.scrollToGame('m2')
    expect(scroll).toHaveBeenCalledWith({ behavior: 'smooth', inline: 'start', block: 'nearest' })
  })

  it('shows a message row when no players are left', () => {
    renderGrid({ players: [] })
    expect(screen.getByText('No players to show.')).toBeInTheDocument()
  })

  it('shows the legend above the grid (085)', () => {
    renderGrid()

    const legend = screen.getByRole('list', { name: 'Legend' })
    const box = screen.getByRole('region', { name: /player availability grid/i })
    expect(legend.compareDocumentPosition(box) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(legend.compareDocumentPosition(screen.getByRole('table')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('sizes the scroll box to the window from its measured top (085)', () => {
    Object.defineProperty(window, 'innerHeight', { value: 720, configurable: true })
    const spy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      return { top: this.getAttribute('role') === 'region' ? 300 : 0, height: 0, width: 100 } as DOMRect
    })
    renderGrid()

    // 720 - 300 - 24 bottom padding.
    expect(screen.getByRole('region', { name: /player availability grid/i })).toHaveStyle({ height: '396px' })
    spy.mockRestore()
  })

  it('says so when no games match', () => {
    renderGrid({ games: [], players: [] })
    expect(screen.getByText('No games match these filters')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('says so, with a link to Availability Polls, when no game has a poll', () => {
    renderGrid({ games: [NO_POLL_PM], players: [] })
    expect(screen.getByText('No polls opened yet for these games')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to Availability Polls' })).toHaveAttribute('href', '/manage/availability')
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  describe('changing an answer (085 F)', () => {
    const handlers = () => ({ pendingKey: null as string | null, onChange: vi.fn().mockResolvedValue(true) })

    it('a cell with a poll is a button named by its cell label that opens the answer menu instead of navigating', async () => {
      const user = userEvent.setup()
      renderGrid({ changeAnswer: handlers() })

      const cell = screen.getByRole('button', { name: /^Anton de Villiers, Sat 3 Oct Morning, Villagers 1 v CBC: Available, group poll, picked$/ })
      expect(cell).toHaveAttribute('aria-haspopup', 'menu')
      expect(cell).toHaveAttribute('aria-expanded', 'false')
      await user.click(cell)

      expect(cell).toHaveAttribute('aria-expanded', 'true')
      expect(screen.getByText(/^Anton de Villiers, Sat 3 Oct 09:00, Villagers 1 v CBC$/)).toBeInTheDocument()
      expect(screen.getByRole('menuitem', { name: 'Available' })).toHaveClass('Mui-selected')
      expect(screen.getByRole('menuitem', { name: 'Unsure' })).toBeInTheDocument()
      expect(screen.getByRole('menuitem', { name: 'Unavailable' })).toBeInTheDocument()
      expect(screen.getByRole('menuitem', { name: 'Open poll' })).toBeInTheDocument()
      expect(screen.queryByTestId('where')).not.toBeInTheDocument()
    })

    it('does not make cells outside a game poll clickable', () => {
      renderGrid({ changeAnswer: handlers() })

      // The m3 game has no poll: its cells are plain marks, and so is the NOT_IN_POLL cell of m2 for Amy.
      expect(screen.getByTestId('cell-p1-m3').querySelector('button')).toBeNull()
      expect(screen.getByTestId('cell-p3-m2').querySelector('button')).toBeNull()
    })

    it('choosing an answer hands the player, game and status to the handler', async () => {
      const user = userEvent.setup()
      const change = handlers()
      renderGrid({ changeAnswer: change })

      await user.click(screen.getByTestId('cell-p2-m2').querySelector('button') as HTMLElement)
      await user.click(screen.getByRole('menuitem', { name: 'Available' }))

      expect(change.onChange).toHaveBeenCalledTimes(1)
      const [player, game, status] = change.onChange.mock.calls[0]
      expect([player.playerProfileId, game.matchId, status]).toEqual(['p2', 'm2', 'AVAILABLE'])
    })

    it('"Open poll" navigates to the poll', async () => {
      const user = userEvent.setup()
      renderGrid({ changeAnswer: handlers() })

      await user.click(screen.getByTestId('cell-p1-m1').querySelector('button') as HTMLElement)
      await user.click(screen.getByRole('menuitem', { name: 'Open poll' }))

      expect(screen.getByTestId('where')).toHaveTextContent('/manage/availability/group/round-1')
    })

    it('disables only the cell whose own save is running', async () => {
      const user = userEvent.setup()
      const change = { ...handlers(), pendingKey: 'p1:m1' }
      renderGrid({ changeAnswer: change })

      const busy = screen.getByTestId('cell-p1-m1').querySelector('button') as HTMLElement
      expect(busy).toHaveAttribute('aria-disabled', 'true')
      await user.click(busy)
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
      expect(screen.getByTestId('cell-p2-m1').querySelector('button')).toHaveAttribute('aria-disabled', 'false')
    })
  })
})
