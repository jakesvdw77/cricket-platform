import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SeasonDetailPage from './SeasonDetailPage'
import type { Season } from '../../api/seasonApi'

const listSeasons = vi.fn()
const getSeasonsSummary = vi.fn()

vi.mock('../../api/seasonApi', () => ({
  listSeasons: (clubId: string) => listSeasons(clubId),
  getSeasonsSummary: (clubId: string) => getSeasonsSummary(clubId),
  seasonsSummaryKey: (clubId: string) => ['managed-club', clubId, 'seasons', 'summary'],
}))

beforeEach(() => {
  vi.clearAllMocks()
  // Today is pinned so the status of each season is deterministic.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 5, 15, 12, 0, 0))
  getSeasonsSummary.mockResolvedValue({ seasons: [{ seasonId: 'season-1', leagueCount: 2, teamsEntered: 5, matchCount: 18 }] })
})

afterEach(() => {
  vi.useRealTimers()
})

function makeSeason(overrides: Partial<Season> = {}): Season {
  return {
    id: 'season-1',
    clubId: 'test-club-id',
    label: '2026 Season',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    active: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: null,
    ...overrides,
  }
}

function OutletContextWrapper({ clubId }: { clubId?: string }) {
  return <Outlet context={{ clubId }} />
}

function renderPage(initialPath: string, clubId?: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/manage" element={<OutletContextWrapper clubId={clubId} />}>
            <Route path="fixtures/seasons" element={<div>Season List Page</div>} />
            <Route path="fixtures/seasons/:seasonId" element={<SeasonDetailPage />} />
            <Route path="fixtures/seasons/:seasonId/edit" element={<div>Edit Season Page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('SeasonDetailPage', () => {
  it('renders "Not authorized" and does not fetch when no clubId is in the Outlet context', () => {
    renderPage('/manage/fixtures/seasons/season-1', undefined)

    expect(screen.getByText('Not authorized')).toBeInTheDocument()
    expect(listSeasons).not.toHaveBeenCalled()
  })

  it('shows Back alone on the top row, the label with its badge, and one filled Manage Season menu with Edit Season first', async () => {
    listSeasons.mockResolvedValueOnce([makeSeason(), makeSeason({ id: 'season-2', label: '2027 Season' })])

    renderPage('/manage/fixtures/seasons/season-1', 'test-club-id')

    expect(await screen.findByRole('heading', { name: '2026 Season', level: 1 })).toBeInTheDocument()
    expect(listSeasons).toHaveBeenCalledWith('test-club-id')
    expect(screen.getByRole('link', { name: /back to seasons/i })).toHaveAttribute('href', '/manage/fixtures/seasons')
    expect(within(screen.getByTestId('season-header-top-row')).getAllByRole('link')).toHaveLength(1)
    expect(screen.queryByRole('link', { name: /^edit/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Season' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '2026 Season', level: 1 })).toHaveStyle({ textTransform: 'none' })
    const manage = screen.getByRole('button', { name: /manage season/i })
    expect(manage).toHaveClass('MuiButton-contained')
    expect(within(screen.getByTestId('season-header-title-row')).getByRole('button', { name: /manage season/i })).toBe(manage)
    await userEvent.setup().click(manage)
    const items = screen.getAllByRole('menuitem')
    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringContaining('Edit Season'),
      expect.stringContaining('View Leagues'),
      expect.stringContaining('View Matches'),
    ])
    expect(items[0]).toHaveAttribute('href', expect.stringMatching(/^\/manage\/fixtures\/seasons\/season-1\/edit\?returnTo=.*returnLabel=2026\+Season\+season/))
    expect(within(screen.getByLabelText('Season badges')).getByText('Current')).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it.each([
    ['Current', { startDate: '2026-01-01', endDate: '2026-12-31', active: true }],
    ['Upcoming', { startDate: '2026-09-01', endDate: '2027-03-31', active: true }],
    ['Past', { startDate: '2025-01-01', endDate: '2025-12-31', active: true }],
    ['Inactive', { startDate: '2026-01-01', endDate: '2026-12-31', active: false }],
  ])('shows the %s badge and status row', async (label, overrides) => {
    listSeasons.mockResolvedValueOnce([makeSeason(overrides)])

    renderPage('/manage/fixtures/seasons/season-1', 'test-club-id')

    const badges = await screen.findByLabelText('Season badges')
    expect(within(badges).getByText(label)).toBeInTheDocument()
    expect(within(screen.getByTestId('season-dates-card')).getByText(label)).toBeInTheDocument()
  })

  it('fills the key-figure strip and the Dates card', async () => {
    listSeasons.mockResolvedValueOnce([makeSeason()])

    renderPage('/manage/fixtures/seasons/season-1', 'test-club-id')

    expect(await within(await screen.findByTestId('season-figure-starts')).getByTestId('page-counter-value')).toHaveTextContent('1 Jan 2026')
    expect(within(await screen.findByTestId('season-figure-ends')).getByTestId('page-counter-value')).toHaveTextContent('31 Dec 2026')
    expect(within(await screen.findByTestId('season-figure-length')).getByTestId('page-counter-value')).toHaveTextContent('12 months')
    expect(await screen.findByText('18')).toBeInTheDocument()
    expect(within(await screen.findByTestId('season-figure-matches')).getByTestId('page-counter-value')).toHaveTextContent('18')
    const dates = within(screen.getByTestId('season-dates-card'))
    expect(dates.getByText('2026 Season')).toBeInTheDocument()
    expect(dates.getByText('1 Jan 2026')).toBeInTheDocument()
    expect(dates.getByText('31 Dec 2026')).toBeInTheDocument()
  })

  it('shows the progress gauge only when the season is current', async () => {
    listSeasons.mockResolvedValueOnce([makeSeason()])
    const { unmount } = renderPage('/manage/fixtures/seasons/season-1', 'test-club-id')

    const progress = await screen.findByTestId('season-progress')
    expect(progress).toHaveTextContent('Day 166 of 365')
    expect(within(progress).getByRole('progressbar', { name: 'Season progress' })).toBeInTheDocument()
    unmount()

    listSeasons.mockResolvedValueOnce([makeSeason({ startDate: '2026-09-01', endDate: '2027-03-31' })])
    renderPage('/manage/fixtures/seasons/season-1', 'test-club-id')
    await screen.findByRole('heading', { name: '2026 Season' })
    expect(screen.queryByTestId('season-progress')).not.toBeInTheDocument()
  })

  it('shows the leagues and teams figures with links to the leagues and matches lists', async () => {
    listSeasons.mockResolvedValueOnce([makeSeason()])

    renderPage('/manage/fixtures/seasons/season-1', 'test-club-id')

    const card = within(await screen.findByTestId('season-contents-card'))
    expect(await card.findByText('Teams Entered')).toBeInTheDocument()
    expect(card.getByText('5')).toBeInTheDocument()
    expect(card.getByText('2')).toBeInTheDocument()
    expect(card.getByRole('link', { name: 'View Leagues' })).toHaveAttribute('href', expect.stringMatching(/^\/manage\/fixtures\/leagues\?returnTo=.*returnLabel=2026\+Season\+season/))
    expect(card.getByRole('link', { name: 'View Matches' })).toHaveAttribute('href', expect.stringMatching(/^\/manage\/fixtures\/matches\?returnTo=/))
    expect(card.getByRole('link', { name: 'View Leagues' }).querySelector('svg')).toBeNull()
  })

  it('shows a dash for the figures while the summary is loading', async () => {
    listSeasons.mockResolvedValueOnce([makeSeason()])
    getSeasonsSummary.mockReturnValue(new Promise(() => {}))

    renderPage('/manage/fixtures/seasons/season-1', 'test-club-id')

    expect(await within(await screen.findByTestId('season-figure-matches')).getByTestId('page-counter-value')).toHaveTextContent('-')
    const card = within(screen.getByTestId('season-contents-card'))
    expect(card.getAllByText('-')).toHaveLength(2)
    expect(card.queryByText('Nothing entered in this season yet')).not.toBeInTheDocument()
  })

  it('shows a dash for the figures when the summary fails', async () => {
    listSeasons.mockResolvedValueOnce([makeSeason()])
    getSeasonsSummary.mockRejectedValue(new Error('boom'))

    renderPage('/manage/fixtures/seasons/season-1', 'test-club-id')

    expect(await within(await screen.findByTestId('season-figure-matches')).getByTestId('page-counter-value')).toHaveTextContent('-')
    expect(screen.getByRole('heading', { name: '2026 Season' })).toBeInTheDocument()
  })

  it('says nothing is entered when every count is zero', async () => {
    listSeasons.mockResolvedValueOnce([makeSeason()])
    getSeasonsSummary.mockResolvedValue({ seasons: [{ seasonId: 'season-1', leagueCount: 0, teamsEntered: 0, matchCount: 0 }] })

    renderPage('/manage/fixtures/seasons/season-1', 'test-club-id')

    expect(await screen.findByText('Nothing entered in this season yet')).toBeInTheDocument()
    expect(within(await screen.findByTestId('season-figure-matches')).getByTestId('page-counter-value')).toHaveTextContent('0')
  })

  it('shows the four figures as static cards, with no FILTER tag and no button', async () => {
    listSeasons.mockResolvedValueOnce([makeSeason()])
    renderPage('/manage/fixtures/seasons/season-1', 'test-club-id')

    const strip = within(await screen.findByTestId('season-key-figures'))
    expect(strip.queryByRole('button')).not.toBeInTheDocument()
    expect(strip.queryByText('FILTER')).not.toBeInTheDocument()
    for (const label of ['Starts', 'Ends', 'Length', 'Matches']) {
      expect(strip.getByText(label)).toBeInTheDocument()
    }
  })

  it('reads Back to {label} and goes there with a valid returnTo', async () => {
    listSeasons.mockResolvedValueOnce([makeSeason()])
    renderPage('/manage/fixtures/seasons/season-1?returnTo=%2Fmanage%2Ffixtures%2Fleagues&returnLabel=Leagues', 'test-club-id')

    const back = await screen.findByRole('link', { name: 'Back to Leagues' })
    expect(back).toHaveAttribute('href', '/manage/fixtures/leagues')
  })

  it('renders an error state when the matching season id is not in the fetched list', async () => {
    listSeasons.mockResolvedValueOnce([makeSeason({ id: 'some-other-id' })])

    renderPage('/manage/fixtures/seasons/season-1', 'test-club-id')

    expect(await screen.findByText("Couldn't load this season")).toBeInTheDocument()
  })
})
