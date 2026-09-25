import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MatchFormPage from './MatchFormPage'
import type { Match } from '../../api/matchApi'
import type { MatchSide } from '../../api/matchSideApi'

const getMatch = vi.fn()
const createMatch = vi.fn()
const updateMatch = vi.fn()
const deactivateMatch = vi.fn()
const reactivateMatch = vi.fn()
const listPreviousMatches = vi.fn()
const listTeamsForClub = vi.fn()
const listSeasons = vi.fn()
const listLeagues = vi.fn()
const listLeagueAffiliations = vi.fn()
const listSquad = vi.fn()
const listMatchSides = vi.fn()
const createMatchSide = vi.fn()
const updateMatchSide = vi.fn()
const addMatchSidePlayer = vi.fn()
const updateMatchSidePlayerRole = vi.fn()
const removeMatchSidePlayer = vi.fn()
const reorderMatchSidePlayers = vi.fn()
const announceMatchSide = vi.fn()
const unannounceMatchSide = vi.fn()
const listPolls = vi.fn()
const createPoll = vi.fn()
const openPoll = vi.fn()
const closePoll = vi.fn()
const getPollResponses = vi.fn()
const createPlayer = vi.fn()
const addToSquad = vi.fn()

vi.mock('../../api/matchApi', () => ({
  getMatch: (clubId: string, matchId: string) => getMatch(clubId, matchId),
  createMatch: (clubId: string, payload: unknown) => createMatch(clubId, payload),
  updateMatch: (clubId: string, matchId: string, payload: unknown) => updateMatch(clubId, matchId, payload),
  deactivateMatch: (clubId: string, matchId: string) => deactivateMatch(clubId, matchId),
  reactivateMatch: (clubId: string, matchId: string) => reactivateMatch(clubId, matchId),
  listPreviousMatches: (clubId: string, teamId: string, seasonId: string, params: unknown) =>
    listPreviousMatches(clubId, teamId, seasonId, params),
}))

