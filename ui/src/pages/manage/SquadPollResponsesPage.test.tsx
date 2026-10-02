import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AxiosError } from 'axios'
import SquadPollResponsesPage from './SquadPollResponsesPage'
import { formatMatchDateTime } from './availability/pollHelpers'
import type { AvailabilityStatus, MatchAvailabilityPoll, MatchAvailabilityPollResponses } from '../../api/matchAvailabilityApi'
import type { Match } from '../../api/matchApi'
import type { Team } from '../../api/teamApi'

const listPolls = vi.fn()
const getPollResponses = vi.fn()
const setPlayerStatus = vi.fn()
const updatePollCloseTime = vi.fn()
const openPoll = vi.fn()
const getMatch = vi.fn()
const listTeamsForClub = vi.fn()

vi.mock('../../api/matchAvailabilityApi', async () => {
  const actual = await vi.importActual<typeof import('../../api/matchAvailabilityApi')>('../../api/matchAvailabilityApi')
  return {
    ...actual,
    listPolls: (clubId: string, matchId: string) => listPolls(clubId, matchId),
    getPollResponses: (clubId: string, matchId: string, pollId: string) => getPollResponses(clubId, matchId, pollId),
    setPlayerStatus: (clubId: string, matchId: string, pollId: string, playerId: string, status: string) =>
      setPlayerStatus(clubId, matchId, pollId, playerId, status),
    updatePollCloseTime: (clubId: string, matchId: string, pollId: string, payload: unknown) =>
      updatePollCloseTime(clubId, matchId, pollId, payload),
    openPoll: (clubId: string, matchId: string, pollId: string) => openPoll(clubId, matchId, pollId),
  }
})

vi.mock('../../api/matchApi', async () => {
  const actual = await vi.importActual<typeof import('../../api/matchApi')>('../../api/matchApi')
  return { ...actual, getMatch: (clubId: string, matchId: string) => getMatch(clubId, matchId) }
})

vi.mock('../../api/teamApi', async () => {
  const actual = await vi.importActual<typeof import('../../api/teamApi')>('../../api/teamApi')
  return { ...actual, listTeamsForClub: (clubId: string) => listTeamsForClub(clubId) }
})

const MATCH_DATE = '2030-06-06T09:00:00Z'

function makePoll(overrides: Partial<MatchAvailabilityPoll> = {}): MatchAvailabilityPoll {
  return {
    id: 'poll-1',
    teamId: 'team-home',
    open: true,
    autoClose: true,
    scheduledCloseAt: '2030-06-05T09:00:00Z',
    availableCount: 1,
    unavailableCount: 1,
    unsureCount: 1,
    noResponseCount: 1,
    ...overrides,
  }
}

function makeMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: 'match-1',
    clubId: 'test-club-id',
    homeTeamId: 'team-home',
    homeTeamName: null,
    awayTeamId: null,
    awayTeamName: 'Rivals CC',
    matchDate: MATCH_DATE,
    venue: 'Home Ground',
    ...overrides,
  } as Match
}

type Status = AvailabilityStatus | null

function row(id: string, firstName: string, lastName: string, squadJerseyNumber: number | null, status: Status) {
  return { playerProfileId: id, firstName, lastName, squadJerseyNumber, status }
}

const DEFAULT_ROWS = [
  row('player-1', 'Jane', 'Smith', 7, 'AVAILABLE'),
  row('player-2', 'Bob', 'Jones', null, 'UNSURE'),
  row('player-3', 'Amy', 'Lee', null, 'UNAVAILABLE'),
  row('player-4', 'Cal', 'Ng', null, null),
]

function makeResponses(overrides: Partial<MatchAvailabilityPollResponses> = {}): MatchAvailabilityPollResponses {
  return {
    pollId: 'poll-1',
    teamId: 'team-home',
    open: true,
    availableCount: 1,
    unavailableCount: 1,
    unsureCount: 1,
    noResponseCount: 1,
    responses: DEFAULT_ROWS,
    publicPath: '/poll/poll-1',
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  listPolls.mockResolvedValue([makePoll()])
  getPollResponses.mockResolvedValue(makeResponses())
  getMatch.mockResolvedValue(makeMatch())
  listTeamsForClub.mockResolvedValue([{ id: 'team-home', name: 'Home Team' } as Team])
})

