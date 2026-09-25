import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AvailabilityPollsDashboard from './AvailabilityPollsDashboard'
import type { OpenAvailabilityPoll } from '../../api/matchAvailabilityApi'
import type { Team } from '../../api/teamApi'

const listOpenPolls = vi.fn()
const listTeamsForClub = vi.fn()
const listSections = vi.fn()

vi.mock('../../api/matchAvailabilityApi', () => ({
  listOpenPolls: (clubId: string, params: unknown) => listOpenPolls(clubId, params),
}))

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
  // docs/specs/043-list-toolbar-gold-standard.md: this screen's Section filter now persists via
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

function OutletContextWrapper({ clubId }: { clubId?: string }) {
  return <Outlet context={{ clubId }} />
}

function renderDashboard(clubId?: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/manage/availability']}>
        <Routes>
          <Route path="/manage" element={<OutletContextWrapper clubId={clubId} />}>
            <Route path="availability" element={<AvailabilityPollsDashboard />} />
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
      screen.getByText('Open a poll for an upcoming match from its own Availability tab to see it here.'),
    ).toBeInTheDocument()
  })

  it('renders an error state when the fetch fails', async () => {
    listOpenPolls.mockRejectedValueOnce(new Error('network error'))

    renderDashboard('test-club-id')

    expect(await screen.findByText("Couldn't load availability polls")).toBeInTheDocument()
  })

  it('renders one RecordCard per open poll with correct title, badge, and field summaries', async () => {
    listTeamsForClub.mockResolvedValue([makeTeam({ id: 'team-home', name: 'Home Team' })])
    listOpenPolls.mockResolvedValueOnce([makePoll()])

    renderDashboard('test-club-id')

    expect(await screen.findByRole('heading', { name: 'Home Team vs Rivals CC' })).toBeInTheDocument()
    expect(screen.getByText('Home')).toBeInTheDocument()
    expect(screen.getByText('2 Available')).toBeInTheDocument()
    expect(screen.getByText('1 Unavailable')).toBeInTheDocument()
    expect(screen.getByText('0 Unsure')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('Home Ground')).toBeInTheDocument()
  })

  it("each card's Edit action links to the correct ?tab=availability&side=... URL for its own matchId/side", async () => {
    listTeamsForClub.mockResolvedValue([makeTeam({ id: 'team-home', name: 'Home Team' })])
    listOpenPolls.mockResolvedValueOnce([
      makePoll({ pollId: 'poll-home', matchId: 'match-1', teamId: 'team-home', homeTeamId: 'team-home' }),
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

    const editLinks = await screen.findAllByRole('link', { name: 'Manage responses' })
    expect(editLinks[0]).toHaveAttribute('href', '/manage/fixtures/matches/match-1/edit?tab=availability&side=home')
    expect(editLinks[1]).toHaveAttribute('href', '/manage/fixtures/matches/match-2/edit?tab=availability&side=away')
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
    localStorage.setItem('availabilityPolls:filters:test-club-id', JSON.stringify({ sectionId: 'section-1' }))

    renderDashboard('test-club-id')

    await waitFor(() => expect(listOpenPolls).toHaveBeenCalledWith('test-club-id', { sectionId: 'section-1' }))
    expect(await screen.findByLabelText('Section')).toHaveValue('Juniors')

    await user.type(screen.getByLabelText('Search'), 'Rivals')

    const persisted = JSON.parse(localStorage.getItem('availabilityPolls:filters:test-club-id') as string)
    expect(persisted).toEqual({ sectionId: 'section-1' })
    expect(persisted).not.toHaveProperty('search')
  })
})
