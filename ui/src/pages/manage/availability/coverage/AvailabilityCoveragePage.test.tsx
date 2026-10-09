import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { configure, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AvailabilityCoveragePage from './AvailabilityCoveragePage'
import { at, makeGame, makePlayer } from '../../playerAvailability/testData'
import type { PlayerAvailability } from '../../../../api/playerAvailabilityApi'
import type { Season } from '../../../../api/seasonApi'
import { AvailabilityHubStub } from '../../../../test/AvailabilityHubStub'

// The first render of the page is cold (MUI select, tree select, five queries).
configure({ asyncUtilTimeout: 5000 })

const listPlayerAvailability = vi.fn()
const listSeasons = vi.fn()
const listLeagues = vi.fn()
const listSections = vi.fn()
const listTeamsForClub = vi.fn()

vi.mock('../../../../api/playerAvailabilityApi', () => ({
  listPlayerAvailability: (clubId: string, params: unknown) => listPlayerAvailability(clubId, params),
}))
vi.mock('../../../../api/seasonApi', () => ({ listSeasons: (clubId: string) => listSeasons(clubId) }))
vi.mock('../../../../api/leagueApi', () => ({ listLeagues: (clubId: string) => listLeagues(clubId) }))
vi.mock('../../../../api/sectionApi', () => ({ listSections: (clubId: string) => listSections(clubId) }))
vi.mock('../../../../api/teamApi', () => ({
  listTeamsForClub: (clubId: string, params?: unknown) => listTeamsForClub(clubId, params),
}))

const STORAGE_KEY = 'availability:filters:test-club-id'

function season(id: string, label: string, startDate: string, endDate: string): Season {
  return { id, clubId: 'test-club-id', label, startDate, endDate, active: true, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', updatedBy: null }
}
const SEASONS = [season('season-old', '2025', '2025-01-01', '2025-12-31'), season('season-now', '2026', '2026-01-01', '2026-12-31')]

// Saturday 3 Oct 2099 afternoon: two teams (needs 2 each, 3 distinct players -> Short by 1);
// Sunday 4 Oct morning: a game with no poll; Monday: a team that is not in the club's team list.
const SAT_V1 = makeGame({ matchId: 'm1', teamId: 'team-1', leagueId: 'league-1', label: 'Villagers 1 v CBC', matchDate: at(10, 3, 13, 0, 2099), dayPart: 'AFTERNOON', pollType: 'SQUAD', pollId: 'poll-1', roundId: null })
const SAT_V2 = makeGame({ matchId: 'm2', teamId: 'team-2', leagueId: 'league-1', label: 'Villagers 2 v Town', matchDate: at(10, 3, 13, 30, 2099), dayPart: 'AFTERNOON', pollType: 'SQUAD', pollId: 'poll-2', roundId: null })
const SUN_NO_POLL = makeGame({ matchId: 'm3', teamId: 'team-1', leagueId: 'league-1', label: 'Villagers 1 v Hills', matchDate: at(10, 4, 9, 0, 2099), dayPart: 'MORNING', pollType: null, pollId: null, roundId: null })
const MON_UNKNOWN = makeGame({ matchId: 'm4', teamId: 'team-gone', leagueId: 'league-1', label: 'Ghosts v Hills', matchDate: at(10, 5, 9, 0, 2099), dayPart: 'MORNING', pollType: 'SQUAD', pollId: 'poll-4', roundId: null })

function makeResult(overrides: Partial<PlayerAvailability> = {}): PlayerAvailability {
  return {
    games: [SAT_V1, SAT_V2, SUN_NO_POLL, MON_UNKNOWN],
    players: [
      makePlayer('p1', 'Abe', 'Villiers', null, [['m1', 'AVAILABLE'], ['m2', 'AVAILABLE'], ['m3', 'NOT_IN_POLL'], ['m4', 'AVAILABLE']]),
      makePlayer('p2', 'Ben', 'Stokes', null, [['m1', 'AVAILABLE'], ['m2', 'UNSURE'], ['m3', 'NOT_IN_POLL'], ['m4', 'NO_RESPONSE']]),
      makePlayer('p3', 'Cal', 'Root', null, [['m1', 'NO_RESPONSE'], ['m2', 'AVAILABLE'], ['m3', 'NOT_IN_POLL'], ['m4', 'NO_RESPONSE']]),
    ],
    truncated: false,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  listPlayerAvailability.mockResolvedValue(makeResult())
  listSeasons.mockResolvedValue(SEASONS)
  listLeagues.mockResolvedValue([
    { id: 'league-1', name: 'Premier League', maxPlayingXiSize: 2 },
    { id: 'league-2', name: 'Division Two', maxPlayingXiSize: 11 },
  ])
  listSections.mockResolvedValue([
    { id: 'section-1', clubId: 'test-club-id', parentSectionId: null, name: 'Juniors', minAge: null, maxAge: null, gender: null, active: true, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', updatedBy: null },
  ])
  listTeamsForClub.mockResolvedValue([
    { id: 'team-1', name: 'Villagers 1' },
    { id: 'team-2', name: 'Villagers 2' },
  ])
})

function renderPage(clubId: string | null = 'test-club-id', path = '/manage/availability/coverage') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/manage" element={<Outlet context={{ clubId: clubId ?? undefined }} />}>
            <Route path="availability" element={<div>Polls List</div>} />
            <Route element={<AvailabilityHubStub />}>
              <Route path="availability/coverage" element={<AvailabilityCoveragePage />} />
            </Route>
          </Route>
          <Route path="/manage/availability" element={<div>Polls List</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

async function loaded() {
  await screen.findByText(/^Showing 3 slots/)
}

describe('AvailabilityCoveragePage (docs/specs/074)', () => {
  it('renders one card per slot in date order, the count line and the legend once', async () => {
    renderPage()
    await loaded()

    const cards = screen.getAllByTestId('slot-coverage-card')
    expect(cards.map((card) => within(card).getByRole('heading', { level: 3 }).textContent)).toEqual([
      'Sat 3 Oct · Afternoon',
      'Sun 4 Oct · Morning',
      'Mon 5 Oct · Morning',
    ])
    expect(screen.getAllByRole('list', { name: 'Legend' })).toHaveLength(1)
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument()
  })

  it('uses the singular count line for a single slot', async () => {
    listPlayerAvailability.mockResolvedValue(makeResult({ games: [SAT_V1, SAT_V2] }))
    renderPage()
    expect(await screen.findByText(/^Showing 1 slot\b/)).toBeInTheDocument()
  })

  it('computes the verdict from the leagues\' XI sizes and resolves team names, with Unknown team as a fallback', async () => {
    renderPage()
    await loaded()

    const [saturday, sunday, monday] = screen.getAllByTestId('slot-coverage-card')
    expect(within(saturday).getByText('Short by 1')).toBeInTheDocument()
    expect(within(saturday).getByText('Villagers 1')).toBeInTheDocument()
    expect(within(saturday).getByText('Villagers 2')).toBeInTheDocument()
    expect(within(saturday).getByTestId('slot-summary')).toHaveTextContent('3 distinct players available for 4 places')
    // Mixed polled and unpolled slots: the unpolled one is a card, not an empty state.
    expect(within(sunday).getByText('No poll yet')).toBeInTheDocument()
    expect(within(monday).getAllByText('Unknown team').length).toBeGreaterThan(0)
    expect(screen.queryByText('No polls yet')).not.toBeInTheDocument()
  })

  it('shows names for the shared players on a Short card', async () => {
    renderPage()
    await loaded()
    const [saturday] = screen.getAllByTestId('slot-coverage-card')
    expect(within(saturday).getByLabelText('Abe Villiers')).toBeInTheDocument()
  })

  it('holds the grid request until the seasons have loaded, then makes one with the default season and no teamId', async () => {
    let release: (value: Season[]) => void = () => undefined
    listSeasons.mockReturnValue(new Promise<Season[]>((resolve) => (release = resolve)))
    renderPage()

    expect(screen.getByRole('progressbar', { name: 'Loading coverage' })).toBeInTheDocument()
    await waitFor(() => expect(listSeasons).toHaveBeenCalled())
    expect(listPlayerAvailability).not.toHaveBeenCalled()

    release(SEASONS)
    await loaded()
    expect(listPlayerAvailability).toHaveBeenCalledTimes(1)
    expect(listPlayerAvailability).toHaveBeenCalledWith('test-club-id', {
      seasonId: 'season-now',
      leagueId: undefined,
      sectionId: undefined,
      includePast: false,
    })
    expect(listPlayerAvailability.mock.calls[0][1]).not.toHaveProperty('teamId')
    // The derived default is not written back as if chosen.
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('loads the club\'s teams with no section filter, for names', async () => {
    renderPage()
    await loaded()
    expect(listTeamsForClub).toHaveBeenCalledWith('test-club-id', undefined)
  })

  it('ignores a season saved by an older version and always uses the default', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ seasonId: 'season-old', leagueId: null, sectionId: null, teamId: null }))
    renderPage()
    await loaded()
    expect(listPlayerAvailability).toHaveBeenLastCalledWith('test-club-id', expect.objectContaining({ seasonId: 'season-now' }))
  })

  it('sends League and Section and saves them in the shared key (and the address), no Season field', async () => {
    const user = userEvent.setup()
    renderPage()
    await loaded()
    expect(screen.queryByLabelText('Season')).not.toBeInTheDocument()

    await user.click(screen.getByLabelText('League'))
    await user.click(await screen.findByRole('option', { name: 'Premier League' }))
    await waitFor(() =>
      expect(listPlayerAvailability).toHaveBeenLastCalledWith('test-club-id', expect.objectContaining({ leagueId: 'league-1' })),
    )

    await user.click(screen.getByLabelText('Section'))
    await user.click(within(await screen.findByRole('treeitem', { name: 'Juniors' })).getByText('Juniors'))
    await waitFor(() =>
      expect(listPlayerAvailability).toHaveBeenLastCalledWith('test-club-id', {
        seasonId: 'season-now',
        leagueId: 'league-1',
        sectionId: 'section-1',
        includePast: false,
      }),
    )

    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) as string)).toEqual({
      leagueId: 'league-1',
      sectionId: 'section-1',
      teamId: null,
    })
    expect(screen.getByTestId('hub-location')).toHaveTextContent('league=league-1')
  })

  it('shares the Players view\'s saved filters (one key), but never sends its team', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ leagueId: 'league-2', sectionId: null, teamId: 'team-2' }))
    renderPage()
    await loaded()
    await waitFor(() =>
      expect(listPlayerAvailability).toHaveBeenLastCalledWith('test-club-id', {
        seasonId: 'season-now',
        leagueId: 'league-2',
        sectionId: undefined,
        includePast: false,
      }),
    )
  })

  it('has no Team filter', async () => {
    renderPage()
    await loaded()
    expect(screen.queryByLabelText('Team')).not.toBeInTheDocument()
  })

  it('View entire season sends includePast and is not persisted', async () => {
    const user = userEvent.setup()
    renderPage()
    await loaded()

    expect(screen.getByRole('checkbox', { name: 'View entire season' })).not.toBeChecked()
    await user.click(screen.getByRole('checkbox', { name: 'View entire season' }))

    await waitFor(() =>
      expect(listPlayerAvailability).toHaveBeenLastCalledWith('test-club-id', expect.objectContaining({ includePast: true })),
    )
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('shows the truncation notice only when the response is truncated', async () => {
    const plain = renderPage()
    await loaded()
    expect(screen.queryByText(/some slots or counts may be incomplete/)).not.toBeInTheDocument()
    plain.unmount()

    listPlayerAvailability.mockResolvedValue(makeResult({ truncated: true }))
    renderPage()
    await loaded()
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Showing the first 4 games and 3 players, so some slots or counts may be incomplete. Narrow the filters (league or section) to see the rest.',
    )
  })

  it('shows a loading indicator while the grid loads', async () => {
    listPlayerAvailability.mockReturnValue(new Promise(() => undefined))
    renderPage()
    expect(await screen.findByRole('progressbar', { name: 'Loading coverage' })).toBeInTheDocument()
  })

  it('does not render cards until the leagues and teams have loaded', async () => {
    let releaseLeagues: (value: unknown) => void = () => undefined
    let releaseTeams: (value: unknown) => void = () => undefined
    listLeagues.mockReturnValue(new Promise((resolve) => (releaseLeagues = resolve)))
    listTeamsForClub.mockReturnValue(new Promise((resolve) => (releaseTeams = resolve)))
    renderPage()

    await waitFor(() => expect(listPlayerAvailability).toHaveBeenCalled())
    expect(screen.getByRole('progressbar', { name: 'Loading coverage' })).toBeInTheDocument()
    expect(screen.queryByTestId('slot-coverage-card')).not.toBeInTheDocument()

    releaseLeagues([{ id: 'league-1', name: 'Premier League', maxPlayingXiSize: 2 }])
    expect(screen.queryByTestId('slot-coverage-card')).not.toBeInTheDocument()
    releaseTeams([{ id: 'team-1', name: 'Villagers 1' }, { id: 'team-2', name: 'Villagers 2' }])
    await loaded()
    expect(screen.queryByText('No XI size')).not.toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })

  it('shows the error state, not No XI size cards, when the leagues or the teams fail to load', async () => {
    listLeagues.mockRejectedValue(new Error('boom'))
    const leagues = renderPage()
    expect(await screen.findByText("Couldn't load availability coverage")).toBeInTheDocument()
    expect(screen.queryByTestId('slot-coverage-card')).not.toBeInTheDocument()
    expect(screen.queryByText('No XI size')).not.toBeInTheDocument()
    leagues.unmount()

    listLeagues.mockResolvedValue([])
    listTeamsForClub.mockRejectedValue(new Error('boom'))
    renderPage()
    expect(await screen.findByText("Couldn't load availability coverage")).toBeInTheDocument()
    expect(screen.queryByText('Unknown team')).not.toBeInTheDocument()
  })

  it('ignores a team chosen on Polls or Players: it is not in the caption and the hub does not load teams for it', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ leagueId: null, sectionId: null, teamId: 'team-2' }))
    renderPage()

    const caption = await screen.findByText(/^Showing 3 slots/)
    expect(caption).not.toHaveTextContent('Villagers 2')
  })

  it('shows an error state when the grid fails', async () => {
    listPlayerAvailability.mockRejectedValue(new Error('boom'))
    renderPage()
    expect(await screen.findByText("Couldn't load availability coverage")).toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })

  it('says No games to cover when there are no games, or none with a club team', async () => {
    listPlayerAvailability.mockResolvedValue(makeResult({ games: [], players: [] }))
    const empty = renderPage()
    expect(await screen.findByText('No games to cover')).toBeInTheDocument()
    expect(screen.getByText(/Try another section or league, or turn on View entire season/)).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Legend' })).not.toBeInTheDocument()
    empty.unmount()

    listPlayerAvailability.mockResolvedValue(makeResult({ games: [makeGame({ matchId: 'mx', teamId: null })], players: [] }))
    renderPage()
    expect(await screen.findByText('No games to cover')).toBeInTheDocument()
  })

  it('says No polls yet with a Go to Polls button when games exist but none has a poll', async () => {
    const user = userEvent.setup()
    listPlayerAvailability.mockResolvedValue(makeResult({ games: [SUN_NO_POLL], players: [] }))
    renderPage()

    expect(await screen.findByText('No polls yet')).toBeInTheDocument()
    expect(screen.getByText('Open a poll for these games to see how many players you have.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Go to Polls' }))
    expect(await screen.findByText('Polls List')).toBeInTheDocument()
  })

  it('renders Not authorized without a club', () => {
    renderPage(null)
    expect(screen.getByText('Not authorized')).toBeInTheDocument()
  })
})
