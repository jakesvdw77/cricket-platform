import { createRef } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AvailabilityGrid, DATE_ROW_HEIGHT, SCROLL_BOX_MAX_HEIGHT, SLOT_ROW_HEIGHT } from './AvailabilityGrid'
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

  it('renders each player with shirt number, name, cells with accessible names, Answered and Picked', () => {
    renderGrid()

    const anton = screen.getByRole('row', { name: /Anton de Villiers/ })
    expect(within(anton).getByRole('rowheader')).toHaveTextContent('17Anton de Villiers')
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
    expect(box).toHaveStyle({ overflow: 'auto', maxHeight: SCROLL_BOX_MAX_HEIGHT })
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

  it('shows the legend under the grid', () => {
    renderGrid()
    expect(screen.getByRole('list', { name: 'Legend' })).toBeInTheDocument()
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
})
