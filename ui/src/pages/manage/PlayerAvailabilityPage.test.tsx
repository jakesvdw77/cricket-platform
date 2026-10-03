import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AxiosError } from 'axios'
import PlayerAvailabilityPage from './PlayerAvailabilityPage'
import { at, makeGame, makePlayer } from './playerAvailability/testData'
import type { PlayerAvailability } from '../../api/playerAvailabilityApi'
import type { Season } from '../../api/seasonApi'

const listPlayerAvailability = vi.fn()
const listSeasons = vi.fn()
const listLeagues = vi.fn()
const listSections = vi.fn()
const listTeamsForClub = vi.fn()

vi.mock('../../api/playerAvailabilityApi', () => ({
  listPlayerAvailability: (clubId: string, params: unknown) => listPlayerAvailability(clubId, params),
}))
vi.mock('../../api/seasonApi', () => ({ listSeasons: (clubId: string) => listSeasons(clubId) }))
vi.mock('../../api/leagueApi', () => ({ listLeagues: (clubId: string) => listLeagues(clubId) }))
vi.mock('../../api/sectionApi', () => ({ listSections: (clubId: string) => listSections(clubId) }))
vi.mock('../../api/teamApi', () => ({
  listTeamsForClub: (clubId: string, params: unknown) => listTeamsForClub(clubId, params),
}))

const STORAGE_KEY = 'playerAvailability:filters:test-club-id'

function season(id: string, label: string, startDate: string, endDate: string, createdAt = '2026-01-01T00:00:00Z'): Season {
  return { id, clubId: 'test-club-id', label, startDate, endDate, active: true, createdAt, updatedAt: createdAt, updatedBy: null }
}

const SEASONS = [season('season-old', '2025', '2025-01-01', '2025-12-31'), season('season-now', '2026', '2026-01-01', '2026-12-31')]

const FUTURE = makeGame({ matchId: 'm-future', matchDate: at(12, 5, 9, 0, 2099), pollType: 'GROUP', pollId: 'round-1', roundId: 'round-1' })
const PAST = makeGame({ matchId: 'm-past', matchDate: at(1, 5, 9, 0, 2000), label: 'Old v Past', pollType: 'SQUAD', pollId: 'p-1', roundId: null })

function makeResult(overrides: Partial<PlayerAvailability> = {}): PlayerAvailability {
  return {
    games: [FUTURE],
    players: [
      makePlayer('p1', 'Jane', 'Smith', 7, [['m-future', 'AVAILABLE', true]]),
      makePlayer('p2', 'Bob', 'Jones', null, [['m-future', 'NO_RESPONSE']]),
    ],
    truncated: false,
    ...overrides,
  }
}

// MUI's useMediaQuery reads window.matchMedia; jsdom has none. sm and up matches when `wide`.
function setViewport(wide: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: wide,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  setViewport(true)
  listPlayerAvailability.mockResolvedValue(makeResult())
  listSeasons.mockResolvedValue(SEASONS)
  listLeagues.mockResolvedValue([
    { id: 'league-1', name: 'Premier League' },
    { id: 'league-2', name: 'Division Two' },
  ])
  listSections.mockResolvedValue([
    {
      id: 'section-1',
      clubId: 'test-club-id',
      parentSectionId: null,
      name: 'Juniors',
      minAge: null,
      maxAge: null,
      gender: null,
      active: true,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      updatedBy: null,
    },
  ])
  listTeamsForClub.mockImplementation((_clubId: string, params: { sectionId?: string }) =>
    Promise.resolve(
      params?.sectionId
        ? [{ id: 'team-1', name: 'Juniors A' }]
        : [
            { id: 'team-1', name: 'Juniors A' },
            { id: 'team-2', name: 'Seniors 1st' },
          ],
    ),
  )
})

afterEach(() => {
  delete window.matchMedia
})