vi.mock('../../api/playerApi', () => ({
  createPlayer: (clubId: string, payload: unknown) => createPlayer(clubId, payload),
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

vi.mock('../../api/leagueAffiliationApi', () => ({
  listLeagueAffiliations: (clubId: string, leagueId: string) => listLeagueAffiliations(clubId, leagueId),
}))

vi.mock('../../api/teamSquadApi', () => ({
  listSquad: (clubId: string, teamId: string, seasonId: string) => listSquad(clubId, teamId, seasonId),
  addToSquad: (clubId: string, teamId: string, seasonId: string, playerId: string) =>
    addToSquad(clubId, teamId, seasonId, playerId),
}))

vi.mock('../../api/matchSideApi', () => ({
  listMatchSides: (clubId: string, matchId: string) => listMatchSides(clubId, matchId),
  createMatchSide: (clubId: string, matchId: string, teamId: string) => createMatchSide(clubId, matchId, teamId),
  updateMatchSide: (clubId: string, matchId: string, sideId: string, payload: unknown) =>
    updateMatchSide(clubId, matchId, sideId, payload),
  addMatchSidePlayer: (clubId: string, matchId: string, sideId: string, playerId: string, role: string) =>
    addMatchSidePlayer(clubId, matchId, sideId, playerId, role),
  updateMatchSidePlayerRole: (clubId: string, matchId: string, sideId: string, playerId: string, role: string) =>
    updateMatchSidePlayerRole(clubId, matchId, sideId, playerId, role),
  removeMatchSidePlayer: (clubId: string, matchId: string, sideId: string, playerId: string) =>
    removeMatchSidePlayer(clubId, matchId, sideId, playerId),
  reorderMatchSidePlayers: (clubId: string, matchId: string, sideId: string, ids: string[]) =>
    reorderMatchSidePlayers(clubId, matchId, sideId, ids),
  announceMatchSide: (clubId: string, matchId: string, sideId: string) => announceMatchSide(clubId, matchId, sideId),
  unannounceMatchSide: (clubId: string, matchId: string, sideId: string) => unannounceMatchSide(clubId, matchId, sideId),
}))

vi.mock('../../api/matchAvailabilityApi', () => ({
  listPolls: (clubId: string, matchId: string) => listPolls(clubId, matchId),
  createPoll: (clubId: string, matchId: string, teamId: string) => createPoll(clubId, matchId, teamId),
  openPoll: (clubId: string, matchId: string, pollId: string) => openPoll(clubId, matchId, pollId),
  closePoll: (clubId: string, matchId: string, pollId: string) => closePoll(clubId, matchId, pollId),
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
    homeSideAnnounced: false,
    awaySideAnnounced: false,
    homeTeamLogoUrl: null,
    awayTeamLogoUrl: null,
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
    announced: false,
    ...overrides,
  }
}

function makeSquadMember(overrides: Partial<import('../../api/teamSquadApi').SquadMember> = {}) {
  return {
    id: 'squad-row-1',
    playerProfileId: 'player-1',
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
    squadJerseyNumber: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: null,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  listTeamsForClub.mockResolvedValue([
    { id: 'team-1', clubId: 'test-club-id', sectionId: 'section-1', name: '1st XI', logoUrl: null, active: true, createdAt: '', updatedAt: '', updatedBy: null },
    { id: 'team-2', clubId: 'test-club-id', sectionId: 'section-1', name: '2nd XI', logoUrl: null, active: true, createdAt: '', updatedAt: '', updatedBy: null },
  ])
  listSeasons.mockResolvedValue([
    { id: 'season-1', clubId: 'test-club-id', label: '2026', startDate: '2026-01-01', endDate: '2026-12-31', active: true, createdAt: '', updatedAt: '', updatedBy: null },
  ])
  listLeagues.mockResolvedValue([])
  listLeagueAffiliations.mockResolvedValue([])
  listSquad.mockResolvedValue([])
  listMatchSides.mockResolvedValue([])
  listPolls.mockResolvedValue([])
  listPreviousMatches.mockResolvedValue([])
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
            <Route path="matches/new" element={<MatchFormPage />} />
            <Route path="matches/:matchId/edit" element={<MatchFormPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('MatchFormPage', () => {
  it('create mode: renders no tabs and submits via createMatch', async () => {
    const user = userEvent.setup()
    createMatch.mockResolvedValueOnce(makeMatch())

    renderPage('/manage/fixtures/matches/new', 'test-club-id')

    expect(await screen.findByText('Add Match')).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Home XI' })).not.toBeInTheDocument()
    // docs/specs/038-move-deactivate-to-edit-screen.md: never rendered on a brand-new, not-yet-
    // saved record.
    expect(screen.queryByRole('button', { name: 'Deactivate' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reactivate' })).not.toBeInTheDocument()

    await user.click(screen.getByLabelText('Season'))
    await user.click(await screen.findByRole('option', { name: '2026' }))
    await user.click(screen.getByLabelText('Home team'))
    await user.click(await screen.findByRole('option', { name: '1st XI' }))
    await user.click(screen.getByLabelText('Away team'))
    await user.click(await screen.findByRole('option', { name: '2nd XI' }))
    await user.type(screen.getByLabelText('Match date & time'), '2026-06-01T14:30')
    await user.click(screen.getByRole('button', { name: 'Create match' }))

    expect(createMatch).toHaveBeenCalledTimes(1)
    expect(await screen.findByText('Match List Page')).toBeInTheDocument()
  })

  // docs/specs/050-league-schedule-and-fixtures.md item 31/32: LeagueFormPage's Schedule tab's own
  // "Add Match" shortcut pre-fills League/Season via query params on this same create route.
  describe('League/Season query-param prefill', () => {
    beforeEach(() => {
      listLeagues.mockResolvedValue([
        {
          id: 'league-1',
          clubId: 'test-club-id',
          name: 'Premier League',
          source: 'INTERNAL',
          maxPlayingXiSize: 11,
          minAge: null,
          maxAge: null,
          ageCutoffDate: null,
          active: true,
          createdAt: '',
          updatedAt: '',
          updatedBy: null,
          currentSeasonTeamCount: 4,
          currentSeasonLabel: '2026',
          currentSeasonPlayingConditionsUrl: null,
        },
      ])
    })

    it('create mode: a ?leagueId=&seasonId= query string pre-selects both on the rendered form', async () => {
      renderPage('/manage/fixtures/matches/new?leagueId=league-1&seasonId=season-1', 'test-club-id')

      expect(await screen.findByText('Add Match')).toBeInTheDocument()
      expect(await screen.findByLabelText('League')).toHaveTextContent('Premier League')
      expect(screen.getByLabelText('Season')).toHaveTextContent('2026')
    })

    it('edit mode: the same query string is ignored — the match\'s own League/Season values win', async () => {
      const user = userEvent.setup()
      // A second season in the club's own list, distinct from the match's real season, so a stray
      // seasonId query param landing here would be visibly distinguishable (in the submitted
      // payload) if it were (incorrectly) applied.
      listSeasons.mockResolvedValue([
        { id: 'season-1', clubId: 'test-club-id', label: '2026', startDate: '2026-01-01', endDate: '2026-12-31', active: true, createdAt: '', updatedAt: '', updatedBy: null },
        { id: 'season-2', clubId: 'test-club-id', label: '2027', startDate: '2027-01-01', endDate: '2027-12-31', active: true, createdAt: '', updatedAt: '', updatedBy: null },
      ])
      // The match's own values are both real, already-filled fields (homeTeamId/awayTeamId,
      // matchDate) — no further form interaction is needed before submitting, isolating this
      // assertion to exactly the League/Season prefill behavior under test.
      // .mockResolvedValue (not Once) — onSuccess invalidates this same query, triggering a
      // refetch while the page is still mounted.
      getMatch.mockResolvedValue(makeMatch({ leagueId: null, seasonId: 'season-1' }))
      updateMatch.mockResolvedValueOnce(makeMatch({ leagueId: null, seasonId: 'season-1' }))

      renderPage('/manage/fixtures/matches/match-1/edit?leagueId=league-1&seasonId=season-2', 'test-club-id')

      expect(await screen.findByText('Edit Match')).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Save changes' }))

      // The query string's leagueId=league-1/seasonId=season-2 never leak into the submitted
      // payload — the match's own leagueId (null) and seasonId (season-1) win instead.
      expect(updateMatch).toHaveBeenCalledWith(
        'test-club-id',
        'match-1',
        expect.objectContaining({ leagueId: null, seasonId: 'season-1' }),
      )
    })
  })

  it('edit mode: renders a Playing XI tab for each side that is a real Team', async () => {
    getMatch.mockResolvedValueOnce(makeMatch())

    renderPage('/manage/fixtures/matches/match-1/edit', 'test-club-id')

    expect(await screen.findByText('Edit Match')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Home XI' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Away XI' })).toBeInTheDocument()
  })

  it('edit mode: does not render a Playing XI tab for a free-text opponent side', async () => {
    getMatch.mockResolvedValueOnce(makeMatch({ awayTeamId: null, awayTeamName: 'Riverside Occasionals' }))

    renderPage('/manage/fixtures/matches/match-1/edit', 'test-club-id')

    expect(await screen.findByText('Edit Match')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Home XI' })).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Away XI' })).not.toBeInTheDocument()
  })

  it('Home XI tab: creates a MatchSide on first use when none exists yet, then renders the builder', async () => {
    const user = userEvent.setup()
    getMatch.mockResolvedValueOnce(makeMatch())
    listMatchSides.mockResolvedValueOnce([]).mockResolvedValue([makeSide()])
    createMatchSide.mockResolvedValueOnce(makeSide())

    renderPage('/manage/fixtures/matches/match-1/edit', 'test-club-id')

    await screen.findByText('Edit Match')
    await user.click(screen.getByRole('tab', { name: 'Home XI' }))

    expect(await screen.findByLabelText('Add player')).toBeInTheDocument()
    expect(createMatchSide).toHaveBeenCalledWith('test-club-id', 'match-1', 'team-1')
  })

  it('Home XI tab: reuses an existing MatchSide without creating a duplicate', async () => {
    const user = userEvent.setup()
    getMatch.mockResolvedValueOnce(makeMatch())
    listMatchSides.mockResolvedValue([makeSide({ teamId: 'team-1' })])

    renderPage('/manage/fixtures/matches/match-1/edit', 'test-club-id')

    await screen.findByText('Edit Match')
    await user.click(screen.getByRole('tab', { name: 'Home XI' }))

    expect(await screen.findByLabelText('Add player')).toBeInTheDocument()
    expect(createMatchSide).not.toHaveBeenCalled()
  })

  // docs/specs/037-match-improvements.md item 5 — the actual regression test, since
  // PlayingXiBuilder itself can't prove the merge (it only ever passes the single new id).
  it('changing Captain when Wicketkeeper/Twelfth Man are already set sends a merged 3-field payload, not partial', async () => {
    const user = userEvent.setup()
    getMatch.mockResolvedValueOnce(makeMatch())
    listMatchSides.mockResolvedValue([
      makeSide({
        teamId: 'team-1',
        wicketKeeperPlayerId: 'player-2',
        twelfthManPlayerId: 'player-3',
        players: [
          { playerProfileId: 'player-1', battingOrder: 1, role: 'BATSMAN' },
          { playerProfileId: 'player-2', battingOrder: 2, role: 'BOWLER' },
        ],
      }),
    ])
    listSquad.mockResolvedValue([
      makeSquadMember({ id: 'squad-1', playerProfileId: 'player-1', firstName: 'Jane', lastName: 'Smith' }),
      makeSquadMember({ id: 'squad-2', playerProfileId: 'player-2', firstName: 'Bob', lastName: 'Jones' }),
      makeSquadMember({ id: 'squad-3', playerProfileId: 'player-3', firstName: 'Amy', lastName: 'Lee' }),
    ])
    updateMatchSide.mockResolvedValueOnce(makeSide())

    renderPage('/manage/fixtures/matches/match-1/edit', 'test-club-id')

    await screen.findByText('Edit Match')
    await user.click(screen.getByRole('tab', { name: 'Home XI' }))

    await user.click(await screen.findByLabelText('Captain'))
    await user.click(await screen.findByRole('option', { name: 'Jane Smith' }))

    expect(updateMatchSide).toHaveBeenCalledWith('test-club-id', 'match-1', 'side-1', {
      captainPlayerId: 'player-1',
      wicketKeeperPlayerId: 'player-2',
      twelfthManPlayerId: 'player-3',
    })
  })

  // docs/specs/037-match-improvements.md item 8
  it('"Add Squad Member" creates a player then adds them to the squad, invalidating the squad query on success', async () => {
    const user = userEvent.setup()
    getMatch.mockResolvedValueOnce(makeMatch())
    listMatchSides.mockResolvedValue([makeSide({ teamId: 'team-1' })])
    listSquad.mockResolvedValueOnce([]).mockResolvedValue([makeSquadMember({ playerProfileId: 'player-9', firstName: 'New', lastName: 'Player' })])
    createPlayer.mockResolvedValueOnce({ id: 'player-9', firstName: 'New', lastName: 'Player' })
    addToSquad.mockResolvedValueOnce(makeSquadMember({ playerProfileId: 'player-9' }))

    renderPage('/manage/fixtures/matches/match-1/edit', 'test-club-id')

    await screen.findByText('Edit Match')
    await user.click(screen.getByRole('tab', { name: 'Home XI' }))
    await screen.findByLabelText('Add player')

    await user.click(screen.getByRole('button', { name: 'Add Squad Member' }))
    await user.type(await screen.findByLabelText('First name'), 'New')
    await user.type(screen.getByLabelText('Last name'), 'Player')
    await user.click(screen.getByRole('button', { name: 'Create & link' }))

    await waitFor(() =>
      expect(createPlayer).toHaveBeenCalledWith('test-club-id', expect.objectContaining({ firstName: 'New', lastName: 'Player' })),
    )
    await waitFor(() => expect(addToSquad).toHaveBeenCalledWith('test-club-id', 'team-1', 'season-1', 'player-9'))
    await waitFor(() => expect(listSquad).toHaveBeenCalledTimes(2))
  })

  // docs/specs/037-match-improvements.md item 9
  describe('Re-select from Previous Match', () => {
    const PREVIOUS_MATCH = makeMatch({
      id: 'prev-match-1',
      homeTeamId: 'team-1',
      homeTeamName: null,
      awayTeamId: 'team-2',
      awayTeamName: null,
      matchDate: '2026-05-01T14:30:00Z',
    })

    function mockSourceAndDestinationSides(destinationSide: MatchSide, sourceSide: MatchSide) {
      listMatchSides.mockImplementation((_clubId: string, matchId: string) => {
        if (matchId === 'match-1') return Promise.resolve([destinationSide])
        if (matchId === 'prev-match-1') return Promise.resolve([sourceSide])
        return Promise.resolve([])
      })
    }

    async function openPickerAndSelect(user: ReturnType<typeof userEvent.setup>) {
      await user.click(screen.getByRole('button', { name: 'Re-select from Previous Match' }))
      await user.click(screen.getByRole('combobox', { name: 'Search' }))
      await user.click(await screen.findByText(/vs 2nd XI/))
    }

    it('copies immediately with no confirm dialog when the destination side is empty, in the documented call sequence', async () => {
      const user = userEvent.setup()
      getMatch.mockResolvedValueOnce(makeMatch())
      listPreviousMatches.mockResolvedValue([PREVIOUS_MATCH])
      const destinationSide = makeSide({ id: 'side-1', teamId: 'team-1', players: [] })
      const sourceSide = makeSide({
        id: 'side-source',
        teamId: 'team-1',
        captainPlayerId: 'player-1',
        wicketKeeperPlayerId: 'player-2',
        twelfthManPlayerId: null,
        players: [
          { playerProfileId: 'player-1', battingOrder: 1, role: 'BATSMAN' },
          { playerProfileId: 'player-2', battingOrder: 2, role: 'BOWLER' },
        ],
      })
      mockSourceAndDestinationSides(destinationSide, sourceSide)
      listSquad.mockResolvedValue([
        makeSquadMember({ playerProfileId: 'player-1', firstName: 'Jane', lastName: 'Smith' }),
        makeSquadMember({ playerProfileId: 'player-2', firstName: 'Bob', lastName: 'Jones' }),
      ])
      addMatchSidePlayer.mockResolvedValue(makeSide())
      updateMatchSide.mockResolvedValue(makeSide())

      renderPage('/manage/fixtures/matches/match-1/edit', 'test-club-id')

      await screen.findByText('Edit Match')
      await user.click(screen.getByRole('tab', { name: 'Home XI' }))
      await screen.findByLabelText('Add player')

      await openPickerAndSelect(user)

      expect(screen.queryByText('Replace the current Playing XI?')).not.toBeInTheDocument()
      expect(removeMatchSidePlayer).not.toHaveBeenCalled()

      await waitFor(() => expect(addMatchSidePlayer).toHaveBeenCalledTimes(2))
      expect(addMatchSidePlayer).toHaveBeenNthCalledWith(1, 'test-club-id', 'match-1', 'side-1', 'player-1', 'BATSMAN')
      expect(addMatchSidePlayer).toHaveBeenNthCalledWith(2, 'test-club-id', 'match-1', 'side-1', 'player-2', 'BOWLER')

      await waitFor(() =>
        expect(updateMatchSide).toHaveBeenCalledWith('test-club-id', 'match-1', 'side-1', {
          captainPlayerId: 'player-1',
          wicketKeeperPlayerId: 'player-2',
          twelfthManPlayerId: null,
        }),
      )
      expect(updateMatchSide).toHaveBeenCalledTimes(1)

      expect(await screen.findByText('Copied 2 of 2 players from the previous XI.')).toBeInTheDocument()
    })

    it('opens a confirm dialog when the destination side already has players, only copies on confirm, and leaves it untouched on cancel', async () => {
      const user = userEvent.setup()
      getMatch.mockResolvedValueOnce(makeMatch())
      listPreviousMatches.mockResolvedValue([PREVIOUS_MATCH])
      const destinationSide = makeSide({
        id: 'side-1',
        teamId: 'team-1',
        players: [{ playerProfileId: 'player-9', battingOrder: 1, role: 'BATSMAN' }],
      })
      const sourceSide = makeSide({
        id: 'side-source',
        teamId: 'team-1',
        captainPlayerId: 'player-1',
        wicketKeeperPlayerId: 'player-2',
        twelfthManPlayerId: null,
        players: [
          { playerProfileId: 'player-1', battingOrder: 1, role: 'BATSMAN' },
          { playerProfileId: 'player-2', battingOrder: 2, role: 'BOWLER' },
        ],
      })
      mockSourceAndDestinationSides(destinationSide, sourceSide)
      listSquad.mockResolvedValue([
        makeSquadMember({ playerProfileId: 'player-1', firstName: 'Jane', lastName: 'Smith' }),
        makeSquadMember({ playerProfileId: 'player-2', firstName: 'Bob', lastName: 'Jones' }),
        makeSquadMember({ playerProfileId: 'player-9', firstName: 'Old', lastName: 'Player' }),
      ])
      removeMatchSidePlayer.mockResolvedValue(makeSide())
      addMatchSidePlayer.mockResolvedValue(makeSide())
      updateMatchSide.mockResolvedValue(makeSide())

      renderPage('/manage/fixtures/matches/match-1/edit', 'test-club-id')

      await screen.findByText('Edit Match')
      await user.click(screen.getByRole('tab', { name: 'Home XI' }))
      await screen.findByLabelText('Add player')

      await openPickerAndSelect(user)

      expect(await screen.findByText('Replace the current Playing XI?')).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Cancel' }))
      await waitFor(() => expect(screen.queryByText('Replace the current Playing XI?')).not.toBeInTheDocument())
      expect(removeMatchSidePlayer).not.toHaveBeenCalled()
      expect(addMatchSidePlayer).not.toHaveBeenCalled()
      expect(updateMatchSide).not.toHaveBeenCalled()

      // Close the (still-open) picker itself and reopen fresh — re-selecting the exact same
      // Autocomplete option object without remounting is a MUI Autocomplete no-op (reference
      // equality short-circuit), not something a real re-open (new fetch/new picker session)
      // would ever hit in practice.
      await user.click(screen.getByRole('button', { name: 'Cancel' }))
      await waitFor(() => expect(screen.queryByRole('combobox', { name: 'Search' })).not.toBeInTheDocument())

      await user.click(screen.getByRole('button', { name: 'Re-select from Previous Match' }))
      await user.click(screen.getByRole('combobox', { name: 'Search' }))
      await user.click(await screen.findByText(/vs 2nd XI/))

      expect(await screen.findByText('Replace the current Playing XI?')).toBeInTheDocument()
      await user.click(await screen.findByRole('button', { name: 'Replace' }))

      await waitFor(() =>
        expect(removeMatchSidePlayer).toHaveBeenCalledWith('test-club-id', 'match-1', 'side-1', 'player-9'),
      )
      await waitFor(() => expect(addMatchSidePlayer).toHaveBeenCalledTimes(2))
      await waitFor(() => expect(updateMatchSide).toHaveBeenCalledTimes(2))
      expect(updateMatchSide).toHaveBeenNthCalledWith(1, 'test-club-id', 'match-1', 'side-1', {
        captainPlayerId: null,
        wicketKeeperPlayerId: null,
        twelfthManPlayerId: null,
      })
      expect(updateMatchSide).toHaveBeenNthCalledWith(2, 'test-club-id', 'match-1', 'side-1', {
        captainPlayerId: 'player-1',
        wicketKeeperPlayerId: 'player-2',
        twelfthManPlayerId: null,
      })
    })

    it('skips a player rejected with a 400, still completes the rest of the copy, and only carries captain/WK/12th over when they survived', async () => {
      const user = userEvent.setup()
      getMatch.mockResolvedValueOnce(makeMatch())
      listPreviousMatches.mockResolvedValue([PREVIOUS_MATCH])
      const destinationSide = makeSide({ id: 'side-1', teamId: 'team-1', players: [] })
      const sourceSide = makeSide({
        id: 'side-source',
        teamId: 'team-1',
        captainPlayerId: 'player-1',
        wicketKeeperPlayerId: 'player-2',
        twelfthManPlayerId: 'player-4',
        players: [
          { playerProfileId: 'player-1', battingOrder: 1, role: 'BATSMAN' },
          { playerProfileId: 'player-2', battingOrder: 2, role: 'BOWLER' },
          { playerProfileId: 'player-3', battingOrder: 3, role: 'ALL_ROUNDER' },
        ],
      })
      mockSourceAndDestinationSides(destinationSide, sourceSide)
      listSquad.mockResolvedValue([
        makeSquadMember({ playerProfileId: 'player-1', firstName: 'Jane', lastName: 'Smith' }),
        makeSquadMember({ playerProfileId: 'player-2', firstName: 'Bob', lastName: 'Jones' }),
        makeSquadMember({ playerProfileId: 'player-3', firstName: 'Amy', lastName: 'Lee' }),
        makeSquadMember({ playerProfileId: 'player-4', firstName: 'Sam', lastName: 'Patel' }),
      ])
      addMatchSidePlayer.mockImplementation(
        (_clubId: string, _matchId: string, _sideId: string, playerId: string) => {
          if (playerId === 'player-1') {
            return Promise.reject(Object.assign(new Error('Bad Request'), { isAxiosError: true, response: { status: 400 } }))
          }
          return Promise.resolve(makeSide())
        },
      )
      updateMatchSide.mockResolvedValue(makeSide())

      renderPage('/manage/fixtures/matches/match-1/edit', 'test-club-id')

      await screen.findByText('Edit Match')
      await user.click(screen.getByRole('tab', { name: 'Home XI' }))
      await screen.findByLabelText('Add player')

      await openPickerAndSelect(user)

      await waitFor(() => expect(addMatchSidePlayer).toHaveBeenCalledTimes(3))
      expect(addMatchSidePlayer).toHaveBeenNthCalledWith(1, 'test-club-id', 'match-1', 'side-1', 'player-1', 'BATSMAN')
      expect(addMatchSidePlayer).toHaveBeenNthCalledWith(2, 'test-club-id', 'match-1', 'side-1', 'player-2', 'BOWLER')
      expect(addMatchSidePlayer).toHaveBeenNthCalledWith(3, 'test-club-id', 'match-1', 'side-1', 'player-3', 'ALL_ROUNDER')

      // player-1 failed to copy, so the captain (player-1) can't carry over either — counted as a
      // second skip on top of the failed add. wicketKeeperPlayerId (player-2) copied successfully,
      // so it carries over; twelfthManPlayerId (player-4) was never attempted as an XI row and is
      // still in the squad, so it carries over too.
      await waitFor(() =>
        expect(updateMatchSide).toHaveBeenCalledWith('test-club-id', 'match-1', 'side-1', {
          captainPlayerId: null,
          wicketKeeperPlayerId: 'player-2',
          twelfthManPlayerId: 'player-4',
        }),
      )

      expect(await screen.findByText('Copied 2 of 3 players from the previous XI.')).toBeInTheDocument()
      expect(
        await screen.findByText("2 couldn't be copied — no longer eligible for this match. Add them manually."),
      ).toBeInTheDocument()
    })
  })

  // docs/specs/032-match-availability-polls.md
  it('edit mode: renders an Availability tab, gated the same as the XI tabs', async () => {
    getMatch.mockResolvedValueOnce(makeMatch())

    renderPage('/manage/fixtures/matches/match-1/edit', 'test-club-id')

    expect(await screen.findByText('Edit Match')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Availability' })).toBeInTheDocument()
  })

  it('create mode: does not render an Availability tab', async () => {
    createMatch.mockResolvedValueOnce(makeMatch())
    renderPage('/manage/fixtures/matches/new', 'test-club-id')

    expect(await screen.findByText('Add Match')).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Availability' })).not.toBeInTheDocument()
  })

  it('Availability tab: shows Home/Away sub-tabs and an "Open a poll" prompt when no poll exists yet', async () => {
    const user = userEvent.setup()
    getMatch.mockResolvedValueOnce(makeMatch())

    renderPage('/manage/fixtures/matches/match-1/edit', 'test-club-id')

    await screen.findByText('Edit Match')
    await user.click(screen.getByRole('tab', { name: 'Availability' }))

    expect(screen.getByRole('tab', { name: 'Home' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Away' })).toBeInTheDocument()
    expect(await screen.findByText(/no availability poll yet/i)).toBeInTheDocument()
  })

  it('Availability tab: clicking "Open a poll for this side" calls createPoll for that side\'s teamId, not auto-created on mount', async () => {
    const user = userEvent.setup()
    getMatch.mockResolvedValueOnce(makeMatch())
    createPoll.mockResolvedValueOnce({
      id: 'poll-1',
      teamId: 'team-1',
      open: true,
      availableCount: 0,
      unavailableCount: 0,
      unsureCount: 0,
      noResponseCount: 0,
    })

    renderPage('/manage/fixtures/matches/match-1/edit', 'test-club-id')

    await screen.findByText('Edit Match')
    await user.click(screen.getByRole('tab', { name: 'Availability' }))
    await screen.findByText(/no availability poll yet/i)

    expect(createPoll).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: /open a poll for this side/i }))

    expect(createPoll).toHaveBeenCalledWith('test-club-id', 'match-1', 'team-1')
  })

  it('Availability tab: renders the summary/squad list once a poll exists for that side', async () => {
    const user = userEvent.setup()
    getMatch.mockResolvedValueOnce(makeMatch())
    listPolls.mockResolvedValue([
      { id: 'poll-1', teamId: 'team-1', open: true, availableCount: 1, unavailableCount: 0, unsureCount: 0, noResponseCount: 0 },
    ])
    getPollResponses.mockResolvedValueOnce({
      pollId: 'poll-1',
      teamId: 'team-1',
      open: true,
      availableCount: 1,
      unavailableCount: 0,
      unsureCount: 0,
      noResponseCount: 0,
      responses: [{ playerProfileId: 'p1', firstName: 'Jane', lastName: 'Smith', squadJerseyNumber: null, status: 'AVAILABLE' }],
      publicPath: '/poll/poll-1',
    })

    renderPage('/manage/fixtures/matches/match-1/edit', 'test-club-id')

    await screen.findByText('Edit Match')
    await user.click(screen.getByRole('tab', { name: 'Availability' }))

    expect(await screen.findByText('Jane Smith')).toBeInTheDocument()
    expect(getPollResponses).toHaveBeenCalledWith('test-club-id', 'match-1', 'poll-1')
  })

  it('Availability tab: clicking "Share invite" opens PollShareDialog wired to that side\'s match/team/poll', async () => {
    const user = userEvent.setup()
    getMatch.mockResolvedValueOnce(makeMatch())
    listPolls.mockResolvedValue([
      { id: 'poll-1', teamId: 'team-1', open: true, availableCount: 0, unavailableCount: 0, unsureCount: 0, noResponseCount: 0 },
    ])
    getPollResponses.mockResolvedValue({
      pollId: 'poll-1',
      teamId: 'team-1',
      open: true,
      availableCount: 0,
      unavailableCount: 0,
      unsureCount: 0,
      noResponseCount: 0,
      responses: [],
      publicPath: '/poll/poll-1',
    })

    renderPage('/manage/fixtures/matches/match-1/edit', 'test-club-id')

    await screen.findByText('Edit Match')
    await user.click(screen.getByRole('tab', { name: 'Availability' }))
    await screen.findByRole('button', { name: /share invite/i })

    // Not rendered until the admin explicitly opens it.
    expect(screen.queryByRole('heading', { name: 'Share invite' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /share invite/i }))

    expect(await screen.findByRole('heading', { name: 'Share invite' })).toBeInTheDocument()
    // PollShareDialog's generated invite text embeds this poll's own id and the venue from
    // this side's own match — confirming it opened with the right match/team/poll context, not
    // just an empty dialog.
    const textarea = screen.getByLabelText('Invite text') as HTMLTextAreaElement
    expect(textarea.value).toContain('/poll/poll-1')
    expect(textarea.value).toContain('Riverside Oval')
  })

  // docs/specs/034-availability-polls-dashboard.md: AvailabilityPollsDashboard's own "Manage
  // responses" deep-link — matches the existing ?tab=playing-xi deep-link's shape (SquadPicker's
  // own cards).
  it('?tab=availability&side=home selects the Availability tab and the Home sub-tab on load', async () => {
    getMatch.mockResolvedValueOnce(makeMatch())

    renderPage('/manage/fixtures/matches/match-1/edit?tab=availability&side=home', 'test-club-id')

    await screen.findByText('Edit Match')

    expect(screen.getByRole('tab', { name: 'Availability' })).toHaveAttribute('aria-selected', 'true')
    expect(await screen.findByRole('tab', { name: 'Home' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Away' })).toHaveAttribute('aria-selected', 'false')
  })

  it('?tab=availability&side=away selects the Availability tab and the Away sub-tab on load', async () => {
    const user = userEvent.setup()
    getMatch.mockResolvedValueOnce(makeMatch())
    createPoll.mockResolvedValueOnce({
      id: 'poll-2',
      teamId: 'team-2',
      open: true,
      availableCount: 0,
      unavailableCount: 0,
      unsureCount: 0,
      noResponseCount: 0,
    })

    renderPage('/manage/fixtures/matches/match-1/edit?tab=availability&side=away', 'test-club-id')

    await screen.findByText('Edit Match')

    expect(screen.getByRole('tab', { name: 'Availability' })).toHaveAttribute('aria-selected', 'true')
    expect(await screen.findByRole('tab', { name: 'Away' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Home' })).toHaveAttribute('aria-selected', 'false')

    // Confirms the panel showing is genuinely the away side's own poll panel, not just the tab
    // label — "Open a poll for this side" here creates a poll for team-2 (away), not team-1.
    await user.click(screen.getByRole('button', { name: /open a poll for this side/i }))
    expect(createPoll).toHaveBeenCalledWith('test-club-id', 'match-1', 'team-2')
  })

  // docs/specs/038-move-deactivate-to-edit-screen.md: relocated from MatchList's own card, plus
  // the tab-gating restructure — the button must render on every tab, not just Details.
  describe('Deactivate/Reactivate', () => {
    it('edit mode: renders Deactivate for an active match on the Details tab, clicking it calls deactivateMatch', async () => {
      const user = userEvent.setup()
      getMatch.mockResolvedValueOnce(makeMatch({ active: true }))
      // onSuccess invalidates ['managed-club', clubId, 'matches'], which prefix-matches this
      // page's own single-record query too, triggering a refetch that must resolve to the
      // now-inactive record for the button to relabel.
      getMatch.mockResolvedValueOnce(makeMatch({ active: false }))
      let resolveDeactivate: (value: Match) => void = () => {}
      deactivateMatch.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveDeactivate = resolve
        }),
      )

      renderPage('/manage/fixtures/matches/match-1/edit', 'test-club-id')

      await screen.findByText('Edit Match')
      await user.click(screen.getByRole('button', { name: 'Deactivate' }))

      expect(deactivateMatch).toHaveBeenCalledWith('test-club-id', 'match-1')
      expect(await screen.findByRole('button', { name: 'Deactivating…' })).toBeInTheDocument()

      resolveDeactivate(makeMatch({ active: false }))

      expect(await screen.findByRole('button', { name: 'Reactivate' })).toBeInTheDocument()
    })

    it('edit mode: renders Reactivate for an inactive match, clicking it calls reactivateMatch', async () => {
      const user = userEvent.setup()
      getMatch.mockResolvedValueOnce(makeMatch({ active: false }))
      // onSuccess invalidates ['managed-club', clubId, 'matches'], which prefix-matches this
      // page's own single-record query too, triggering a refetch.
      getMatch.mockResolvedValueOnce(makeMatch({ active: true }))
      reactivateMatch.mockResolvedValueOnce(makeMatch({ active: true }))

      renderPage('/manage/fixtures/matches/match-1/edit', 'test-club-id')

      await screen.findByText('Edit Match')
      await user.click(screen.getByRole('button', { name: 'Reactivate' }))

      expect(reactivateMatch).toHaveBeenCalledWith('test-club-id', 'match-1')
    })

    it('still renders on the Home XI tab, while Save is hidden there', async () => {
      const user = userEvent.setup()
      getMatch.mockResolvedValueOnce(makeMatch({ active: true }))

      renderPage('/manage/fixtures/matches/match-1/edit', 'test-club-id')

      await screen.findByText('Edit Match')
      await user.click(screen.getByRole('tab', { name: 'Home XI' }))

      expect(await screen.findByRole('button', { name: 'Deactivate' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument()
    })
  })
})
