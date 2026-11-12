import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import api from '../../../api/axiosConfig'
import type { MyMatchListDto } from '../../../api/myPlayersApi'
import { HubCalendar } from './HubCalendar'
import { httpError, newQueryClient, routeApi } from '../../../test/accountTestUtils'
import type { ApiMock } from '../../../test/accountTestUtils'
import { matchList, summary } from '../../../test/hubMatchFixtures'

vi.mock('../../../api/axiosConfig', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }))

// Schedule > Calendar: a Monday-first month grid with a dot per match, the tapped day's games listed under it.
// Only Date is faked so promises and timers still run. 12 Nov 2026 is a Thursday; 1 Nov 2026 is a Sunday.
const http = api as unknown as ApiMock

const day = (iso: string) => screen.getByTestId(`calendar-day-${iso}`)

function renderCalendar(data: MyMatchListDto | Error) {
  routeApi(http, { 'GET /me/players/k1/matches': data })
  return render(
    <QueryClientProvider client={newQueryClient()}>
      <MemoryRouter>
        <HubCalendar playerKey="k1" playerName="Sam" />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 12, 10, 0, 0))
})
afterEach(() => vi.useRealTimers())

describe('HubCalendar', () => {
  it('shows the current month with Monday first and today\'s games listed', async () => {
    renderCalendar(matchList({ upcoming: [summary({ matchId: 'a', date: '2026-11-12', home: { name: 'Riverside U15 A' }, away: { name: 'Coastal U15' } })] }))

    expect(await screen.findByTestId('calendar-month')).toHaveTextContent('November 2026')
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])
    // 1 Nov is a Sunday: six blank cells, then the 1st is the 7th column.
    const cells = within(screen.getByRole('grid')).getAllByRole('gridcell')
    expect(cells.slice(0, 6).every((c) => c.textContent === '')).toBe(true)
    expect(cells[6]).toBe(day('2026-11-01'))
    expect(cells).toHaveLength(42)
    expect(day('2026-11-12')).toHaveAttribute('aria-pressed', 'true')
    expect(await screen.findByTestId('hub-match-row')).toHaveTextContent('Riverside U15 A')
  })

  it('draws a dot per game, gold for the player\'s own and sand for the rest, and names the count for a screen reader', async () => {
    renderCalendar(matchList({ upcoming: [
      summary({ matchId: 'a', date: '2026-11-20', mine: true }),
      summary({ matchId: 'b', date: '2026-11-20', mine: false }),
      summary({ matchId: 'c', date: '2026-11-21', mine: false }),
    ] }))

    await screen.findByTestId('calendar-month')
    expect(await screen.findByRole('gridcell', { name: /Friday, 20 November 2026, 2 matches/ })).toBe(day('2026-11-20'))
    expect(day('2026-11-21')).toHaveAccessibleName(/1 match$/)
    expect(day('2026-11-13')).toHaveAccessibleName(/no matches$/)
    const dots = (iso: string) => Array.from(day(iso).querySelectorAll('[aria-hidden="true"] > div'))
    expect(dots('2026-11-20')).toHaveLength(2)
    expect(dots('2026-11-21')).toHaveLength(1)
    expect(dots('2026-11-13')).toHaveLength(0)
    const colours = dots('2026-11-20').map((dot) => getComputedStyle(dot).backgroundColor)
    expect(colours[0]).not.toBe(colours[1])
    expect(getComputedStyle(dots('2026-11-21')[0]).backgroundColor).toBe(colours[1])
  })

  it('lists the games of a tapped day, and says so for a day with none', async () => {
    renderCalendar(matchList({ upcoming: [summary({ matchId: 'a', date: '2026-11-20', home: { name: 'Hillside U15' } })] }))
    await screen.findByTestId('calendar-month')

    await userEvent.click(day('2026-11-20'))
    expect(within(screen.getByTestId('calendar-day-list')).getByRole('heading', { name: 'Friday, 20 November 2026' })).toBeInTheDocument()
    expect(await screen.findByTestId('hub-match-row')).toHaveTextContent('Hillside U15')

    await userEvent.click(day('2026-11-14'))
    expect(screen.getByText('No matches on this day.')).toBeInTheDocument()
    expect(screen.queryByTestId('hub-match-row')).not.toBeInTheDocument()
  })

  it('moves a month either way, and Today returns to this month and day', async () => {
    renderCalendar(matchList())
    await screen.findByTestId('calendar-month')

    await userEvent.click(screen.getByRole('button', { name: 'Next month' }))
    expect(screen.getByTestId('calendar-month')).toHaveTextContent('December 2026')
    await userEvent.click(screen.getByRole('button', { name: 'Next month' }))
    expect(screen.getByTestId('calendar-month')).toHaveTextContent('January 2027')
    await userEvent.click(screen.getByRole('button', { name: 'Previous month' }))
    await userEvent.click(screen.getByRole('button', { name: 'Previous month' }))
    await userEvent.click(screen.getByRole('button', { name: 'Previous month' }))
    expect(screen.getByTestId('calendar-month')).toHaveTextContent('October 2026')

    await userEvent.click(screen.getByRole('button', { name: 'Today' }))
    expect(screen.getByTestId('calendar-month')).toHaveTextContent('November 2026')
    expect(day('2026-11-12')).toHaveAttribute('aria-pressed', 'true')
  })

  it('includes live and recent games, not only upcoming', async () => {
    renderCalendar(matchList({
      live: [summary({ matchId: 'l', phase: 'LIVE', date: '2026-11-12' })],
      recent: [summary({ matchId: 'r', phase: 'RECENT', date: '2026-11-07', result: null })],
    }))
    await screen.findByTestId('calendar-month')

    expect(day('2026-11-07')).toHaveAccessibleName(/1 match$/)
    expect(day('2026-11-12')).toHaveAccessibleName(/1 match$/)
  })

  it('shows a loading state while the matches load', () => {
    routeApi(http, { 'GET /me/players/k1/matches': matchList() })
    http.get.mockImplementation(() => new Promise(() => undefined))
    render(
      <QueryClientProvider client={newQueryClient()}>
        <MemoryRouter><HubCalendar playerKey="k1" playerName="Sam" /></MemoryRouter>
      </QueryClientProvider>,
    )

    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull()
    expect(screen.queryByRole('grid')).not.toBeInTheDocument()
  })

  it('shows an error with Retry that loads the calendar', async () => {
    let fail = true
    renderCalendar((() => (fail ? httpError(500) : matchList())) as never)

    expect(await screen.findByText('We could not load the calendar. Please try again.')).toBeInTheDocument()
    expect(screen.queryByRole('grid')).not.toBeInTheDocument()
    fail = false
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByRole('grid')).toBeInTheDocument()
  })
})