function renderPage(clubId: string | null = 'test-club-id', matchId = 'match-1', pollId = 'poll-1') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/manage/availability/squad/${matchId}/${pollId}`]}>
        <Routes>
          <Route path="/manage" element={<Outlet context={{ clubId: clubId ?? undefined }} />}>
            <Route path="availability" element={<div>Polls List</div>} />
            <Route path="availability/squad/:matchId/:pollId" element={<SquadPollResponsesPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

// 09:00Z is Morning or Afternoon depending on the runner's zone, so match either.
const SLOT = /· (Morning|Afternoon)$/

function column(status: 'Available' | 'Unsure' | 'Unavailable') {
  return screen.getByRole('region', { name: new RegExp(`^${status} players, .*(Morning|Afternoon)$`) })
}

async function loaded() {
  await screen.findByRole('heading', { level: 1, name: 'Home Team vs Rivals CC' })
}

describe('SquadPollResponsesPage', () => {
  it('renders the header with title, badges, subtitle, close time and the Open match link', async () => {
    renderPage()
    await loaded()

    expect(screen.getByText('Squad poll')).toBeInTheDocument()
    expect(screen.getByText('Open')).toBeInTheDocument()
    expect(screen.getByText('Home')).toBeInTheDocument()
    expect(screen.getByText(`${formatMatchDateTime(MATCH_DATE)} · Home Ground`)).toBeInTheDocument()
    expect(screen.getByText(/^Closes /)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit close time' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /open match/i })).toHaveAttribute(
      'href',
      '/manage/fixtures/matches/match-1/edit?tab=availability&side=home',
    )
    expect(screen.getByRole('link', { name: /back to availability polls/i })).toHaveAttribute('href', '/manage/availability')
  })

  it('shows Venue TBC, the Away badge and the away side in the Open match link', async () => {
    listPolls.mockResolvedValue([makePoll({ teamId: 'team-away' })])
    getPollResponses.mockResolvedValue(makeResponses({ teamId: 'team-away' }))
    getMatch.mockResolvedValue(makeMatch({ venue: null, homeTeamId: 'team-other', awayTeamId: 'team-away', awayTeamName: null, homeTeamName: null }))
    listTeamsForClub.mockResolvedValue([
      { id: 'team-other', name: 'Other Team' } as Team,
      { id: 'team-away', name: 'Away Team' } as Team,
    ])
    renderPage()
    await screen.findByRole('heading', { level: 1, name: 'Other Team vs Away Team' })

    expect(screen.getByText('Away')).toBeInTheDocument()
    expect(screen.getByText(/ · Venue TBC$/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /open match/i })).toHaveAttribute(
      'href',
      '/manage/fixtures/matches/match-1/edit?tab=availability&side=away',
    )
  })

  it('waits for the teams before painting, so the title is never "Unknown team"', async () => {
    let resolveTeams: (teams: Team[]) => void = () => {}
    listTeamsForClub.mockReturnValue(new Promise<Team[]>((resolve) => { resolveTeams = resolve }))
    renderPage()
    await waitFor(() => expect(listTeamsForClub).toHaveBeenCalled())
    await waitFor(() => expect(getMatch).toHaveBeenCalled())
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument()

    resolveTeams([{ id: 'team-home', name: 'Home Team' } as Team])
    await loaded()
    expect(screen.queryByText(/Unknown team/)).not.toBeInTheDocument()
  })

  it('still renders when the teams fail to load (non-blocking)', async () => {
    listTeamsForClub.mockRejectedValue(new AxiosError('Boom', 'ERR_BAD_REQUEST'))
    renderPage()

    expect(await screen.findByRole('heading', { level: 1, name: 'Unknown team vs Rivals CC' })).toBeInTheDocument()
  })

  it('says "Closes manually" when the poll does not autoclose', async () => {
    listPolls.mockResolvedValue([makePoll({ autoClose: false, scheduledCloseAt: null })])
    renderPage()
    await loaded()

    expect(screen.getByText('Closes manually')).toBeInTheDocument()
  })

  it('defaults to Time slot with one slot block, its match line and the groups', async () => {
    renderPage()
    await loaded()

    expect(screen.getByRole('button', { name: 'Time slot' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 3, name: SLOT })).toBeInTheDocument()
    expect(screen.getByText(/Home Team v Rivals CC/)).toBeInTheDocument()
    expect(within(column('Available')).getByText('Jane Smith')).toBeInTheDocument()
    expect(within(column('Available')).getByText('#7')).toBeInTheDocument()
    expect(within(column('Unsure')).getByText('Bob Jones')).toBeInTheDocument()
    expect(within(column('Unavailable')).getByText('Amy Lee')).toBeInTheDocument()
  })

  it('collapses No response to its count and expands it', async () => {
    const user = userEvent.setup()
    renderPage()
    await loaded()

    expect(screen.getByRole('heading', { level: 4, name: 'No response (1)' })).toBeInTheDocument()
    expect(screen.queryByText('Cal Ng')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /show no response players/i }))
    expect(screen.getByText('Cal Ng')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /hide no response players/i }))
    expect(screen.queryByText('Cal Ng')).not.toBeInTheDocument()
  })

  it('search filters the Time slot groups', async () => {
    const user = userEvent.setup()
    renderPage()
    await loaded()

    await user.type(screen.getByLabelText('Search players'), 'jane')

    expect(screen.getByText('Jane Smith')).toBeInTheDocument()
    expect(screen.queryByText('Bob Jones')).not.toBeInTheDocument()
    expect(screen.queryByText('Amy Lee')).not.toBeInTheDocument()
  })

  it('shows the Player view, sorted by name, and hides players who have not answered', async () => {
    const user = userEvent.setup()
    renderPage()
    await loaded()
    await user.click(screen.getByRole('button', { name: 'Player' }))

    const table = screen.getByRole('table', { name: 'Responses by player' })
    expect(within(table).getAllByRole('columnheader')).toHaveLength(3)
    const bodyRows = within(table).getAllByRole('row').slice(1)
    expect(bodyRows.map((r) => within(r).getAllByRole('cell')[1].textContent)).toEqual(['Bob Jones', 'Amy Lee', 'Cal Ng', 'Jane Smith'])

    await user.click(screen.getByRole('checkbox', { name: "Hide players who haven't answered" }))
    expect(screen.queryByText('Cal Ng')).not.toBeInTheDocument()
    expect(screen.getByText('Jane Smith')).toBeInTheDocument()
  })

  it('shows Summary with the counts and "N of M answered", unaffected by search', async () => {
    const user = userEvent.setup()
    renderPage()
    await loaded()
    await user.type(screen.getByLabelText('Search players'), 'jane')
    await user.click(screen.getByRole('button', { name: 'Summary' }))

    expect(screen.getByText('Available 1')).toBeInTheDocument()
    expect(screen.getByText('Unsure 1')).toBeInTheDocument()
    expect(screen.getByText('Unavailable 1')).toBeInTheDocument()
    expect(screen.getByText('No response 1')).toBeInTheDocument()
    expect(screen.getByText('3 of 4 answered')).toBeInTheDocument()
    expect(screen.getByTestId('poll-1-bar-AVAILABLE')).toHaveStyle({ width: '25%' })
    expect(screen.getByTestId('poll-1-bar-NONE')).toHaveStyle({ width: '25%' })
  })

  it('shows the squad empty text when there are no players', async () => {
    getPollResponses.mockResolvedValue(makeResponses({ responses: [] }))
    renderPage()
    await loaded()

    expect(screen.getByText('No players in this squad yet.')).toBeInTheDocument()
  })

  it('overrides a player on an open poll with the right ids and moves them to the new group', async () => {
    const user = userEvent.setup()
    const updated = makeResponses({
      availableCount: 0,
      unsureCount: 2,
      responses: [row('player-1', 'Jane', 'Smith', 7, 'UNSURE'), ...DEFAULT_ROWS.slice(1)],
    })
    setPlayerStatus.mockResolvedValueOnce(updated)
    renderPage()
    await loaded()
    // The refetch after the save returns the moved player, as the real backend does.
    getPollResponses.mockResolvedValue(updated)

    await user.click(within(column('Available')).getByLabelText(/Set Jane Smith's.*availability/i))
    await user.click(await screen.findByRole('menuitem', { name: 'Unsure' }))

    expect(setPlayerStatus).toHaveBeenCalledWith('test-club-id', 'match-1', 'poll-1', 'player-1', 'UNSURE')
    await waitFor(() => expect(within(column('Unsure')).getByText('Jane Smith')).toBeInTheDocument())
    expect(within(column('Available')).queryByText('Jane Smith')).not.toBeInTheDocument()
    expect(within(column('Available')).getByText('None')).toBeInTheDocument()
  })

  it('keeps overrides enabled on a closed poll, with the manager-correction note', async () => {
    const user = userEvent.setup()
    listPolls.mockResolvedValue([makePoll({ open: false })])
    getPollResponses.mockResolvedValue(makeResponses({ open: false }))
    const updated = makeResponses({
      open: false,
      availableCount: 0,
      unavailableCount: 2,
      responses: [row('player-1', 'Jane', 'Smith', 7, 'UNAVAILABLE'), ...DEFAULT_ROWS.slice(1)],
    })
    setPlayerStatus.mockResolvedValueOnce(updated)
    renderPage()
    await loaded()

    expect(screen.getByText('Closed')).toBeInTheDocument()
    expect(screen.getByText('This poll is closed. Changes are recorded as a manager correction.')).toBeInTheDocument()
    const chip = within(column('Available')).getByLabelText(/Set Jane Smith's.*availability/i)
    expect(chip).not.toHaveAttribute('aria-disabled', 'true')
    getPollResponses.mockResolvedValue(updated)
    await user.click(chip)
    await user.click(await screen.findByRole('menuitem', { name: 'Unavailable' }))

    expect(setPlayerStatus).toHaveBeenCalledWith('test-club-id', 'match-1', 'poll-1', 'player-1', 'UNAVAILABLE')
    await waitFor(() => expect(within(column('Unavailable')).getByText('Jane Smith')).toBeInTheDocument())
  })

  it('shows the server error when an override fails', async () => {
    const user = userEvent.setup()
    setPlayerStatus.mockRejectedValueOnce(
      new AxiosError('Conflict', 'ERR_BAD_REQUEST', undefined, undefined, {
        status: 409,
        statusText: 'Conflict',
        data: { detail: 'Poll is closed.' },
        headers: {},
        config: {} as never,
      }),
    )
    renderPage()
    await loaded()

    await user.click(within(column('Available')).getByLabelText(/Set Jane Smith's.*availability/i))
    await user.click(await screen.findByRole('menuitem', { name: 'Unsure' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Poll is closed.')
  })

  it('opens Edit close time in squad mode and saves the chosen close time', async () => {
    const user = userEvent.setup()
    updatePollCloseTime.mockResolvedValue(makePoll())
    renderPage()
    await loaded()

    await user.click(screen.getByRole('button', { name: 'Edit close time' }))
    expect(await screen.findByRole('heading', { name: 'Edit close time' })).toBeInTheDocument()
    await user.click(screen.getByRole('checkbox', { name: 'Autoclose' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(updatePollCloseTime).toHaveBeenCalledWith('test-club-id', 'match-1', 'poll-1', { autoClose: false, scheduledCloseAt: null }),
    )
  })

  it('opens the dialog in Reopen mode on a closed poll, saving then opening', async () => {
    const user = userEvent.setup()
    listPolls.mockResolvedValue([makePoll({ open: false, autoClose: false, scheduledCloseAt: null })])
    getPollResponses.mockResolvedValue(makeResponses({ open: false }))
    updatePollCloseTime.mockResolvedValue(makePoll())
    openPoll.mockResolvedValue(makePoll())
    renderPage()
    await loaded()

    await user.click(screen.getByRole('button', { name: 'Edit close time' }))
    expect(await screen.findByRole('heading', { name: 'Reopen this poll' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Reopen' }))

    await waitFor(() => expect(openPoll).toHaveBeenCalledWith('test-club-id', 'match-1', 'poll-1'))
    expect(updatePollCloseTime).toHaveBeenCalledWith('test-club-id', 'match-1', 'poll-1', { autoClose: false, scheduledCloseAt: null })
  })

  it('opens the share dialog with the side\'s team name and the poll link', async () => {
    const user = userEvent.setup()
    renderPage()
    await loaded()

    await user.click(screen.getByRole('button', { name: /share invite/i }))

    const textarea = (await screen.findByLabelText('Invite text')) as HTMLTextAreaElement
    expect(textarea.value).toContain('Hi Home Team!')
    expect(textarea.value).toContain('/poll/poll-1')
  })

  it('goes back to the polls list', async () => {
    const user = userEvent.setup()
    renderPage()
    await loaded()

    await user.click(screen.getByRole('link', { name: /back to availability polls/i }))

    expect(await screen.findByText('Polls List')).toBeInTheDocument()
  })

  it('shows a clean not-found state when the poll is missing from the match', async () => {
    renderPage('test-club-id', 'match-1', 'missing-poll')

    expect(await screen.findByText("Couldn't load this poll")).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Squad poll' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /back to availability polls/i })).toBeInTheDocument()
  })

  it('shows the same state when the match is missing', async () => {
    getMatch.mockRejectedValue(new AxiosError('Not found', 'ERR_BAD_REQUEST'))
    renderPage()

    expect(await screen.findByText("Couldn't load this poll")).toBeInTheDocument()
  })

  it('shows the same state when the responses fail to load', async () => {
    getPollResponses.mockRejectedValue(new AxiosError('Not found', 'ERR_BAD_REQUEST'))
    renderPage()

    expect(await screen.findByText("Couldn't load this poll")).toBeInTheDocument()
  })

  it('renders "Not authorized" and fetches nothing without a club', () => {
    renderPage(null)

    expect(screen.getByText('Not authorized')).toBeInTheDocument()
    expect(getPollResponses).not.toHaveBeenCalled()
    expect(listPolls).not.toHaveBeenCalled()
  })
})
