import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AxiosError } from 'axios'
import AvailabilityPollsDashboard from './AvailabilityPollsDashboard'
import { POLL_CARD_GRID_TEMPLATE_COLUMNS } from '../../utils/cardGrid'
import type { OpenAvailabilityPoll } from '../../api/matchAvailabilityApi'
import type {
  SectionAvailabilityRound,
  SectionAvailabilityRoundMatch,
} from '../../api/sectionAvailabilityApi'
import type { Team } from '../../api/teamApi'
import { legend } from '../../test/legend'

const listOpenPolls = vi.fn()
const listClosedPolls = vi.fn()
const openPoll = vi.fn()
const updatePollCloseTime = vi.fn()
const updateRoundCloseTime = vi.fn()
const closePoll = vi.fn()
const deletePoll = vi.fn()
const listRounds = vi.fn()
const openRound = vi.fn()
const closeRound = vi.fn()
const deleteRound = vi.fn()
const getRoundMatches = vi.fn()
const getRoundResponses = vi.fn()
const updateRoundDescription = vi.fn()
const listTeamsForClub = vi.fn()
const listSections = vi.fn()

vi.mock('../../api/matchAvailabilityApi', () => ({
  listOpenPolls: (clubId: string, params: unknown) => listOpenPolls(clubId, params),
  listClosedPolls: (clubId: string, params: unknown) => listClosedPolls(clubId, params),
  openPoll: (clubId: string, matchId: string, pollId: string) => openPoll(clubId, matchId, pollId),
  updatePollCloseTime: (clubId: string, matchId: string, pollId: string, payload: unknown) =>
    updatePollCloseTime(clubId, matchId, pollId, payload),
  closePoll: (clubId: string, matchId: string, pollId: string) => closePoll(clubId, matchId, pollId),
  deletePoll: (clubId: string, matchId: string, pollId: string) => deletePoll(clubId, matchId, pollId),
}))

vi.mock('../../api/sectionAvailabilityApi', async () => {
  const actual = await vi.importActual<typeof import('../../api/sectionAvailabilityApi')>(
    '../../api/sectionAvailabilityApi',
  )
  return {
    ...actual,
    listRounds: (clubId: string, params: unknown) => listRounds(clubId, params),
    openRound: (clubId: string, roundId: string) => openRound(clubId, roundId),
    updateRoundCloseTime: (clubId: string, roundId: string, payload: unknown) =>
      updateRoundCloseTime(clubId, roundId, payload),
    closeRound: (clubId: string, roundId: string) => closeRound(clubId, roundId),
    deleteRound: (clubId: string, roundId: string) => deleteRound(clubId, roundId),
    getRoundMatches: (clubId: string, roundId: string) => getRoundMatches(clubId, roundId),
    getRoundResponses: (clubId: string, roundId: string) => getRoundResponses(clubId, roundId),
    updateRoundDescription: (clubId: string, roundId: string, description: string) =>
      updateRoundDescription(clubId, roundId, description),
  }
})

vi.mock('../../api/teamApi', () => ({
  listTeamsForClub: (clubId: string) => listTeamsForClub(clubId),
}))

vi.mock('../../api/sectionApi', () => ({
  listSections: (clubId: string) => listSections(clubId),
}))

beforeEach(() => {
  vi.clearAllMocks()
  listTeamsForClub.mockResolvedValue([])
  listSections.mockResolvedValue([])
  listOpenPolls.mockResolvedValue([])
  listClosedPolls.mockResolvedValue([])
  listRounds.mockResolvedValue([])
  getRoundMatches.mockResolvedValue([])
  // docs/specs/043-list-toolbar-gold-standard.md: this screen's Section filter persists via
  // usePersistedListFilters — clear the real jsdom localStorage so a selection made in one test
  // never leaks into the next.
  localStorage.clear()
})

function makeTeam(overrides: Partial<Team> = {}): Team {
  return {
    id: 'team-home',
    clubId: 'test-club-id',
    sectionId: 'section-1',
    name: 'Home Team',
    logoUrl: null,
    abbreviation: null,
    groundName: null,
    socialLinks: [],
    active: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: null,
    ...overrides,
  }
}

function makePoll(overrides: Partial<OpenAvailabilityPoll> = {}): OpenAvailabilityPoll {
  return {
    pollId: 'poll-1',
    matchId: 'match-1',
    teamId: 'team-home',
    homeTeamId: 'team-home',
    homeTeamName: null,
    awayTeamId: null,
    awayTeamName: 'Rivals CC',
    matchDate: '2026-06-01T09:00:00Z',
    venue: 'Home Ground',
    autoClose: true,
    scheduledCloseAt: '2026-05-31T09:00:00Z',
    canReopen: true,
    availableCount: 2,
    unavailableCount: 1,
    unsureCount: 0,
    noResponseCount: 3,
    availableRespondents: [
      { playerProfileId: 'p1', firstName: 'Jane', lastName: 'Smith', squadJerseyNumber: 7 },
      { playerProfileId: 'p2', firstName: 'Bob', lastName: 'Jones', squadJerseyNumber: null },
    ],
    unavailableRespondents: [{ playerProfileId: 'p3', firstName: 'Amy', lastName: 'Lee', squadJerseyNumber: null }],
    unsureRespondents: [],
    ...overrides,
  }
}

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
    brackets: [
      {
        dayPart: 'MORNING',
        windowDate: '2026-06-06',
        windowId: 'window-1',
        availableCount: 5,
        unavailableCount: 1,
        unsureCount: 0,
        noResponseCount: 2,
        coveredMatchCount: 2,
      },
      {
        dayPart: 'AFTERNOON',
        windowDate: '2026-06-06',
        windowId: 'window-2',
        availableCount: 3,
        unavailableCount: 0,
        unsureCount: 1,
        noResponseCount: 4,
        coveredMatchCount: 1,
      },
    ],
    ...overrides,
  }
}

