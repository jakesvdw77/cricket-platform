import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SeasonList from './SeasonList'
import type { Season, SeasonsSummary } from '../../api/seasonApi'

const listSeasons = vi.fn()
const getSeasonsSummary = vi.fn()

vi.mock('../../api/seasonApi', () => ({
  listSeasons: (clubId: string) => listSeasons(clubId),
  getSeasonsSummary: (clubId: string) => getSeasonsSummary(clubId),
  seasonsSummaryKey: (clubId: string) => ['managed-club', clubId, 'seasons', 'summary'],
  deactivateSeason: vi.fn(),
  reactivateSeason: vi.fn(),
}))

// Today is 10 October 2026 for the whole suite (only Date is faked, so timers and user events still run).
const NOW = new Date(2026, 9, 10, 12, 0, 0)

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  getSeasonsSummary.mockResolvedValue({ seasons: [] } satisfies SeasonsSummary)
})

afterEach(() => vi.useRealTimers())

function makeSeason(overrides: Partial<Season> = {}): Season {
  return {
    id: 'season-1',
    clubId: 'test-club-id',
    label: '2026/27',
    startDate: '2026-09-01',
    endDate: '2027-03-31',
    active: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: null,
    ...overrides,
  }
}

const CURRENT = makeSeason({ id: 'cur', label: '2026/27' })
const UPCOMING = makeSeason({ id: 'up', label: '2027/28', startDate: '2027-09-01', endDate: '2028-03-31' })
const PAST = makeSeason({ id: 'past', label: '2025/26', startDate: '2025-09-01', endDate: '2026-03-31' })
const INACTIVE = makeSeason({ id: 'off', label: 'Trial', startDate: '2026-01-01', endDate: '2026-06-30', active: false })
const ALL = [CURRENT, UPCOMING, PAST, INACTIVE]

function OutletContextWrapper({ clubId }: { clubId?: string }) {
  return <Outlet context={{ clubId }} />
}