function renderPage(clubId: string | null = 'test-club-id') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/manage/availability/players']}>
        <Routes>
          <Route path="/manage" element={<Outlet context={{ clubId: clubId ?? undefined }} />}>
            <Route index element={<div>Dashboard</div>} />
            <Route path="availability" element={<div>Polls List</div>} />
            <Route path="availability/players" element={<PlayerAvailabilityPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function moreFilters(): HTMLElement {
  return document.getElementById('player-availability-more-filters') as HTMLElement
}

async function loaded() {
  await screen.findByRole('table', { name: 'Player availability by game' })
}

describe('PlayerAvailabilityPage', () => {
  it('renders the grid without a header or a one-way Availability Polls button (the hub owns them, 073)', async () => {
    renderPage()
    await loaded()

    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Player Availability' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /back to dashboard/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Availability Polls' })).not.toBeInTheDocument()
    expect(screen.getByText('Jane Smith')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Search players')).toBeInTheDocument()
    expect(screen.getByText('2 players · 1 game')).toBeInTheDocument()
  })

  it('lays the filters out as Season, Section, Team, League, then search and toggles in a second row', async () => {
    renderPage()
    await loaded()

    const order = ['Season', 'Section', 'Team', 'League'].map((name) => screen.getByLabelText(name))
    for (let i = 0; i < order.length - 1; i += 1) {
      expect(order[i].compareDocumentPosition(order[i + 1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    }
    const search = screen.getByPlaceholderText('Search players')
    expect(order[3].compareDocumentPosition(search) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    const toggle = screen.getByRole('checkbox', { name: 'Show past games' })
    expect(search.compareDocumentPosition(toggle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(
      toggle.compareDocumentPosition(screen.getByRole('button', { name: 'Jump to today' })) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it('defaults the season via pickDefaultSeasonId and sends only the set params', async () => {
    renderPage()
    await loaded()

    expect(listPlayerAvailability).toHaveBeenCalledTimes(1)
    expect(listPlayerAvailability).toHaveBeenCalledWith('test-club-id', {
      seasonId: 'season-now',
      leagueId: undefined,
      sectionId: undefined,
      teamId: undefined,
      includePast: false,
    })
    // The derived default is not written back as if the user had chosen it.
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('lets a stored season win over the default and never overwrites it', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ seasonId: 'season-old', leagueId: null, sectionId: null, teamId: null }))
    renderPage()
    await loaded()

    await waitFor(() =>
      expect(listPlayerAvailability).toHaveBeenLastCalledWith('test-club-id', expect.objectContaining({ seasonId: 'season-old' })),
    )
    expect(listPlayerAvailability).not.toHaveBeenCalledWith('test-club-id', expect.objectContaining({ seasonId: 'season-now' }))
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) as string).seasonId).toBe('season-old')
  })

  it('falls back to the default when the stored season no longer exists', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ seasonId: 'gone', leagueId: null, sectionId: null, teamId: null }))
    renderPage()
    await loaded()

    expect(listPlayerAvailability).toHaveBeenLastCalledWith('test-club-id', expect.objectContaining({ seasonId: 'season-now' }))
  })

  it('persists Season, League, Section and Team, but not search', async () => {
    const user = userEvent.setup()
    renderPage()
    await loaded()

    await user.click(screen.getByLabelText('Season'))
    await user.click(await screen.findByRole('option', { name: '2025' }))
    await waitFor(() =>
      expect(listPlayerAvailability).toHaveBeenLastCalledWith('test-club-id', expect.objectContaining({ seasonId: 'season-old' })),
    )

    await user.click(screen.getByLabelText('League'))
    await user.click(await screen.findByRole('option', { name: 'Premier League' }))
    await waitFor(() =>
      expect(listPlayerAvailability).toHaveBeenLastCalledWith('test-club-id', expect.objectContaining({ leagueId: 'league-1' })),
    )

    await user.click(screen.getByLabelText('Section'))
    await user.click(within(await screen.findByRole('treeitem', { name: 'Juniors' })).getByText('Juniors'))
    await waitFor(() => expect(listTeamsForClub).toHaveBeenCalledWith('test-club-id', { sectionId: 'section-1' }))
    await waitFor(() =>
      expect(listPlayerAvailability).toHaveBeenLastCalledWith('test-club-id', expect.objectContaining({ sectionId: 'section-1' })),
    )

    await user.click(screen.getByLabelText('Team'))
    expect(await screen.findByRole('option', { name: 'All teams in section' })).toBeInTheDocument()
    await user.click(screen.getByRole('option', { name: 'Juniors A' }))
    await waitFor(() =>
      expect(listPlayerAvailability).toHaveBeenLastCalledWith('test-club-id', {
        seasonId: 'season-old',
        leagueId: 'league-1',
        sectionId: 'section-1',
        teamId: 'team-1',
        includePast: false,
      }),
    )

    await user.type(screen.getByPlaceholderText('Search players'), 'jane')

    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) as string)).toEqual({
      seasonId: 'season-old',
      leagueId: 'league-1',
      sectionId: 'section-1',
      teamId: 'team-1',
    })
    expect(localStorage.getItem(STORAGE_KEY)).not.toContain('jane')
  })

  it('clears the team when the section changes', async () => {
    const user = userEvent.setup()
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ seasonId: null, leagueId: null, sectionId: null, teamId: 'team-2' }))
    renderPage()
    await loaded()
    await waitFor(() =>
      expect(listPlayerAvailability).toHaveBeenLastCalledWith('test-club-id', expect.objectContaining({ teamId: 'team-2' })),
    )

    await user.click(screen.getByLabelText('Section'))
    await user.click(within(await screen.findByRole('treeitem', { name: 'Juniors' })).getByText('Juniors'))

    await waitFor(() =>
      expect(listPlayerAvailability).toHaveBeenLastCalledWith(
        'test-club-id',
        expect.objectContaining({ sectionId: 'section-1', teamId: undefined }),
      ),
    )
  })

  it('restores a stored League/Section/Team on return', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ seasonId: null, leagueId: 'league-2', sectionId: null, teamId: 'team-2' }))
    renderPage()
    await loaded()

    await waitFor(() =>
      expect(listPlayerAvailability).toHaveBeenLastCalledWith('test-club-id', {
        seasonId: 'season-now',
        leagueId: 'league-2',
        sectionId: undefined,
        teamId: 'team-2',
        includePast: false,
      }),
    )
  })

  it('Show past games sends includePast and is not persisted', async () => {
    const user = userEvent.setup()
    renderPage()
    await loaded()

    expect(screen.getByRole('checkbox', { name: 'Show past games' })).not.toBeChecked()
    await user.click(screen.getByRole('checkbox', { name: 'Show past games' }))

    await waitFor(() =>
      expect(listPlayerAvailability).toHaveBeenLastCalledWith('test-club-id', expect.objectContaining({ includePast: true })),
    )
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('Hide players with no answers hides only players without an answer', async () => {
    const user = userEvent.setup()
    renderPage()
    await loaded()

    expect(screen.getByText('Bob Jones')).toBeInTheDocument()
    await user.click(screen.getByRole('checkbox', { name: 'Hide players with no answers' }))

    expect(screen.queryByText('Bob Jones')).not.toBeInTheDocument()
    expect(screen.getByText('Jane Smith')).toBeInTheDocument()
    expect(screen.getByText('1 player · 1 game')).toBeInTheDocument()
    // Client-side only: no refetch.
    expect(listPlayerAvailability).toHaveBeenCalledTimes(1)
  })

  it('search filters rows client-side and the footer follows the visible rows', async () => {
    const user = userEvent.setup()
    renderPage()
    await loaded()
    expect(screen.getByLabelText('1 available, 0 unsure, 0 unavailable')).toBeInTheDocument()

    await user.type(screen.getByPlaceholderText('Search players'), 'bob')

    expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument()
    expect(screen.getByText('Bob Jones')).toBeInTheDocument()
    expect(screen.getByLabelText('0 available, 0 unsure, 0 unavailable')).toBeInTheDocument()
    expect(listPlayerAvailability).toHaveBeenCalledTimes(1)
  })

  it('Jump to today scrolls the first upcoming game column into view', async () => {
    const user = userEvent.setup()
    listPlayerAvailability.mockResolvedValue(makeResult({ games: [PAST, FUTURE], players: [makePlayer('p1', 'Jane', 'Smith', 7, [['m-past', 'AVAILABLE'], ['m-future', 'UNSURE']])] }))
    const scrollIntoView = vi.fn(function (this: HTMLElement) {
      return this
    })
    Element.prototype.scrollIntoView = scrollIntoView as unknown as typeof Element.prototype.scrollIntoView
    renderPage()
    await loaded()

    await user.click(screen.getByRole('button', { name: 'Jump to today' }))

    expect(scrollIntoView).toHaveBeenCalledTimes(1)
    expect(scrollIntoView.mock.contexts[0]).toBe(screen.getByRole('link', { name: 'Villagers 1 v CBC: open poll' }).closest('th'))
    delete Element.prototype.scrollIntoView
  })

  it('disables Jump to today when every game is in the past, and does not throw without scrollIntoView', async () => {
    listPlayerAvailability.mockResolvedValue(makeResult({ games: [PAST], players: [makePlayer('p1', 'Jane', 'Smith', 7, [['m-past', 'AVAILABLE']])] }))
    renderPage()
    await loaded()

    expect(screen.getByRole('button', { name: 'Jump to today' })).toBeDisabled()
  })

  it('does not throw clicking Jump to today in jsdom (no scrollIntoView)', async () => {
    const user = userEvent.setup()
    renderPage()
    await loaded()

    await user.click(screen.getByRole('button', { name: 'Jump to today' }))
    expect(screen.getByRole('table')).toBeInTheDocument()
  })

  it('shows a labelled progress indicator under the toolbar while the grid loads', async () => {
    let resolve: (value: PlayerAvailability) => void = () => undefined
    listPlayerAvailability.mockReturnValue(new Promise<PlayerAvailability>((r) => { resolve = r }))
    renderPage()

    expect(await screen.findByRole('progressbar', { name: 'Loading player availability' })).toBeInTheDocument()
    expect(screen.getByLabelText('League')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()

    resolve(makeResult())
    await loaded()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })

  it('hides Jump to today while the grid is replaced by an empty state', async () => {
    listPlayerAvailability.mockResolvedValue(
      makeResult({ games: [makeGame({ pollType: null, pollId: null, roundId: null })], players: [] }),
    )
    renderPage()

    await screen.findByText('No polls opened yet for these games')
    expect(screen.queryByRole('button', { name: 'Jump to today' })).not.toBeInTheDocument()
  })

  it('says so when no games match', async () => {
    listPlayerAvailability.mockResolvedValue(makeResult({ games: [], players: [] }))
    renderPage()

    expect(await screen.findByText('No games match these filters')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Jump to today' })).not.toBeInTheDocument()
  })

  it('says so when no game has a poll yet, linking to Availability Polls', async () => {
    listPlayerAvailability.mockResolvedValue(
      makeResult({ games: [makeGame({ pollType: null, pollId: null, roundId: null })], players: [] }),
    )
    renderPage()

    expect(await screen.findByText('No polls opened yet for these games')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to Availability Polls' })).toHaveAttribute('href', '/manage/availability')
  })

  it('shows a notice when the server truncated the result', async () => {
    listPlayerAvailability.mockResolvedValue(makeResult({ truncated: true }))
    renderPage()
    await loaded()

    expect(screen.getByRole('alert')).toHaveTextContent(/Showing the first 1 games and 2 players\. Narrow the filters/)
  })

  it('shows no notice when not truncated', async () => {
    renderPage()
    await loaded()

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('renders "Not authorized" and fetches nothing without a club', () => {
    renderPage(null)

    expect(screen.getByText('Not authorized')).toBeInTheDocument()
    expect(listPlayerAvailability).not.toHaveBeenCalled()
  })

  it('shows the error state, keeping the toolbar so filters can be changed', async () => {
    listPlayerAvailability.mockRejectedValue(new AxiosError('Server error', 'ERR_BAD_RESPONSE'))
    renderPage()

    expect(await screen.findByText("Couldn't load player availability")).toBeInTheDocument()
    expect(screen.getByLabelText('League')).toBeInTheDocument()
  })

  describe('on a phone (xs)', () => {
    it('shows Team and League and search, with the rest behind a Filters toggle', async () => {
      const user = userEvent.setup()
      setViewport(false)
      renderPage()
      await loaded()

      expect(screen.getByPlaceholderText('Search players')).toBeVisible()
      expect(screen.getByLabelText('Team')).toBeVisible()
      expect(screen.getByLabelText('League')).toBeVisible()

      const toggle = screen.getByRole('button', { name: 'Filters' })
      expect(toggle).toHaveAttribute('aria-expanded', 'false')
      expect(toggle).toHaveAttribute('aria-controls', 'player-availability-more-filters')
      expect(moreFilters()).not.toBeVisible()

      await user.click(toggle)

      expect(toggle).toHaveAttribute('aria-expanded', 'true')
      await waitFor(() => expect(moreFilters()).toBeVisible())
      expect(within(moreFilters()).getByLabelText('Season')).toBeInTheDocument()
      expect(screen.getByRole('checkbox', { name: 'Show past games' })).toBeInTheDocument()
      expect(screen.getByRole('checkbox', { name: 'Hide players with no answers' })).toBeInTheDocument()

      await user.click(toggle)
      expect(toggle).toHaveAttribute('aria-expanded', 'false')
      await waitFor(() => expect(moreFilters()).not.toBeVisible())
    })

    it('shows every filter without opening anything from sm up', async () => {
      renderPage()
      await loaded()

      expect(moreFilters()).toBeVisible()
    })
  })
})