function makeRoundMatch(overrides: Partial<SectionAvailabilityRoundMatch> = {}): SectionAvailabilityRoundMatch {
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

function conflictError(message: string) {
  return new AxiosError('Conflict', 'ERR_BAD_REQUEST', undefined, undefined, {
    status: 409,
    statusText: 'Conflict',
    data: { detail: message },
    headers: {},
    config: {} as never,
  })
}

function serverError(message: string) {
  return new AxiosError('Server error', 'ERR_BAD_RESPONSE', undefined, undefined, {
    status: 500,
    statusText: 'Internal Server Error',
    data: { detail: message },
    headers: {},
    config: {} as never,
  })
}

function OutletContextWrapper({ clubId }: { clubId?: string }) {
  return <Outlet context={{ clubId }} />
}

function LocationProbe() {
  const location = useLocation()
  return <div>{`Match page ${location.pathname}${location.search}`}</div>
}

function SquadResponsesProbe() {
  const { matchId, pollId } = useParams()
  return <div>{`Squad responses page ${matchId} ${pollId}`}</div>
}

function renderDashboard(clubId?: string, initialUrl = '/manage/availability') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialUrl]}>
        <Routes>
          <Route path="/manage" element={<OutletContextWrapper clubId={clubId} />}>
            <Route path="availability" element={<AvailabilityPollsDashboard />} />
            <Route path="availability/new" element={<div>New Poll Page</div>} />
            <Route path="fixtures/matches/:matchId/edit" element={<LocationProbe />} />
            <Route path="availability/group/:roundId" element={<div>Group Poll Responses Page</div>} />
            <Route path="availability/squad/:matchId/:pollId" element={<SquadResponsesProbe />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('AvailabilityPollsDashboard', () => {
  it('renders "Not authorized" and does not fetch when no clubId is in the Outlet context', () => {
    renderDashboard(undefined)

    expect(screen.getByText('Not authorized')).toBeInTheDocument()
    expect(listOpenPolls).not.toHaveBeenCalled()
  })

  it('renders the empty state when the club has no open polls', async () => {
    listOpenPolls.mockResolvedValueOnce([])

    renderDashboard('test-club-id')

    expect(await screen.findByText('No open polls')).toBeInTheDocument()
    expect(
      screen.getByText("Open a squad poll for one team's match, or a group poll for a whole section's fixtures."),
    ).toBeInTheDocument()
  })

  it('renders an error state when the fetch fails', async () => {
    listOpenPolls.mockRejectedValueOnce(new Error('network error'))

    renderDashboard('test-club-id')

    expect(await screen.findByText("Couldn't load availability polls")).toBeInTheDocument()
  })

  it('renders a squad poll as the unified card: header, subtitle, one slot summary, Closes row and the four footer buttons', async () => {
    listTeamsForClub.mockResolvedValue([makeTeam({ id: 'team-home', name: 'Home Team' })])
    listOpenPolls.mockResolvedValueOnce([makePoll()])

    renderDashboard('test-club-id')

    expect(await screen.findByRole('heading', { level: 3, name: 'Home Team vs Rivals CC' })).toBeInTheDocument()
    expect(screen.getByText('Squad poll')).toBeInTheDocument()
    expect(screen.getByText('Open')).toBeInTheDocument()
    expect(screen.getByText('Home')).toBeInTheDocument()
    // Subtitle: the shared date style plus the venue, never the raw locale string.
    expect(screen.getByText(/ · Home Ground$/)).toBeInTheDocument()
    expect(screen.getByText(legend('Available 2'))).toBeInTheDocument()
    expect(screen.getByText(legend('Unavailable 1'))).toBeInTheDocument()
    expect(screen.getByText(legend('Unsure 0'))).toBeInTheDocument()
    expect(screen.getByText(legend('No response 3'))).toBeInTheDocument()
    expect(screen.getByText('3 of 6 answered')).toBeInTheDocument()
    // 09:00Z is MORNING in a zone up to UTC+2; assert only that a slot heading is shown.
    expect(screen.getByRole('heading', { level: 4, name: /· (Morning|Afternoon)$/ })).toBeInTheDocument()
    expect(screen.getByTestId('poll-1-bar-AVAILABLE')).toHaveStyle({ width: `${(2 / 6) * 100}%` })
    expect(screen.getByText('Poll closes')).toBeInTheDocument()
    expect(screen.getAllByRole('button').filter((b) => ['Close poll', 'Matches', 'Responses', 'Share invite'].includes(b.getAttribute('aria-label') ?? '')).map((b) => b.getAttribute('aria-label'))).toEqual(['Close poll', 'Matches', 'Responses', 'Share invite'])
  })

  it("a squad card's Responses button goes to the squad poll's Responses page", async () => {
    const user = userEvent.setup()
    listTeamsForClub.mockResolvedValue([makeTeam({ id: 'team-home', name: 'Home Team' })])
    listOpenPolls.mockResolvedValueOnce([
      makePoll({
        pollId: 'poll-away',
        matchId: 'match-2',
        teamId: 'team-away',
        homeTeamId: 'team-home',
        awayTeamId: 'team-away',
        awayTeamName: null,
      }),
    ])

    renderDashboard('test-club-id')

    await user.click(await screen.findByRole('button', { name: 'Responses' }))
    expect(
      await screen.findByText('Squad responses page match-2 poll-away'),
    ).toBeInTheDocument()
  })

  it('the grid stretches every card to the tallest in its row', async () => {
    listTeamsForClub.mockResolvedValue([makeTeam()])
    listOpenPolls.mockResolvedValueOnce([makePoll()])
    renderDashboard('test-club-id')

    const heading = await screen.findByRole('heading', { level: 3, name: 'Home Team vs Rivals CC' })
    const card = heading.closest('.MuiCard-root') as HTMLElement
    // The RecordCard is the grid item itself (no wrapper) so its 100% height resolves.
    expect(card.parentElement).toHaveStyle({ display: 'grid', alignItems: 'stretch' })
    expect(card).toHaveStyle({ height: '100%' })
  })

  it('selecting a section in the filter re-fetches with the sectionId param, clearing it removes it', async () => {
    const user = userEvent.setup()
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
    listOpenPolls.mockResolvedValue([])

    renderDashboard('test-club-id')

    await screen.findByText('No open polls')
    expect(listOpenPolls).toHaveBeenCalledWith('test-club-id', { sectionId: undefined })

    await user.click(screen.getByLabelText('Section'))
    await user.click(within(screen.getByRole('treeitem', { name: 'Juniors' })).getByText('Juniors'))

    expect(await screen.findByLabelText('Section')).toHaveValue('Juniors')
    await waitFor(() => expect(listOpenPolls).toHaveBeenCalledWith('test-club-id', { sectionId: 'section-1' }))

    await user.click(screen.getByLabelText('Section'))
    await user.click(screen.getByRole('button', { name: /all sections/i }))

    await waitFor(() =>
      expect(listOpenPolls).toHaveBeenLastCalledWith('test-club-id', { sectionId: undefined }),
    )
  })

  // docs/specs/043-list-toolbar-gold-standard.md: this screen gains a real Search box for the
  // first time — it must filter client-side by the resolved home/away team name, the same names
  // PollCard's own title already shows.
  it('filters polls by the resolved home/away team name typed into Search', async () => {
    const user = userEvent.setup()
    listTeamsForClub.mockResolvedValue([
      makeTeam({ id: 'team-home', name: 'Home Team' }),
      makeTeam({ id: 'team-other', name: 'Other Team' }),
    ])
    listOpenPolls.mockResolvedValueOnce([
      makePoll({ pollId: 'poll-1', homeTeamId: 'team-home', awayTeamId: null, awayTeamName: 'Rivals CC' }),
      makePoll({
        pollId: 'poll-2',
        teamId: 'team-other',
        homeTeamId: 'team-other',
        awayTeamId: null,
        awayTeamName: 'Someone Else',
      }),
    ])

    renderDashboard('test-club-id')

    await screen.findByRole('heading', { name: 'Home Team vs Rivals CC' })
    expect(screen.getByRole('heading', { name: 'Other Team vs Someone Else' })).toBeInTheDocument()

    await user.type(screen.getByLabelText('Search'), 'Rivals')

    expect(await screen.findByRole('heading', { name: 'Home Team vs Rivals CC' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Other Team vs Someone Else' })).not.toBeInTheDocument()
  })

  // docs/specs/043-list-toolbar-gold-standard.md: this screen gains a real Sort control for the
  // first time — default ascending (soonest-upcoming poll first), reversible via the icon toggle.
  it('sorts polls by match date, soonest-first by default, and reverses on the sort icon', async () => {
    const user = userEvent.setup()
    listTeamsForClub.mockResolvedValue([makeTeam({ id: 'team-home', name: 'Home Team' })])
    listOpenPolls.mockResolvedValueOnce([
      makePoll({ pollId: 'poll-later', matchDate: '2026-08-01T09:00:00Z', awayTeamName: 'Later Rivals' }),
      makePoll({ pollId: 'poll-sooner', matchDate: '2026-06-01T09:00:00Z', awayTeamName: 'Sooner Rivals' }),
    ])

    renderDashboard('test-club-id')

    await screen.findByRole('heading', { name: 'Home Team vs Sooner Rivals' })
    expect(screen.getAllByRole('heading', { level: 3 }).map((el) => el.textContent)).toEqual([
      'Home Team vs Sooner Rivals',
      'Home Team vs Later Rivals',
    ])
    expect(screen.getByRole('button', { name: 'Match date, latest first' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Match date, latest first' }))

    expect(screen.getAllByRole('heading', { level: 3 }).map((el) => el.textContent)).toEqual([
      'Home Team vs Later Rivals',
      'Home Team vs Sooner Rivals',
    ])
    expect(screen.getByRole('button', { name: 'Match date, soonest first' })).toBeInTheDocument()
  })

  // docs/specs/043-list-toolbar-gold-standard.md: Section selection persists per club across
  // visits, for the first time on this screen — Search stays a separate, non-persisted useState.
  // Mirrors MatchList.test.tsx's own persistence assertions.
  it('reapplies a persisted section filter on mount, and never persists the search text', async () => {
    const user = userEvent.setup()
    listOpenPolls.mockResolvedValue([])
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
    localStorage.setItem(
      'availabilityPolls:filters:test-club-id',
      JSON.stringify({ sectionId: 'section-1', type: 'ALL' }),
    )

    renderDashboard('test-club-id')

    await waitFor(() => expect(listOpenPolls).toHaveBeenCalledWith('test-club-id', { sectionId: 'section-1' }))
    expect(await screen.findByLabelText('Section')).toHaveValue('Juniors')

    await user.type(screen.getByLabelText('Search'), 'Rivals')

    const persisted = JSON.parse(localStorage.getItem('availabilityPolls:filters:test-club-id') as string)
    expect(persisted).toEqual({ sectionId: 'section-1', type: 'ALL' })
    expect(persisted).not.toHaveProperty('search')
  })

  it('renders no page header of its own (the hub layout owns it, 073)', async () => {
    renderDashboard('test-club-id')

    await screen.findByText('No open polls')
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /back to dashboard/i })).not.toBeInTheDocument()
  })

  it('has a New poll primary action that navigates to /manage/availability/new', async () => {
    const user = userEvent.setup()
    renderDashboard('test-club-id')

    await screen.findByText('No open polls')
    await user.click(screen.getAllByRole('button', { name: 'New poll' })[0])

    expect(await screen.findByText('New Poll Page')).toBeInTheDocument()
  })

  describe('merged squad + group list (064)', () => {
    it('renders both kinds with their own type badges, requesting only open rounds', async () => {
      listTeamsForClub.mockResolvedValue([makeTeam()])
      listOpenPolls.mockResolvedValue([makePoll()])
      listRounds.mockResolvedValue([makeRound()])

      renderDashboard('test-club-id')

      expect(await screen.findByRole('heading', { name: 'Home Team vs Rivals CC' })).toBeInTheDocument()
      expect(await screen.findByRole('heading', { name: 'Sat 6 Jun - U13 Boys fixtures' })).toBeInTheDocument()
      expect(screen.getByText('Squad poll')).toBeInTheDocument()
      expect(screen.getByText('Group poll')).toBeInTheDocument()
      expect(screen.getAllByText('Open')).toHaveLength(2)
      expect(listRounds).toHaveBeenCalledWith('test-club-id', { sectionId: undefined, open: true })
    })

    it('orders both kinds together by soonest covered match, reversible with the sort toggle', async () => {
      const user = userEvent.setup()
      listTeamsForClub.mockResolvedValue([makeTeam()])
      listOpenPolls.mockResolvedValue([makePoll({ matchDate: '2026-06-10T09:00:00Z' })])
      listRounds.mockResolvedValue([makeRound({ firstMatchDate: '2026-06-06T09:00:00Z' })])

      renderDashboard('test-club-id')

      await screen.findByRole('heading', { name: 'Home Team vs Rivals CC' })
      await screen.findByRole('heading', { name: 'Sat 6 Jun - U13 Boys fixtures' })
      expect(screen.getAllByRole('heading', { level: 3 }).map((el) => el.textContent)).toEqual([
        'Sat 6 Jun - U13 Boys fixtures',
        'Home Team vs Rivals CC',
      ])

      await user.click(screen.getByRole('button', { name: 'Match date, latest first' }))

      expect(screen.getAllByRole('heading', { level: 3 }).map((el) => el.textContent)).toEqual([
        'Home Team vs Rivals CC',
        'Sat 6 Jun - U13 Boys fixtures',
      ])
    })

    it('squad card shows a Poll closes line with the close time, or "Manually" when autoclose is off', async () => {
      listTeamsForClub.mockResolvedValue([makeTeam()])
      listOpenPolls.mockResolvedValue([
        makePoll({ pollId: 'poll-auto', matchId: 'm1', awayTeamName: 'Auto CC' }),
        makePoll({ pollId: 'poll-manual', matchId: 'm2', awayTeamName: 'Manual CC', autoClose: false, scheduledCloseAt: null }),
      ])

      renderDashboard('test-club-id')

      await screen.findByRole('heading', { name: 'Home Team vs Manual CC' })
      expect(screen.getByText('Manually')).toBeInTheDocument()
      expect(screen.getAllByText('Poll closes')).toHaveLength(2)
    })

    it('Type filter narrows to one kind, persists with the section, and skips the other query', async () => {
      const user = userEvent.setup()
      listTeamsForClub.mockResolvedValue([makeTeam()])
      listOpenPolls.mockResolvedValue([makePoll()])
      listRounds.mockResolvedValue([makeRound()])

      renderDashboard('test-club-id')

      await screen.findByRole('heading', { name: 'Sat 6 Jun - U13 Boys fixtures' })
      await user.click(screen.getByLabelText('Type'))
      await user.click(await screen.findByRole('option', { name: 'Group polls' }))

      expect(screen.queryByRole('heading', { name: 'Home Team vs Rivals CC' })).not.toBeInTheDocument()
      expect(screen.getByRole('heading', { name: 'Sat 6 Jun - U13 Boys fixtures' })).toBeInTheDocument()
      expect(JSON.parse(localStorage.getItem('availabilityPolls:filters:test-club-id') as string)).toEqual({
        sectionId: null,
        type: 'GROUP',
      })

      await user.click(screen.getByLabelText('Type'))
      await user.click(await screen.findByRole('option', { name: 'Squad polls' }))

      expect(await screen.findByRole('heading', { name: 'Home Team vs Rivals CC' })).toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: 'Sat 6 Jun - U13 Boys fixtures' })).not.toBeInTheDocument()
    })

    it('search matches a group poll by description and a squad poll by team/opponent', async () => {
      const user = userEvent.setup()
      listTeamsForClub.mockResolvedValue([makeTeam()])
      listOpenPolls.mockResolvedValue([makePoll()])
      listRounds.mockResolvedValue([makeRound()])

      renderDashboard('test-club-id')

      await screen.findByRole('heading', { name: 'Sat 6 Jun - U13 Boys fixtures' })
      await user.type(screen.getByLabelText('Search'), 'fixtures')

      expect(await screen.findByRole('heading', { name: 'Sat 6 Jun - U13 Boys fixtures' })).toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: 'Home Team vs Rivals CC' })).not.toBeInTheDocument()
    })
  })

  describe('show closed polls (064)', () => {
    // Manual-close polls (autoClose off) are always reopenable, whatever today's date.
    const closedSquad = () =>
      makePoll({
        pollId: 'poll-closed',
        matchId: 'match-9',
        matchDate: '2026-05-01T09:00:00Z',
        autoClose: false,
        scheduledCloseAt: null,
      })
    const closedRound = () =>
      makeRound({
        id: 'round-closed',
        description: 'Closed group poll',
        open: false,
        firstMatchDate: '2026-05-02T09:00:00Z',
        autoClose: false,
        scheduledCloseAt: null,
      })

    it('is off by default: no closed fetches, only open rounds requested, and a fresh visit resets it', async () => {
      const user = userEvent.setup()
      const first = renderDashboard('test-club-id')
      await screen.findByText('No open polls')
      const toggle = screen.getByRole('checkbox', { name: 'Show closed polls' })
      expect(toggle).not.toBeChecked()
      expect(listClosedPolls).not.toHaveBeenCalled()
      expect(listRounds).not.toHaveBeenCalledWith('test-club-id', { sectionId: undefined, open: false })

      await user.click(toggle)
      expect(await screen.findByText('No polls')).toBeInTheDocument()
      first.unmount()

      renderDashboard('test-club-id')
      await screen.findByText('No open polls')
      expect(screen.getByRole('checkbox', { name: 'Show closed polls' })).not.toBeChecked()
    })

    it('turning it on fetches closed squad and group polls and merges them with the open ones, with Closed badges', async () => {
      const user = userEvent.setup()
      listTeamsForClub.mockResolvedValue([makeTeam()])
      listOpenPolls.mockResolvedValue([makePoll()])
      listClosedPolls.mockResolvedValue([closedSquad()])
      listRounds.mockImplementation((_clubId: string, params: { open: boolean }) =>
        Promise.resolve(params.open ? [makeRound()] : [closedRound()]),
      )

      renderDashboard('test-club-id')
      await screen.findByRole('heading', { name: 'Home Team vs Rivals CC' })
      expect(screen.queryByText('Closed')).not.toBeInTheDocument()

      await user.click(screen.getByRole('checkbox', { name: 'Show closed polls' }))

      expect(await screen.findByRole('heading', { name: 'Closed group poll' })).toBeInTheDocument()
      expect(listClosedPolls).toHaveBeenCalledWith('test-club-id', { sectionId: undefined })
      expect(listRounds).toHaveBeenCalledWith('test-club-id', { sectionId: undefined, open: false })
      expect(screen.getAllByRole('heading', { name: 'Home Team vs Rivals CC' })).toHaveLength(2)
      expect(screen.getAllByText('Closed')).toHaveLength(2)
      expect(screen.getAllByText('Open')).toHaveLength(2)
    })

    it('?showClosed=true presets the switch on and fetches closed polls immediately', async () => {
      listClosedPolls.mockResolvedValue([closedSquad()])
      listRounds.mockImplementation((_c: string, params: { open: boolean }) =>
        Promise.resolve(params.open ? [] : [closedRound()]),
      )

      renderDashboard('test-club-id', '/manage/availability?showClosed=true')

      expect(await screen.findByRole('heading', { name: 'Closed group poll' })).toBeInTheDocument()
      expect(screen.getByRole('checkbox', { name: 'Show closed polls' })).toBeChecked()
      expect(listClosedPolls).toHaveBeenCalled()
    })

    it('a closed squad poll is reopened through the Reopen dialog: the close time is saved, then the poll opened', async () => {
      const user = userEvent.setup()
      listClosedPolls.mockResolvedValue([closedSquad()])
      updatePollCloseTime.mockResolvedValueOnce({})
      openPoll.mockResolvedValueOnce({})

      renderDashboard('test-club-id', '/manage/availability?showClosed=true')
      await screen.findByText('Closed')
      expect(screen.queryByRole('button', { name: /^close poll$/i })).not.toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Reopen poll' }))
      expect(await screen.findByRole('heading', { name: 'Reopen this poll' })).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Reopen poll' }))

      await waitFor(() => expect(openPoll).toHaveBeenCalledWith('test-club-id', 'match-9', 'poll-closed'))
      expect(updatePollCloseTime).toHaveBeenCalledWith('test-club-id', 'match-9', 'poll-closed', {
        autoClose: false,
        scheduledCloseAt: null,
      })
      expect(updatePollCloseTime.mock.invocationCallOrder[0]).toBeLessThan(openPoll.mock.invocationCallOrder[0])
      // The dashboard queries are invalidated so the poll moves into the open list.
      await waitFor(() => expect(listOpenPolls.mock.calls.length).toBeGreaterThan(1))
    })

    it('an open squad poll offers Close, which asks for confirmation before calling closePoll', async () => {
      const user = userEvent.setup()
      listOpenPolls.mockResolvedValue([makePoll()])
      closePoll.mockResolvedValueOnce({})

      renderDashboard('test-club-id')
      await screen.findByText('Open')
      await user.click(screen.getByRole('button', { name: /^close poll$/i }))
      expect(closePoll).not.toHaveBeenCalled()
      expect(await screen.findByText('Close this poll?')).toBeInTheDocument()
      expect(screen.getByText(/choosing a new close time/i)).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Close poll' }))

      await waitFor(() => expect(closePoll).toHaveBeenCalledWith('test-club-id', 'match-1', 'poll-1'))
    })

    it('cancelling the close confirmation closes nothing', async () => {
      const user = userEvent.setup()
      listOpenPolls.mockResolvedValue([makePoll()])

      renderDashboard('test-club-id')
      await screen.findByText('Open')
      await user.click(screen.getByRole('button', { name: /^close poll$/i }))
      await user.click(await screen.findByRole('button', { name: 'Cancel' }))

      expect(closePoll).not.toHaveBeenCalled()
    })

    it('a closed autoclosing poll past its close time can still be reopened: the dialog needs a future time', async () => {
      const user = userEvent.setup()
      listClosedPolls.mockResolvedValue([makePoll({ pollId: 'poll-late', autoClose: true, scheduledCloseAt: '2026-05-31T09:00:00Z' })])

      renderDashboard('test-club-id', '/manage/availability?showClosed=true')
      await user.click(await screen.findByRole('button', { name: 'Reopen poll' }))

      expect(await screen.findByRole('heading', { name: 'Reopen this poll' })).toBeInTheDocument()
      // The match and its default close time are both long past, so the future-time rule blocks it.
      expect(screen.getByText('Choose a closing time in the future.')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Reopen poll' })).toBeDisabled()
      expect(openPoll).not.toHaveBeenCalled()
    })

    it('shows the server 409 message inline when a reopen is rejected', async () => {
      const user = userEvent.setup()
      listClosedPolls.mockResolvedValue([closedSquad()])
      updatePollCloseTime.mockResolvedValueOnce({})
      openPoll.mockRejectedValueOnce(
        conflictError('This poll can no longer be reopened because its automatic close time has passed.'),
      )

      renderDashboard('test-club-id', '/manage/availability?showClosed=true')
      await screen.findByText('Closed')
      await user.click(screen.getByRole('button', { name: 'Reopen poll' }))
      await user.click(await screen.findByRole('button', { name: 'Reopen poll' }))

      expect(
        await screen.findByText('This poll can no longer be reopened because its automatic close time has passed.'),
      ).toBeInTheDocument()
    })

    it('a closed group poll can be reopened through openRound', async () => {
      const user = userEvent.setup()
      listRounds.mockImplementation((_c: string, params: { open: boolean }) =>
        Promise.resolve(params.open ? [] : [closedRound()]),
      )
      updateRoundCloseTime.mockResolvedValueOnce(makeRound())
      openRound.mockResolvedValueOnce(makeRound())

      renderDashboard('test-club-id', '/manage/availability?showClosed=true')
      await screen.findByRole('heading', { name: 'Closed group poll' })
      expect(screen.getByText('Closed')).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Reopen poll' }))
      await user.click(await screen.findByRole('button', { name: 'Reopen poll' }))

      await waitFor(() => expect(openRound).toHaveBeenCalledWith('test-club-id', 'round-closed'))
      expect(updateRoundCloseTime).toHaveBeenCalledWith('test-club-id', 'round-closed', { autoClose: false, scheduledCloseAt: null })
    })

    it('deleting a closed squad poll and a closed group poll works', async () => {
      const user = userEvent.setup()
      listClosedPolls.mockResolvedValue([closedSquad()])
      listRounds.mockImplementation((_c: string, params: { open: boolean }) =>
        Promise.resolve(params.open ? [] : [closedRound()]),
      )
      deletePoll.mockResolvedValueOnce(undefined)
      deleteRound.mockResolvedValueOnce(undefined)

      renderDashboard('test-club-id', '/manage/availability?showClosed=true')
      await screen.findByRole('heading', { name: 'Closed group poll' })

      // Squad card (date 1 May) sorts first, then the group card (2 May).
      await user.click(screen.getAllByRole('button', { name: 'Delete' })[0])
      await user.click(await screen.findByRole('button', { name: 'Delete poll' }))
      await waitFor(() => expect(deletePoll).toHaveBeenCalledWith('test-club-id', 'match-9', 'poll-closed'))
      await waitFor(() => expect(screen.queryByText('Delete this squad poll?')).not.toBeInTheDocument())

      await user.click(screen.getAllByRole('button', { name: 'Delete' })[1])
      await user.click(await screen.findByRole('button', { name: 'Delete poll' }))
      await waitFor(() => expect(deleteRound).toHaveBeenCalledWith('test-club-id', 'round-closed'))
    })

    it('uses "No polls" wording when the switch is on and nothing matches a filter', async () => {
      const user = userEvent.setup()
      renderDashboard('test-club-id', '/manage/availability?showClosed=true')
      expect(await screen.findByText('No polls')).toBeInTheDocument()

      await user.type(screen.getByPlaceholderText('Search by team, opponent or description'), 'zzz')
      expect(await screen.findByText('No polls match "zzz". Try a different search.')).toBeInTheDocument()
    })
  })

  describe('delete (064)', () => {
    it('deleting a squad poll confirms, then calls deletePoll with that poll\'s match and id', async () => {
      const user = userEvent.setup()
      listTeamsForClub.mockResolvedValue([makeTeam()])
      listOpenPolls.mockResolvedValue([makePoll()])
      deletePoll.mockResolvedValueOnce(undefined)

      renderDashboard('test-club-id')

      await screen.findByRole('heading', { name: 'Home Team vs Rivals CC' })
      await user.click(screen.getByRole('button', { name: 'Delete' }))
      expect(deletePoll).not.toHaveBeenCalled()
      expect(await screen.findByText('Delete this squad poll?')).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Delete poll' }))

      await waitFor(() => expect(deletePoll).toHaveBeenCalledWith('test-club-id', 'match-1', 'poll-1'))
    })

    it('cancelling the confirm dialog deletes nothing', async () => {
      const user = userEvent.setup()
      listRounds.mockResolvedValue([makeRound()])

      renderDashboard('test-club-id')

      await screen.findByRole('heading', { name: 'Sat 6 Jun - U13 Boys fixtures' })
      await user.click(screen.getByRole('button', { name: 'Delete' }))
      expect(await screen.findByText('Delete this group poll?')).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Cancel' }))

      expect(deleteRound).not.toHaveBeenCalled()
    })

    it('deleting a group poll confirms, then calls deleteRound', async () => {
      const user = userEvent.setup()
      listRounds.mockResolvedValue([makeRound()])
      deleteRound.mockResolvedValueOnce(undefined)

      renderDashboard('test-club-id')

      await screen.findByRole('heading', { name: 'Sat 6 Jun - U13 Boys fixtures' })
      await user.click(screen.getByRole('button', { name: 'Delete' }))
      await user.click(await screen.findByRole('button', { name: 'Delete poll' }))

      await waitFor(() => expect(deleteRound).toHaveBeenCalledWith('test-club-id', 'round-1'))
    })

    it('a 409 on deleting a group poll shows an acknowledge-only notice with the server message', async () => {
      const user = userEvent.setup()
      listRounds.mockResolvedValue([makeRound()])
      deleteRound.mockRejectedValueOnce(
        conflictError(
          'This group poll cannot be deleted while match squad members are picked from it. Remove the picked squad members from its matches first, then delete the poll.',
        ),
      )

      renderDashboard('test-club-id')

      await screen.findByRole('heading', { name: 'Sat 6 Jun - U13 Boys fixtures' })
      await user.click(screen.getByRole('button', { name: 'Delete' }))
      await user.click(await screen.findByRole('button', { name: 'Delete poll' }))

      expect(await screen.findByText("Can't delete this poll")).toBeInTheDocument()
      expect(screen.getByText(/cannot be deleted while match squad members are picked from it/)).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'OK' }))
      await waitFor(() => expect(screen.queryByText("Can't delete this poll")).not.toBeInTheDocument())
    })
  })

  describe('delete failures and filtered empty state (064)', () => {
    it('a failed squad poll delete closes the dialog and shows the server message inline on that card', async () => {
      const user = userEvent.setup()
      listTeamsForClub.mockResolvedValue([makeTeam()])
      listOpenPolls.mockResolvedValue([makePoll()])
      deletePoll.mockRejectedValueOnce(serverError('Could not delete right now.'))

      renderDashboard('test-club-id')

      await screen.findByRole('heading', { name: 'Home Team vs Rivals CC' })
      await user.click(screen.getByRole('button', { name: 'Delete' }))
      await user.click(await screen.findByRole('button', { name: 'Delete poll' }))

      expect(await screen.findByText('Could not delete right now.')).toBeInTheDocument()
      await waitFor(() => expect(screen.queryByText('Delete this squad poll?')).not.toBeInTheDocument())
    })

    it('a non-409 group poll delete failure shows inline card feedback, not the acknowledge-only notice', async () => {
      const user = userEvent.setup()
      listRounds.mockResolvedValue([makeRound()])
      deleteRound.mockRejectedValueOnce(serverError('Could not delete right now.'))

      renderDashboard('test-club-id')

      await screen.findByRole('heading', { name: 'Sat 6 Jun - U13 Boys fixtures' })
      await user.click(screen.getByRole('button', { name: 'Delete' }))
      await user.click(await screen.findByRole('button', { name: 'Delete poll' }))

      expect(await screen.findByText('Could not delete right now.')).toBeInTheDocument()
      expect(screen.queryByText("Can't delete this poll")).not.toBeInTheDocument()
    })

    it('shows "No matching polls" (not the first-run empty state) when the Type filter leaves nothing', async () => {
      const user = userEvent.setup()
      listTeamsForClub.mockResolvedValue([makeTeam()])
      listOpenPolls.mockResolvedValue([makePoll()])

      renderDashboard('test-club-id')

      await screen.findByRole('heading', { name: 'Home Team vs Rivals CC' })
      await user.click(screen.getByLabelText('Type'))
      await user.click(await screen.findByRole('option', { name: 'Group polls' }))

      expect(await screen.findByText('No matching polls')).toBeInTheDocument()
      expect(screen.queryByText('No open polls')).not.toBeInTheDocument()
    })
  })

  // docs/specs/066: the group card is the same PollCard as the squad one.
  describe('group poll card', () => {
    it('renders the subtitle, one slot summary per bracket with counts and bar widths, and the Closes row', async () => {
      listRounds.mockResolvedValue([makeRound()])
      renderDashboard('test-club-id')

      expect(await screen.findByRole('heading', { level: 3, name: 'Sat 6 Jun - U13 Boys fixtures' })).toBeInTheDocument()
      expect(screen.getByText('Group poll')).toBeInTheDocument()
      expect(screen.getByText('U13 Boys · 3 matches')).toBeInTheDocument()
      expect(screen.getByRole('heading', { level: 4, name: /· Morning$/ })).toBeInTheDocument()
      expect(screen.getByRole('heading', { level: 4, name: /· Afternoon$/ })).toBeInTheDocument()
      expect(screen.getByText(legend('Available 5'))).toBeInTheDocument()
      expect(screen.getByText('6 of 8 answered')).toBeInTheDocument()
      expect(screen.getByTestId('window-1-bar-AVAILABLE')).toHaveStyle({ width: '62.5%' })
      expect(screen.getByTestId('window-2-bar-NONE')).toHaveStyle({ width: '50%' })
      expect(screen.getByText('Poll closes')).toBeInTheDocument()
    })

    it('has the same four footer buttons in the same order as a squad card', async () => {
      listRounds.mockResolvedValue([makeRound()])
      renderDashboard('test-club-id')

      await screen.findByRole('heading', { level: 3, name: 'Sat 6 Jun - U13 Boys fixtures' })
      const names = ['Close poll', 'Matches', 'Responses', 'Share invite']
      const footer = screen.getByRole('button', { name: 'Close poll' }).parentElement as HTMLElement
      expect(within(footer).getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual(names)
      expect(footer).toHaveStyle({ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' })
    })

    it('lays the cards out in the shared card grid (same template as the Matches list), stretched', async () => {
      listRounds.mockResolvedValue([makeRound()])
      renderDashboard('test-club-id')

      const heading = await screen.findByRole('heading', { level: 3, name: 'Sat 6 Jun - U13 Boys fixtures' })
      const grid = heading.closest('.MuiCard-root')?.parentElement as HTMLElement
      expect(grid).toHaveStyle({ display: 'grid', gridTemplateColumns: POLL_CARD_GRID_TEMPLATE_COLUMNS, alignItems: 'stretch' })
    })

    it('renders a round owning three brackets with three slot summaries, not capped at two', async () => {
      listRounds.mockResolvedValue([
        makeRound({
          brackets: [
            ...makeRound().brackets,
            {
              dayPart: 'MORNING',
              windowDate: '2026-06-07',
              windowId: 'window-3',
              availableCount: 2,
              unavailableCount: 2,
              unsureCount: 2,
              noResponseCount: 2,
              coveredMatchCount: 1,
            },
          ],
        }),
      ])
      renderDashboard('test-club-id')

      await screen.findByRole('heading', { level: 3, name: 'Sat 6 Jun - U13 Boys fixtures' })
      expect(screen.getAllByRole('heading', { level: 4 })).toHaveLength(3)
      expect(screen.getByText('U13 Boys · 4 matches')).toBeInTheDocument()
    })

    it('closes an open round', async () => {
      const user = userEvent.setup()
      listRounds.mockResolvedValue([makeRound()])
      closeRound.mockResolvedValueOnce(makeRound({ open: false }))

      renderDashboard('test-club-id')

      await screen.findByRole('heading', { name: 'Sat 6 Jun - U13 Boys fixtures' })
      await user.click(screen.getByRole('button', { name: /^close poll$/i }))
      expect(closeRound).not.toHaveBeenCalled()
      await user.click(await screen.findByRole('button', { name: 'Close poll' }))

      await waitFor(() => expect(closeRound).toHaveBeenCalledWith('test-club-id', 'round-1'))
    })

    it('Matches opens a dialog listing the covered matches under each slot, fetched for that round only', async () => {
      const user = userEvent.setup()
      listRounds.mockResolvedValue([makeRound()])
      getRoundMatches.mockResolvedValue([makeRoundMatch()])

      renderDashboard('test-club-id')

      await screen.findByRole('heading', { level: 3, name: 'Sat 6 Jun - U13 Boys fixtures' })
      expect(getRoundMatches).not.toHaveBeenCalled()

      await user.click(screen.getByRole('button', { name: 'Matches' }))

      expect(getRoundMatches).toHaveBeenCalledWith('test-club-id', 'round-1')
      expect(await screen.findByText('U13 Boys A vs Rivals CC')).toBeInTheDocument()
    })

    it('navigates to the responses page when Responses is clicked (docs/specs/065)', async () => {
      const user = userEvent.setup()
      listRounds.mockResolvedValue([makeRound()])

      renderDashboard('test-club-id')

      await screen.findByRole('heading', { name: 'Sat 6 Jun - U13 Boys fixtures' })
      await user.click(screen.getByRole('button', { name: 'Responses' }))

      expect(await screen.findByText('Group Poll Responses Page')).toBeInTheDocument()
      expect(getRoundResponses).not.toHaveBeenCalled()
    })

    it("opens the share dialog with the round's own public link embedded", async () => {
      const user = userEvent.setup()
      listRounds.mockResolvedValue([makeRound()])

      renderDashboard('test-club-id')

      await screen.findByRole('heading', { name: 'Sat 6 Jun - U13 Boys fixtures' })
      await user.click(screen.getByRole('button', { name: /share invite/i }))

      const textarea = (await screen.findByLabelText('Invite text')) as HTMLTextAreaElement
      expect(textarea.value).toContain('/section-availability/round-1')
    })

    it("edits a round's description in a dialog, saving through updateRoundDescription", async () => {
      const user = userEvent.setup()
      listRounds.mockResolvedValue([makeRound()])
      updateRoundDescription.mockResolvedValueOnce(makeRound({ description: 'Weekend fixtures - updated' }))

      renderDashboard('test-club-id')

      await screen.findByRole('heading', { name: 'Sat 6 Jun - U13 Boys fixtures' })
      await user.click(screen.getByRole('button', { name: /edit description/i }))

      const input = await screen.findByLabelText('Description')
      await user.clear(input)
      await user.type(input, 'Weekend fixtures - updated')
      await user.click(screen.getByRole('button', { name: /^save$/i }))

      await waitFor(() => expect(updateRoundDescription).toHaveBeenCalledWith('test-club-id', 'round-1', 'Weekend fixtures - updated'))
    })

    it('Edit close time on an open poll saves a valid close time without reopening', async () => {
      const user = userEvent.setup()
      listRounds.mockResolvedValue([makeRound({ autoClose: false, scheduledCloseAt: null })])
      updateRoundCloseTime.mockResolvedValueOnce(makeRound())

      renderDashboard('test-club-id')

      await screen.findByRole('heading', { name: 'Sat 6 Jun - U13 Boys fixtures' })
      expect(screen.getByText('Manually')).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Edit close time' }))
      expect(await screen.findByRole('heading', { name: 'Edit close time' })).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Save' }))

      await waitFor(() =>
        expect(updateRoundCloseTime).toHaveBeenCalledWith('test-club-id', 'round-1', { autoClose: false, scheduledCloseAt: null }),
      )
      expect(openRound).not.toHaveBeenCalled()
    })
  })
})