function renderList(clubId?: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const result = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/manage/fixtures/seasons']}>
        <Routes>
          <Route path="/manage/fixtures" element={<OutletContextWrapper clubId={clubId} />}>
            <Route path="seasons" element={<SeasonList />} />
            <Route path="seasons/new" element={<div>Add Season Page</div>} />
            <Route path="seasons/:id" element={<div>Season Page</div>} />
            <Route path="seasons/:id/edit" element={<div>Edit Season Page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return { ...result, queryClient }
}

function headings(): string[] {
  return screen.getAllByRole('heading', { level: 3 }).map((el) => el.textContent ?? '')
}

function counter(id: string) {
  return screen.getByTestId(`page-counter-${id}`)
}

describe('SeasonList', () => {
  describe('page states', () => {
    it('renders "Not authorized" and does not fetch when no clubId is in the Outlet context', () => {
      renderList(undefined)

      expect(screen.getByText('Not authorized')).toBeInTheDocument()
      expect(listSeasons).not.toHaveBeenCalled()
    })

    it('renders nothing while the list is loading', () => {
      listSeasons.mockReturnValueOnce(new Promise(() => {}))

      renderList('test-club-id')

      expect(screen.queryByText('No seasons yet')).not.toBeInTheDocument()
      expect(screen.queryByText('Not authorized')).not.toBeInTheDocument()
    })

    it('renders an error state, with no counters, when the season list fails', async () => {
      listSeasons.mockRejectedValueOnce(new Error('network error'))

      renderList('test-club-id')

      expect(await screen.findByText("Couldn't load seasons")).toBeInTheDocument()
      expect(screen.queryByTestId('page-counter-current')).not.toBeInTheDocument()
    })

    it('has no back link and a filled Add Season button that opens the create route', async () => {
      const user = userEvent.setup()
      listSeasons.mockResolvedValue([CURRENT])

      renderList('test-club-id')

      await screen.findAllByRole('heading', { level: 3 })
      expect(screen.queryByRole('link', { name: /back to/i })).not.toBeInTheDocument()
      const add = screen.getByRole('button', { name: 'Add Season' })
      expect(add.className).toContain('MuiButton-contained')
      await user.click(add)
      expect(await screen.findByText('Add Season Page')).toBeInTheDocument()
    })

    it('has no Season pill', async () => {
      listSeasons.mockResolvedValue([CURRENT])
      renderList('test-club-id')
      await screen.findAllByRole('heading', { level: 3 })
      expect(screen.queryByRole('button', { name: /season:/i })).not.toBeInTheDocument()
    })
  })

  describe('counters', () => {
    beforeEach(() => listSeasons.mockResolvedValue(ALL))

    it('shows Current as the current season label, and Upcoming, Past and Inactive as counts', async () => {
      renderList('test-club-id')

      await screen.findAllByRole('heading', { level: 3 })
      expect(within(counter('current')).getByTestId('page-counter-value')).toHaveTextContent('2026/27')
      expect(within(counter('upcoming')).getByTestId('page-counter-value')).toHaveTextContent('1')
      expect(within(counter('past')).getByTestId('page-counter-value')).toHaveTextContent('1')
      expect(within(counter('inactive')).getByTestId('page-counter-value')).toHaveTextContent('1')
    })

    it('shows None for Current when no season is current, as a plain card', async () => {
      listSeasons.mockResolvedValue([PAST])
      renderList('test-club-id')

      await screen.findByText('2025/26')
      expect(within(counter('current')).getByTestId('page-counter-value')).toHaveTextContent('None')
      expect(counter('current').tagName).not.toBe('BUTTON')
      // A zero counter is a plain card too.
      expect(counter('upcoming').tagName).not.toBe('BUTTON')
      expect(counter('inactive').tagName).not.toBe('BUTTON')
    })

    it('counts two seasons containing today as two current and names the first with a +1', async () => {
      listSeasons.mockResolvedValue([makeSeason({ id: 'a', label: '2026' , startDate: '2026-01-01', endDate: '2026-12-31' }), CURRENT])
      renderList('test-club-id')

      await screen.findAllByRole('heading', { level: 3 })
      expect(within(counter('current')).getByTestId('page-counter-value')).toHaveTextContent('2026 +1')
      await userEvent.setup().click(counter('current'))
      expect(headings()).toEqual(['2026/27', '2026'])
    })

    it('filters the list by clicking a counter, and clicking the active one clears it', async () => {
      const user = userEvent.setup()
      renderList('test-club-id')
      await screen.findAllByRole('heading', { level: 3 })
      expect(headings()).toEqual(['2027/28', '2026/27', '2025/26'])

      await user.click(counter('upcoming'))
      expect(headings()).toEqual(['2027/28'])
      expect(counter('upcoming')).toHaveAttribute('aria-pressed', 'true')
      expect(screen.getByText(/Showing 1 season · Upcoming/)).toBeInTheDocument()

      await user.click(counter('upcoming'))
      expect(headings()).toEqual(['2027/28', '2026/27', '2025/26'])
    })

    it('keeps the quick filters mutually exclusive', async () => {
      const user = userEvent.setup()
      renderList('test-club-id')
      await screen.findAllByRole('heading', { level: 3 })

      await user.click(counter('past'))
      expect(headings()).toEqual(['2025/26'])
      await user.click(counter('current'))
      expect(headings()).toEqual(['2026/27'])
      expect(counter('current')).toHaveAttribute('aria-pressed', 'true')
      expect(counter('past')).toHaveAttribute('aria-pressed', 'false')
    })

    it('shows inactive seasons for the Inactive filter even with Show inactive off', async () => {
      const user = userEvent.setup()
      renderList('test-club-id')
      await screen.findAllByRole('heading', { level: 3 })

      await user.click(counter('inactive'))
      expect(headings()).toEqual(['Trial'])
    })

    it('ignores the search and Show inactive', async () => {
      const user = userEvent.setup()
      renderList('test-club-id')
      await screen.findAllByRole('heading', { level: 3 })

      fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'zzz' } })
      await user.click(screen.getAllByRole('checkbox', { name: 'Show inactive' })[0])

      expect(within(counter('current')).getByTestId('page-counter-value')).toHaveTextContent('2026/27')
      expect(within(counter('upcoming')).getByTestId('page-counter-value')).toHaveTextContent('1')
      expect(within(counter('inactive')).getByTestId('page-counter-value')).toHaveTextContent('1')
    })
  })

  describe('Show inactive', () => {
    it('hides inactive seasons by default and shows them with the switch, with an Inactive badge', async () => {
      const user = userEvent.setup()
      listSeasons.mockResolvedValue(ALL)
      renderList('test-club-id')

      await screen.findAllByRole('heading', { level: 3 })
      expect(screen.queryByText('Trial')).not.toBeInTheDocument()

      await user.click(screen.getAllByRole('checkbox', { name: 'Show inactive' })[0])
      expect(headings()).toEqual(['2027/28', '2026/27', 'Trial', '2025/26'])
      expect(screen.getByText('Inactive', { selector: '.MuiChip-label' })).toBeInTheDocument()
    })
  })

  describe('cards', () => {
    it('renders one status badge per season and the figures from the summary, "-" while it loads', async () => {
      listSeasons.mockResolvedValue([CURRENT])
      getSeasonsSummary.mockReturnValue(new Promise(() => {}))
      renderList('test-club-id')

      await screen.findAllByRole('heading', { level: 3 })
      expect(screen.getByTestId('season-leagues')).toHaveTextContent('-Leagues')
    })

    it('fills the figures when the summary arrives, and uses 0 for a season with no entry', async () => {
      listSeasons.mockResolvedValue([CURRENT, UPCOMING])
      getSeasonsSummary.mockResolvedValue({ seasons: [{ seasonId: 'cur', leagueCount: 2, teamsEntered: 5, matchCount: 48 }] })
      renderList('test-club-id')

      await screen.findAllByRole('heading', { level: 3 })
      await waitFor(() => expect(screen.getAllByTestId('season-leagues')[1]).toHaveTextContent('2Leagues'))
      const [upcoming, current] = screen.getAllByTestId('season-matches')
      expect(current).toHaveTextContent('48Matches')
      expect(upcoming).toHaveTextContent('0Matches')
    })

    it('shows dashes, and keeps the counters and list, when the summary fails', async () => {
      listSeasons.mockResolvedValue([CURRENT])
      getSeasonsSummary.mockRejectedValue(new Error('boom'))
      renderList('test-club-id')

      await screen.findAllByRole('heading', { level: 3 })
      await waitFor(() => expect(getSeasonsSummary).toHaveBeenCalled())
      expect(screen.getByTestId('season-leagues')).toHaveTextContent('-Leagues')
      expect(counter('current')).toBeInTheDocument()
    })

    it('opens the season from the whole card and Edit from the footer', async () => {
      const user = userEvent.setup()
      listSeasons.mockResolvedValue([CURRENT])
      renderList('test-club-id')

      await screen.findAllByRole('heading', { level: 3 })
      expect(screen.getByRole('link', { name: '2026/27' })).toHaveAttribute('href', '/manage/fixtures/seasons/cur')
      await user.click(screen.getByRole('button', { name: 'Edit' }))
      expect(await screen.findByText('Edit Season Page')).toBeInTheDocument()
    })

    it('never renders a Deactivate or Reactivate button (it lives on the edit screen)', async () => {
      listSeasons.mockResolvedValue(ALL)
      renderList('test-club-id')

      await screen.findAllByRole('heading', { level: 3 })
      expect(screen.queryByRole('button', { name: 'Deactivate' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Reactivate' })).not.toBeInTheDocument()
    })
  })

  describe('search and sort', () => {
    it('filters by label, client-side, and shows the scope count', async () => {
      listSeasons.mockResolvedValue(ALL)
      renderList('test-club-id')

      await screen.findAllByRole('heading', { level: 3 })
      fireEvent.change(screen.getByLabelText('Search'), { target: { value: '2025' } })

      expect(headings()).toEqual(['2025/26'])
      expect(screen.getByText(/Showing 1 season\b/)).toBeInTheDocument()
    })

    it('sorts newest first by default, then oldest first and by name from the sort menu', async () => {
      const user = userEvent.setup()
      listSeasons.mockResolvedValue([UPCOMING, PAST, CURRENT])
      renderList('test-club-id')

      await screen.findAllByRole('heading', { level: 3 })
      expect(headings()).toEqual(['2027/28', '2026/27', '2025/26'])

      await user.click(screen.getByRole('button', { name: /newest first/i }))
      await user.click(screen.getByRole('menuitem', { name: 'Oldest first' }))
      expect(headings()).toEqual(['2025/26', '2026/27', '2027/28'])

      await user.click(screen.getByRole('button', { name: /oldest first/i }))
      await user.click(screen.getByRole('menuitem', { name: 'Name, A to Z' }))
      expect(headings()).toEqual(['2025/26', '2026/27', '2027/28'])
    })
  })

  describe('list view', () => {
    it('shows cards by default, switches to the table and back, and remembers the choice', async () => {
      const user = userEvent.setup()
      listSeasons.mockResolvedValue([CURRENT])

      const { unmount } = renderList('test-club-id')

      await screen.findAllByRole('heading', { level: 3 })
      expect(screen.queryByRole('table', { name: 'Seasons' })).not.toBeInTheDocument()

      await user.click(screen.getAllByRole('button', { name: 'List' })[0])
      const table = await screen.findByRole('table', { name: 'Seasons' })
      expect(within(table).getByRole('link', { name: '2026/27' })).toHaveAttribute('href', '/manage/fixtures/seasons/cur')
      expect(localStorage.getItem('seasonList:view')).toBe('list')
      unmount()

      renderList('test-club-id')
      expect(await screen.findByRole('table', { name: 'Seasons' })).toBeInTheDocument()

      await user.click(screen.getAllByRole('button', { name: 'Cards' })[0])
      await waitFor(() => expect(screen.queryByRole('table', { name: 'Seasons' })).not.toBeInTheDocument())
    })

    it('keeps the counters and filters in the table view', async () => {
      const user = userEvent.setup()
      localStorage.setItem('seasonList:view', 'list')
      listSeasons.mockResolvedValue(ALL)
      renderList('test-club-id')

      await screen.findByRole('table', { name: 'Seasons' })
      await user.click(counter('past'))
      expect(screen.getAllByTestId('season-row')).toHaveLength(1)
      expect(screen.getByTestId('season-row-status')).toHaveTextContent('Past')
    })

    it('opens the season from the whole row', async () => {
      localStorage.setItem('seasonList:view', 'list')
      listSeasons.mockResolvedValue([UPCOMING])
      renderList('test-club-id')

      const table = await screen.findByRole('table', { name: 'Seasons' })
      expect(within(table).getByRole('link', { name: '2027/28' })).toHaveAttribute('href', '/manage/fixtures/seasons/up')
    })
  })

  describe('empty states', () => {
    it('shows "No seasons yet" with an Add Season button when the club has none', async () => {
      const user = userEvent.setup()
      listSeasons.mockResolvedValue([])
      renderList('test-club-id')

      expect(await screen.findByText('No seasons yet')).toBeInTheDocument()
      expect(screen.getByText("Create your club's first season to get started.")).toBeInTheDocument()
      const buttons = screen.getAllByRole('button', { name: 'Add Season' })
      expect(buttons).toHaveLength(2)
      await user.click(buttons[1])
      expect(await screen.findByText('Add Season Page')).toBeInTheDocument()
    })

    it('shows "No matching seasons" for a search with no result', async () => {
      listSeasons.mockResolvedValue(ALL)
      renderList('test-club-id')

      await screen.findAllByRole('heading', { level: 3 })
      fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'zzz' } })

      expect(await screen.findByText('No matching seasons')).toBeInTheDocument()
      expect(screen.getByText('No seasons match "zzz". Try a different search.')).toBeInTheDocument()
    })

    it('shows "No inactive seasons" when the Inactive filter is on and the last inactive season is gone', async () => {
      const user = userEvent.setup()
      listSeasons.mockResolvedValue([CURRENT, INACTIVE])
      const { queryClient } = renderList('test-club-id')

      await screen.findAllByRole('heading', { level: 3 })
      await user.click(counter('inactive'))
      expect(headings()).toEqual(['Trial'])

      // The season is reactivated elsewhere: the filter stays on (a pressed zero counter), and the list says so.
      listSeasons.mockResolvedValue([CURRENT])
      await queryClient.invalidateQueries({ queryKey: ['managed-club', 'test-club-id', 'seasons'] })

      expect(await screen.findByText('No inactive seasons')).toBeInTheDocument()
      expect(counter('inactive')).toHaveAttribute('aria-pressed', 'true')
    })
  })
})
