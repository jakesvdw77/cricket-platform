import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MatchDetailPage from './MatchDetailPage'
import type { Match } from '../../api/matchApi'
import type { MatchSide } from '../../api/matchSideApi'
import type { SquadMember } from '../../api/teamSquadApi'
import type { MatchAvailabilityPoll, MatchAvailabilityPollResponses } from '../../api/matchAvailabilityApi'

const getMatch = vi.fn()
const listTeamsForClub = vi.fn()
const listSeasons = vi.fn()
const listLeagues = vi.fn()
const listSquad = vi.fn()
const listMatchSides = vi.fn()
const listPolls = vi.fn()
const getPollResponses = vi.fn()

vi.mock('../../api/matchApi', () => ({
  getMatch: (clubId: string, matchId: string) => getMatch(clubId, matchId),
}))

vi.mock('../../api/teamApi', () => ({
  listTeamsForClub: (clubId: string) => listTeamsForClub(clubId),
}))

vi.mock('../../api/seasonApi', () => ({
  listSeasons: (clubId: string) => listSeasons(clubId),
}))

vi.mock('../../api/leagueApi', () => ({
  listLeagues: (clubId: string) => listLeagues(clubId),
}))

vi.mock('../../api/teamSquadApi', () => ({
  listSquad: (clubId: string, teamId: string, seasonId: string) => listSquad(clubId, teamId, seasonId),
}))

vi.mock('../../api/matchSideApi', () => ({
  listMatchSides: (clubId: string, matchId: string) => listMatchSides(clubId, matchId),
}))

vi.mock('../../api/matchAvailabilityApi', () => ({
  listPolls: (clubId: string, matchId: string) => listPolls(clubId, matchId),
  getPollResponses: (clubId: string, matchId: string, pollId: string) => getPollResponses(clubId, matchId, pollId),
}))

function makeMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: 'match-1',
    clubId: 'test-club-id',
    homeTeamId: 'team-1',
    homeTeamName: null,
    awayTeamId: 'team-2',
    awayTeamName: null,
    leagueId: null,
    seasonId: 'season-1',
    matchDate: '2026-06-01T14:30:00Z',
    venue: 'Riverside Oval',
    active: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: null,
    ...overrides,
  }
}

function makeSide(overrides: Partial<MatchSide> = {}): MatchSide {
  return {
    id: 'side-1',
    matchId: 'match-1',
    teamId: 'team-1',
    captainPlayerId: null,
    wicketKeeperPlayerId: null,
    twelfthManPlayerId: null,
    players: [],
    ...overrides,
  }
}

function makeSquadMember(overrides: Partial<SquadMember> = {}): SquadMember {
  return {
    id: 'squad-1',
    personId: 'person-1',
    clubId: 'test-club-id',
    firstName: 'Jane',
    lastName: 'Smith',
    dateOfBirth: null,
    gender: null,
    photoUrl: null,
    clubMembershipNumber: null,
    medicalAidProvider: null,
    medicalAidMemberNumber: null,
    phone: null,
    email: null,
    altContactName: null,
    altContactPhone: null,
    battingStance: null,
    bowlingArm: null,
    bowlingType: null,
    isWicketKeeper: false,
    active: true,
    sectionIds: [],
    jerseyNumber: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: null,
    playerProfileId: 'player-1',
    squadJerseyNumber: null,
    ...overrides,
  }
}

function makePoll(overrides: Partial<MatchAvailabilityPoll> = {}): MatchAvailabilityPoll {
  return {
    id: 'poll-1',
    teamId: 'team-1',
    open: true,
    availableCount: 0,
    unavailableCount: 0,
    unsureCount: 0,
    noResponseCount: 0,
    ...overrides,
  }
}

function makeResponses(overrides: Partial<MatchAvailabilityPollResponses> = {}): MatchAvailabilityPollResponses {
  return {
    pollId: 'poll-1',
    teamId: 'team-1',
    open: true,
    availableCount: 1,
    unavailableCount: 0,
    unsureCount: 0,
    noResponseCount: 0,
    responses: [
      { playerProfileId: 'player-1', firstName: 'Jane', lastName: 'Smith', squadJerseyNumber: null, status: 'AVAILABLE' },
    ],
    publicPath: '/poll/poll-1',
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  listTeamsForClub.mockResolvedValue([
    { id: 'team-1', clubId: 'test-club-id', sectionId: 'section-1', name: '1st XI', logoUrl: null, active: true, createdAt: '', updatedAt: '', updatedBy: null },
    { id: 'team-2', clubId: 'test-club-id', sectionId: 'section-1', name: '2nd XI', logoUrl: null, active: true, createdAt: '', updatedAt: '', updatedBy: null },
  ])
  listSeasons.mockResolvedValue([])
  listLeagues.mockResolvedValue([])
  listSquad.mockResolvedValue([])
  listMatchSides.mockResolvedValue([])
  listPolls.mockResolvedValue([])
})

function OutletContextWrapper({ clubId }: { clubId?: string }) {
  return <Outlet context={{ clubId }} />
}

function renderPage(initialPath: string, clubId?: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/manage/fixtures" element={<OutletContextWrapper clubId={clubId} />}>
            <Route path="matches" element={<div>Match List Page</div>} />
            <Route path="matches/:matchId" element={<MatchDetailPage />} />
            <Route path="matches/:matchId/edit" element={<div>Edit Match Page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('MatchDetailPage', () => {
  it('renders "Not authorized" and does not fetch when no clubId is in the Outlet context', () => {
    renderPage('/manage/fixtures/matches/match-1', undefined)

    expect(screen.getByText('Not authorized')).toBeInTheDocument()
    expect(getMatch).not.toHaveBeenCalled()
  })

  it('loads the match and renders the Details section plus both sides\' selected XI', async () => {
    getMatch.mockResolvedValueOnce(makeMatch())
    listMatchSides.mockResolvedValueOnce([
      makeSide({ teamId: 'team-1', players: [{ playerProfileId: 'player-1', battingOrder: 1, role: 'BATSMAN' }] }),
    ])
    listSquad.mockImplementation((_clubId: string, teamId: string) =>
      Promise.resolve(teamId === 'team-1' ? [makeSquadMember({ playerProfileId: 'player-1' })] : []),
    )

    renderPage('/manage/fixtures/matches/match-1', 'test-club-id')

    expect(await screen.findByRole('heading', { name: '1st XI vs 2nd XI' })).toBeInTheDocument()
    expect(getMatch).toHaveBeenCalledWith('test-club-id', 'match-1')
    expect(screen.getByText('Riverside Oval')).toBeInTheDocument()
    expect(screen.getByText('Details')).toBeInTheDocument()
    expect(screen.getByText('Home XI')).toBeInTheDocument()
    expect(screen.getByText('Away XI')).toBeInTheDocument()

    expect(await screen.findByText('Jane Smith')).toBeInTheDocument()
    expect(screen.getByText('No XI selected yet')).toBeInTheDocument()

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /edit/i })).toHaveAttribute('href', '/manage/fixtures/matches/match-1/edit')
  })

  it('renders a read-only Availability summary per side, with no admin-override control', async () => {
    getMatch.mockResolvedValueOnce(makeMatch())
    listPolls.mockResolvedValueOnce([makePoll({ id: 'poll-1', teamId: 'team-1' })])
    getPollResponses.mockResolvedValueOnce(makeResponses())

    renderPage('/manage/fixtures/matches/match-1', 'test-club-id')

    await screen.findByRole('heading', { name: '1st XI vs 2nd XI' })

    expect(await screen.findByText('Availability')).toBeInTheDocument()
    expect(await screen.findByText('1 Available')).toBeInTheDocument()
    expect(screen.getByText('No availability poll open for 2nd XI (Away).')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /set.*availability/i })).not.toBeInTheDocument()
  })

  // docs/specs/037-match-improvements.md item 2
  it('renders a "Select Team" action linking to the Playing XI tab when a real-Team side exists', async () => {
    getMatch.mockResolvedValueOnce(makeMatch())

    renderPage('/manage/fixtures/matches/match-1', 'test-club-id')

    await screen.findByRole('heading', { name: '1st XI vs 2nd XI' })
    expect(screen.getByRole('link', { name: /select team/i })).toHaveAttribute(
      'href',
      '/manage/fixtures/matches/match-1/edit?tab=playing-xi',
    )
  })

  it('omits the "Select Team" action for a match with no real-Team side on either end', async () => {
    getMatch.mockResolvedValueOnce(
      makeMatch({ homeTeamId: null, homeTeamName: 'Home Occasionals', awayTeamId: null, awayTeamName: 'Away Occasionals' }),
    )

    renderPage('/manage/fixtures/matches/match-1', 'test-club-id')

    await screen.findByRole('heading', { name: 'Home Occasionals vs Away Occasionals' })
    expect(screen.queryByRole('link', { name: /select team/i })).not.toBeInTheDocument()
  })

  it('renders an error state when the match fails to load', async () => {
    getMatch.mockRejectedValueOnce(new Error('not found'))

    renderPage('/manage/fixtures/matches/match-1', 'test-club-id')

    expect(await screen.findByText("Couldn't load this match")).toBeInTheDocument()
  })
})
