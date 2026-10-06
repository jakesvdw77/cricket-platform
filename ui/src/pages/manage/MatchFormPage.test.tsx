import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MatchFormPage from './MatchFormPage'
import type { Match } from '../../api/matchApi'
import type { MatchSide } from '../../api/matchSideApi'
import type { SelectionPool, SelectionPoolEntry } from '../../api/matchSelectionApi'

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
const getPollResponses = vi.fn()
const createPlayer = vi.fn()
const addToSquad = vi.fn()
const getMatchSquad = vi.fn()
const addToMatchSquad = vi.fn()
const removeFromMatchSquad = vi.fn()
const updateMatchSquadJerseyNumber = vi.fn()
const getRoundResponses = vi.fn()
const getSelectionPool = vi.fn()
const applySelection = vi.fn()
const setPlayerStatus = vi.fn()
const setRoundPlayerStatus = vi.fn()

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

const activateSession = vi.fn()
const listLeagueTeams = vi.fn()

vi.mock('../../api/meApi', () => ({
  activateSession: () => activateSession(),
}))

vi.mock('../../api/leagueTeamApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/leagueTeamApi')>()
  return {
    ...actual,
    listLeagueTeams: (clubId: string, leagueId: string, seasonId: string) => listLeagueTeams(clubId, leagueId, seasonId),
  }
})

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

// docs/specs/076-team-selection.md: the selection pool (names and availability of the selected
// players, and the dialog's candidates) and the atomic apply; the rest of the module stays real.
vi.mock('../../api/matchSelectionApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/matchSelectionApi')>()
  return {
    ...actual,
    getSelectionPool: (clubId: string, matchId: string, teamId: string, params: unknown) =>
      getSelectionPool(clubId, matchId, teamId, params),
    applySelection: (clubId: string, matchId: string, sideId: string, request: unknown) =>
      applySelection(clubId, matchId, sideId, request),
  }
})

vi.mock('../../api/matchAvailabilityApi', () => ({
  listPolls: (clubId: string, matchId: string) => listPolls(clubId, matchId),
  getPollResponses: (clubId: string, matchId: string, pollId: string) => getPollResponses(clubId, matchId, pollId),
  setPlayerStatus: (clubId: string, matchId: string, pollId: string, playerId: string, status: string) =>
    setPlayerStatus(clubId, matchId, pollId, playerId, status),
}))

// docs/specs/063-section-availability-and-flexible-squads.md Part B/C/D: a FLEXIBLE side's own
// squad pool (Match Squad tab) and, via its resolved roundId, 033's tinting source (Part D) —
// only the two exports MatchSideTab itself reads from each module are wired to a real fn, the
// rest of matchSquadApi's surface is exercised by MatchSquadPicker's own tests, not here.
vi.mock('../../api/matchSquadApi', () => ({
  getMatchSquad: (clubId: string, matchId: string, teamId: string) => getMatchSquad(clubId, matchId, teamId),
  addToMatchSquad: (clubId: string, matchId: string, teamId: string, playerId: string) =>
    addToMatchSquad(clubId, matchId, teamId, playerId),
  removeFromMatchSquad: (clubId: string, matchId: string, teamId: string, playerId: string) =>
    removeFromMatchSquad(clubId, matchId, teamId, playerId),
  updateMatchSquadJerseyNumber: (clubId: string, matchId: string, teamId: string, playerId: string, jerseyNumber: number | null) =>
    updateMatchSquadJerseyNumber(clubId, matchId, teamId, playerId, jerseyNumber),
}))

vi.mock('../../api/sectionAvailabilityApi', () => ({
  getRoundResponses: (clubId: string, roundId: string) => getRoundResponses(clubId, roundId),
  setRoundPlayerStatus: (clubId: string, roundId: string, playerId: string, windowId: string, status: string) =>
    setRoundPlayerStatus(clubId, roundId, playerId, windowId, status),
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
    homePickedCount: null,
    awayPickedCount: null,
    playingXiSize: null,
    polls: [],
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
    limits: { battingPlaces: 11, twelfthManAllowed: true, maxSelected: 12 },
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

function makeEntry(
  playerProfileId: string,
  firstName: string,
  lastName: string,
  overrides: Partial<SelectionPoolEntry> = {},
): SelectionPoolEntry {
  return {
    playerProfileId,
    firstName,
    lastName,
    jerseyNumber: null,
    availability: 'AVAILABLE',
    selected: false,
    selectable: true,
    reason: null,
    reasonText: null,
    taken: null,
    ...overrides,
  }
}

function makePool(entries: SelectionPoolEntry[], kind: 'NONE' | 'SQUAD' | 'GROUP' = 'NONE'): SelectionPool {
  return {
    matchId: 'match-1',
    teamId: 'team-1',
    sideId: 'side-1',
    basis: 'ROSTER',
    wholeSection: false,
    coveringPoll: { kind, pollId: kind === 'SQUAD' ? 'poll-1' : null, roundId: kind === 'GROUP' ? 'round-1' : null, matchId: 'match-1' },
    truncated: false,
    entries,
  }
}

const UNCOVERED_SQUAD = {
  sectionId: 'section-1',
  windowDate: null,
  dayPart: null,
  windowId: null,
  windowOpen: false,
  roundId: null,
  candidates: [],
  selected: [],
}

beforeEach(() => {
  vi.clearAllMocks()
  activateSession.mockResolvedValue({ personId: null, personStatus: null, platformAdmin: false, clubAdminClubIds: [] })
  listLeagueTeams.mockResolvedValue([])
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
  // docs/specs/064-unified-availability-polls.md: coverage is resolved for every real-Team side on
  // load - by default nothing covers the match (windowId null, no squad poll).
  getMatchSquad.mockResolvedValue(UNCOVERED_SQUAD)
  getSelectionPool.mockResolvedValue(makePool([]))
})

function LocationProbe() {
  const location = useLocation()
  return <div>At: {location.pathname + location.search}</div>
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
          <Route path="/manage/fixtures" element={<OutletContextWrapper clubId={clubId} />}>
            <Route path="matches" element={<div>Match List Page</div>} />
            <Route path="matches/new" element={<MatchFormPage />} />
            <Route path="matches/:matchId/edit" element={<MatchFormPage />} />
          </Route>
          <Route path="*" element={<LocationProbe />} />
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
          matchCount: null,
          playedCount: null,
          firstMatchDate: null,
          lastMatchDate: null,
          nextMatchDate: null,
          teams: null,
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

  it('Home XI tab: creates a MatchSide on first use when none exists yet, then renders the selection page', async () => {
    const user = userEvent.setup()
    getMatch.mockResolvedValueOnce(makeMatch())
    listMatchSides.mockResolvedValueOnce([]).mockResolvedValue([makeSide()])
    createMatchSide.mockResolvedValueOnce(makeSide())

    renderPage('/manage/fixtures/matches/match-1/edit', 'test-club-id')

    await screen.findByText('Edit Match')
    await user.click(screen.getByRole('tab', { name: 'Home XI' }))

    expect(await screen.findByRole('button', { name: 'Select players' })).toBeInTheDocument()
    expect(createMatchSide).toHaveBeenCalledWith('test-club-id', 'match-1', 'team-1')
  })

  it('Home XI tab: reuses an existing MatchSide without creating a duplicate', async () => {
    const user = userEvent.setup()
    getMatch.mockResolvedValueOnce(makeMatch())
    listMatchSides.mockResolvedValue([makeSide({ teamId: 'team-1' })])

    renderPage('/manage/fixtures/matches/match-1/edit', 'test-club-id')

    await screen.findByText('Edit Match')
    await user.click(screen.getByRole('tab', { name: 'Home XI' }))

    expect(await screen.findByRole('button', { name: 'Select players' })).toBeInTheDocument()
    expect(createMatchSide).not.toHaveBeenCalled()
  })

  // docs/specs/037-match-improvements.md item 5, re-expressed by 076 as the tap-a-name menu: PUT
  // .../sides/{sideId} is a full 3-field replace, so Make captain must send the side's own current
  // keeper and 12th man too.
  it('Make captain in the tap menu sends a merged 3-field payload, not partial', async () => {
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
          { playerProfileId: 'player-3', battingOrder: null, role: 'BATSMAN' },
        ],
      }),
    ])
    getSelectionPool.mockResolvedValue(
      makePool([
        makeEntry('player-1', 'Jane', 'Smith', { selected: true }),
        makeEntry('player-2', 'Bob', 'Jones', { selected: true }),
        makeEntry('player-3', 'Amy', 'Lee', { selected: true }),
      ]),
    )
    updateMatchSide.mockResolvedValueOnce(makeSide())

    renderPage('/manage/fixtures/matches/match-1/edit', 'test-club-id')

    await screen.findByText('Edit Match')
    await user.click(screen.getByRole('tab', { name: 'Home XI' }))

    await user.click(await screen.findByRole('button', { name: 'Jane Smith, open menu' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Make captain' }))

    expect(updateMatchSide).toHaveBeenCalledWith('test-club-id', 'match-1', 'side-1', {
      captainPlayerId: 'player-1',
      wicketKeeperPlayerId: 'player-2',
      twelfthManPlayerId: 'player-3',
    })
  })

  // docs/specs/037-match-improvements.md item 8, moved by 076 into the Select players dialog as
  // "Add new player": always adds the player to the team's season roster, then switches the dialog
  // to Whole section with the new player's name in the search.
  it('"Add new player" in the Select players dialog creates a player, adds them to the season roster and searches the whole section for them', async () => {
    const user = userEvent.setup()
    getMatch.mockResolvedValueOnce(makeMatch())
    listMatchSides.mockResolvedValue([makeSide({ teamId: 'team-1' })])
    createPlayer.mockResolvedValueOnce({ id: 'player-9', firstName: 'New', lastName: 'Player' })
    addToSquad.mockResolvedValueOnce(makeSquadMember({ playerProfileId: 'player-9' }))

    renderPage('/manage/fixtures/matches/match-1/edit', 'test-club-id')

    await screen.findByText('Edit Match')
    await user.click(screen.getByRole('tab', { name: 'Home XI' }))
    await user.click(await screen.findByRole('button', { name: 'Select players' }))

    await user.click(await screen.findByRole('button', { name: 'Add new player' }))
    await user.type(await screen.findByLabelText('First name'), 'New')
    await user.type(screen.getByLabelText('Last name'), 'Player')
    await user.click(screen.getByRole('button', { name: 'Create & link' }))

    await waitFor(() =>
      expect(createPlayer).toHaveBeenCalledWith('test-club-id', expect.objectContaining({ firstName: 'New', lastName: 'Player' })),
    )
    await waitFor(() => expect(addToSquad).toHaveBeenCalledWith('test-club-id', 'team-1', 'season-1', 'player-9'))
    await waitFor(() =>
      expect(getSelectionPool).toHaveBeenCalledWith('test-club-id', 'match-1', 'team-1', { wholeSection: true, q: 'New Player' }),
    )
  })

  // docs/specs/037-match-improvements.md item 9, replaced by 076's 'From previous match' chip in the
  // Select players dialog: the page has no Re-select button any more; the chip filters the (whole
  // section) pool to the players of the chosen previous match, in that match's batting order.
  describe('From previous match (Select players dialog)', () => {
    const PREVIOUS_MATCH = makeMatch({
      id: 'prev-match-1',
      homeTeamId: 'team-1',
      homeTeamName: null,
      awayTeamId: 'team-2',
      awayTeamName: null,
      matchDate: '2026-05-01T14:30:00Z',
    })

    it('has no Re-select from previous match button on the page', async () => {
      const user = userEvent.setup()
      getMatch.mockResolvedValueOnce(makeMatch())
      listMatchSides.mockResolvedValue([makeSide({ id: 'side-1', teamId: 'team-1', players: [] })])

      renderPage('/manage/fixtures/matches/match-1/edit', 'test-club-id')

      await screen.findByText('Edit Match')
      await user.click(screen.getByRole('tab', { name: 'Home XI' }))
      await screen.findByRole('button', { name: 'Select players' })
      expect(screen.queryByRole('button', { name: 'Re-select from previous match' })).not.toBeInTheDocument()
    })

    it('shows only the players of the chosen match, in its batting order, from the whole-section pool', async () => {
      const user = userEvent.setup()
      getMatch.mockResolvedValueOnce(makeMatch())
      listPreviousMatches.mockResolvedValue([PREVIOUS_MATCH])
      const sourceSide = makeSide({
        id: 'side-source',
        teamId: 'team-1',
        players: [
          { playerProfileId: 'player-2', battingOrder: 1, role: 'BOWLER' },
          { playerProfileId: 'player-1', battingOrder: 2, role: 'BATSMAN' },
        ],
      })
      listMatchSides.mockImplementation((_clubId: string, matchId: string) =>
        Promise.resolve(matchId === 'prev-match-1' ? [sourceSide] : [makeSide({ id: 'side-1', teamId: 'team-1', players: [] })]),
      )
      getSelectionPool.mockResolvedValue(
        makePool([
          makeEntry('player-1', 'Jane', 'Smith'),
          makeEntry('player-2', 'Bob', 'Jones'),
          makeEntry('player-3', 'Amy', 'Lee'),
        ]),
      )

      renderPage('/manage/fixtures/matches/match-1/edit', 'test-club-id')

      await screen.findByText('Edit Match')
      await user.click(screen.getByRole('tab', { name: 'Home XI' }))
      await user.click(await screen.findByRole('button', { name: 'Select players' }))
      await user.click(await screen.findByRole('button', { name: 'From previous match' }))

      expect(await screen.findByText('Choose a match to show the players who played in it.')).toBeInTheDocument()
      await user.click(screen.getByRole('combobox', { name: 'Previous match' }))
      await user.click(await screen.findByRole('option', { name: /vs 2nd XI/ }))

      await waitFor(() => expect(screen.getByText('Bob Jones')).toBeInTheDocument())
      expect(getSelectionPool).toHaveBeenCalledWith('test-club-id', 'match-1', 'team-1', { wholeSection: true, q: '' })
      expect(screen.queryByText('Amy Lee')).not.toBeInTheDocument()
      const names = screen.getAllByText(/^(Bob Jones|Jane Smith)$/).map((node) => node.textContent)
      expect(names).toEqual(['Bob Jones', 'Jane Smith'])
    })
  })

  // docs/specs/075-match-view-and-edit.md: the Availability tab is gone, replaced by one header
  // Availability button with the card's destination rule.
  describe('Availability header button and tab order (075)', () => {
    const GROUP_COVERED = {
      sectionId: 'section-1',
      windowDate: '2026-06-01',
      dayPart: 'AFTERNOON',
      windowId: 'window-1',
      windowOpen: true,
      roundId: 'round-1',
      candidates: [],
      selected: [],
    }
    const poll = (id: string, teamId: string, open = true) => ({
      id,
      teamId,
      open,
      autoClose: true,
      scheduledCloseAt: null,
      availableCount: 0,
      unavailableCount: 0,
      unsureCount: 0,
      noResponseCount: 0,
    })

    it('renders no Availability tab in edit mode', async () => {
      getMatch.mockResolvedValueOnce(makeMatch())

      renderPage('/manage/fixtures/matches/match-1/edit', 'test-club-id')

      expect(await screen.findByText('Edit Match')).toBeInTheDocument()
      expect(screen.queryByRole('tab', { name: 'Availability' })).not.toBeInTheDocument()
    })

    it('create mode: renders no Availability button and no tabs', async () => {
      renderPage('/manage/fixtures/matches/new', 'test-club-id')

      expect(await screen.findByText('Add Match')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Availability' })).not.toBeInTheDocument()
      expect(screen.queryByRole('tab')).not.toBeInTheDocument()
    })

    it('orders the tabs Details, Home XI, Away XI even when a group poll covers the match (076: no Match Squad tab)', async () => {
      getMatch.mockResolvedValueOnce(makeMatch())
      getMatchSquad.mockResolvedValue(GROUP_COVERED)

      renderPage('/manage/fixtures/matches/match-1/edit', 'test-club-id')

      await screen.findByRole('tab', { name: 'Home XI' })
      await waitFor(() => expect(getMatchSquad).toHaveBeenCalled())
      expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Details', 'Home XI', 'Away XI'])
    })

    it('orders the tabs Details, Home XI, Away XI with no Match Squad when nothing is group-covered', async () => {
      getMatch.mockResolvedValueOnce(makeMatch())

      renderPage('/manage/fixtures/matches/match-1/edit', 'test-club-id')

      await screen.findByText('Edit Match')
      await waitFor(() => expect(getMatchSquad).toHaveBeenCalled())
      expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Details', 'Home XI', 'Away XI'])
    })

    it('shows no tab bar for a match with only free-text sides', async () => {
      getMatch.mockResolvedValueOnce(
        makeMatch({ homeTeamId: null, homeTeamName: 'A', awayTeamId: null, awayTeamName: 'B' }),
      )

      renderPage('/manage/fixtures/matches/match-1/edit', 'test-club-id')

      expect(await screen.findByText('Edit Match')).toBeInTheDocument()
      expect(screen.queryByRole('tab')).not.toBeInTheDocument()
    })

    it('the Availability button is on the title row and opens the prefilled New poll flow with no poll', async () => {
      const user = userEvent.setup()
      getMatch.mockResolvedValueOnce(makeMatch())

      renderPage('/manage/fixtures/matches/match-1/edit', 'test-club-id')

      await screen.findByText('Edit Match')
      const button = await screen.findByRole('button', { name: 'Availability' })
      await waitFor(() => expect(button).toBeEnabled())
      expect(screen.getByTestId('record-form-title-row')).toContainElement(button)
      await user.click(button)

      expect(
        await screen.findByText('At: /manage/availability/new?type=group&sectionId=section-1&matchId=match-1'),
      ).toBeInTheDocument()
    })

    it('goes to the squad Responses page with one squad poll', async () => {
      const user = userEvent.setup()
      getMatch.mockResolvedValueOnce(makeMatch())
      listPolls.mockResolvedValue([poll('poll-1', 'team-1')])

      renderPage('/manage/fixtures/matches/match-1/edit', 'test-club-id')

      await screen.findByText('Edit Match')
      const button = screen.getByRole('button', { name: 'Availability' })
      await waitFor(() => expect(button).toBeEnabled())
      await user.click(button)

      expect(await screen.findByText('At: /manage/availability/squad/match-1/poll-1')).toBeInTheDocument()
    })

    it('goes to the group Responses page when a group poll covers the match', async () => {
      const user = userEvent.setup()
      getMatch.mockResolvedValueOnce(makeMatch())
      getMatchSquad.mockResolvedValue(GROUP_COVERED)

      renderPage('/manage/fixtures/matches/match-1/edit', 'test-club-id')

      await screen.findByRole('tab', { name: 'Home XI' })
      const button = screen.getByRole('button', { name: 'Availability' })
      await waitFor(() => expect(button).toBeEnabled())
      await user.click(button)

      expect(await screen.findByText('At: /manage/availability/group/round-1')).toBeInTheDocument()
    })

    it('opens a Home/Away menu when both sides have a squad poll, each option opening its Responses page', async () => {
      const user = userEvent.setup()
      getMatch.mockResolvedValueOnce(makeMatch())
      listPolls.mockResolvedValue([poll('poll-1', 'team-1'), poll('poll-2', 'team-2')])

      renderPage('/manage/fixtures/matches/match-1/edit', 'test-club-id')

      await screen.findByText('Edit Match')
      const button = screen.getByRole('button', { name: 'Availability' })
      await waitFor(() => expect(button).toBeEnabled())
      await user.click(button)

      const menu = await screen.findByRole('menu', { name: 'Availability polls' })
      expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
        '1st XI · Home poll',
        '2nd XI · Away poll',
      ])
      await user.click(screen.getByRole('menuitem', { name: '2nd XI · Away poll' }))
      expect(menu).not.toBeVisible()
      expect(await screen.findByText('At: /manage/availability/squad/match-1/poll-2')).toBeInTheDocument()
    })

    it('is disabled with the reason when neither side is a team', async () => {
      getMatch.mockResolvedValueOnce(
        makeMatch({ homeTeamId: null, homeTeamName: 'A', awayTeamId: null, awayTeamName: 'B' }),
      )

      renderPage('/manage/fixtures/matches/match-1/edit', 'test-club-id')

      await screen.findByText('Edit Match')
      const button = screen.getByRole('button', { name: 'Availability' })
      expect(button).toBeDisabled()
      expect(button.closest('span[title]')).toHaveAttribute('title', 'None of your teams is playing in this match')
    })

    it('keeps Availability disabled when the polls query fails', async () => {
      getMatch.mockResolvedValueOnce(makeMatch())
      listPolls.mockRejectedValue(new Error('boom'))

      renderPage('/manage/fixtures/matches/match-1/edit', 'test-club-id')

      await screen.findByText('Edit Match')
      await waitFor(() => expect(listPolls).toHaveBeenCalled())
      expect(screen.getByRole('button', { name: 'Availability' })).toBeDisabled()
    })

    it('shows Save only on Details', async () => {
      const user = userEvent.setup()
      getMatch.mockResolvedValueOnce(makeMatch())

      renderPage('/manage/fixtures/matches/match-1/edit', 'test-club-id')

      await screen.findByText('Edit Match')
      expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument()
      await user.click(screen.getByRole('tab', { name: 'Away XI' }))
      expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument()
    })

    it('?tab=availability and ?tab=availability&side=away stay on Details', async () => {
      getMatch.mockResolvedValueOnce(makeMatch())
      const { unmount } = renderPage('/manage/fixtures/matches/match-1/edit?tab=availability', 'test-club-id')
      await screen.findByText('Edit Match')
      expect(screen.getByRole('tab', { name: 'Details' })).toHaveAttribute('aria-selected', 'true')
      expect(screen.getByLabelText('Venue')).toBeInTheDocument()
      unmount()

      getMatch.mockResolvedValueOnce(makeMatch())
      renderPage('/manage/fixtures/matches/match-1/edit?tab=availability&side=away', 'test-club-id')
      await screen.findByText('Edit Match')
      expect(screen.getByRole('tab', { name: 'Details' })).toHaveAttribute('aria-selected', 'true')
      expect(screen.getByLabelText('Venue')).toBeInTheDocument()
    })

    it('?tab=playing-xi selects Home XI, or Away XI when only the away side is a team', async () => {
      getMatch.mockResolvedValueOnce(makeMatch())
      const { unmount } = renderPage('/manage/fixtures/matches/match-1/edit?tab=playing-xi', 'test-club-id')
      await screen.findByText('Edit Match')
      expect(await screen.findByRole('tab', { name: 'Home XI' })).toHaveAttribute('aria-selected', 'true')
      unmount()

      getMatch.mockResolvedValueOnce(makeMatch({ homeTeamId: null, homeTeamName: 'Them' }))
      renderPage('/manage/fixtures/matches/match-1/edit?tab=playing-xi', 'test-club-id')
      await screen.findByText('Edit Match')
      expect(await screen.findByRole('tab', { name: 'Away XI' })).toHaveAttribute('aria-selected', 'true')
    })

    it('an XI tab chosen by the user stays selected when coverage resolves afterwards, and no Match Squad tab appears', async () => {
      const user = userEvent.setup()
      getMatch.mockResolvedValueOnce(makeMatch())
      let resolveCoverage: (value: typeof GROUP_COVERED) => void = () => {}
      getMatchSquad.mockReturnValue(
        new Promise((resolve) => {
          resolveCoverage = resolve
        }),
      )

      renderPage('/manage/fixtures/matches/match-1/edit', 'test-club-id')

      await screen.findByText('Edit Match')
      await user.click(screen.getByRole('tab', { name: 'Away XI' }))
      expect(screen.getByRole('tab', { name: 'Away XI' })).toHaveAttribute('aria-selected', 'true')

      resolveCoverage(GROUP_COVERED)

      await waitFor(() => expect(getMatchSquad).toHaveBeenCalled())
      expect(screen.queryByRole('tab', { name: 'Match Squad' })).not.toBeInTheDocument()
      expect(screen.getByRole('tab', { name: 'Away XI' })).toHaveAttribute('aria-selected', 'true')
    })

    it('prefills the scoring and streaming links from the match and sends them in the payload', async () => {
      const user = userEvent.setup()
      getMatch.mockResolvedValueOnce(
        makeMatch({ scoringUrl: 'https://cricclubs.com/matches/1', streamingUrl: 'https://pitchvision.example/live' }),
      )
      updateMatch.mockResolvedValue(makeMatch())

      renderPage('/manage/fixtures/matches/match-1/edit', 'test-club-id')

      await screen.findByText('Edit Match')
      expect(screen.getByLabelText('Scoring link')).toHaveValue('https://cricclubs.com/matches/1')
      expect(screen.getByLabelText('Streaming link')).toHaveValue('https://pitchvision.example/live')
      await user.click(screen.getByRole('button', { name: 'Save changes' }))

      await waitFor(() =>
        expect(updateMatch).toHaveBeenCalledWith(
          'test-club-id',
          'match-1',
          expect.objectContaining({
            scoringUrl: 'https://cricclubs.com/matches/1',
            streamingUrl: 'https://pitchvision.example/live',
          }),
        ),
      )
    })
  })

  // docs/specs/076-team-selection.md section 2: the 033 tinting (poll responses fetched by the page)
  // is replaced by badges and one summary line, both read from the selection pool.
  describe('Playing XI tab: availability comes from the selection pool (076)', () => {
    const TWO_PLAYERS = [
      { playerProfileId: 'player-1', battingOrder: 1, role: 'BATSMAN' as const },
      { playerProfileId: 'player-2', battingOrder: 2, role: 'BOWLER' as const },
    ]

    it('shows an Unsure badge and one calm summary line for selected players who have not confirmed', async () => {
      const user = userEvent.setup()
      getMatch.mockResolvedValueOnce(makeMatch())
      listMatchSides.mockResolvedValue([makeSide({ teamId: 'team-1', players: TWO_PLAYERS })])
      getSelectionPool.mockResolvedValue(
        makePool(
          [
            makeEntry('player-1', 'Jane', 'Smith', { selected: true, availability: 'UNSURE' }),
            makeEntry('player-2', 'Bob', 'Jones', { selected: true, availability: 'NO_RESPONSE' }),
          ],
          'GROUP',
        ),
      )

      renderPage('/manage/fixtures/matches/match-1/edit', 'test-club-id')

      await screen.findByText('Edit Match')
      await user.click(screen.getByRole('tab', { name: 'Home XI' }))

      expect(await screen.findByText("2 selected players are not confirmed available")).toBeInTheDocument()
      expect(screen.getByText('Unsure')).toBeInTheDocument()
      expect(screen.getByText('No response')).toBeInTheDocument()
      expect(getPollResponses).not.toHaveBeenCalled()
      expect(getRoundResponses).not.toHaveBeenCalled()
    })

    it('with no covering poll shows one marker line instead of a badge on every row', async () => {
      const user = userEvent.setup()
      getMatch.mockResolvedValueOnce(makeMatch())
      listMatchSides.mockResolvedValue([makeSide({ teamId: 'team-1', players: TWO_PLAYERS })])
      getSelectionPool.mockResolvedValue(
        makePool(
          [
            makeEntry('player-1', 'Jane', 'Smith', { selected: true, availability: 'NOT_POLLED' }),
            makeEntry('player-2', 'Bob', 'Jones', { selected: true, availability: 'NOT_POLLED' }),
          ],
          'NONE',
        ),
      )

      renderPage('/manage/fixtures/matches/match-1/edit', 'test-club-id')

      await screen.findByText('Edit Match')
      await user.click(screen.getByRole('tab', { name: 'Home XI' }))

      expect(
        await screen.findByText("No availability poll covers this match, so nobody's availability is confirmed."),
      ).toBeInTheDocument()
      expect(screen.queryByText('Not polled')).not.toBeInTheDocument()
    })
  })

  // docs/specs/076-team-selection.md sections 2 to 6 and the phase 1 decisions: the selection page of
  // one team (the Home XI tab) - header summary, Announce, the unconfirmed lines, the badges and the
  // dialog's Done and Set answer, all through the page's own queries and mutations.
  describe('Selection page (076)', () => {
    const FULL_PLAYERS = [
      { playerProfileId: 'player-1', battingOrder: 1, role: 'BATSMAN' as const },
      { playerProfileId: 'player-2', battingOrder: 2, role: 'BOWLER' as const },
    ]
    const NAMED_POOL = (kind: 'NONE' | 'SQUAD' | 'GROUP' = 'SQUAD', availability: SelectionPoolEntry['availability'] = 'AVAILABLE') =>
      makePool(
        [
          makeEntry('player-1', 'Jane', 'Smith', { selected: true, availability }),
          makeEntry('player-2', 'Bob', 'Jones', { selected: true, availability }),
        ],
        kind,
      )

    async function openHomeXi(side: Partial<MatchSide> = {}, pool: SelectionPool = NAMED_POOL()) {
      const user = userEvent.setup()
      getMatch.mockResolvedValue(makeMatch())
      listMatchSides.mockResolvedValue([makeSide({ teamId: 'team-1', players: FULL_PLAYERS, ...side })])
      getSelectionPool.mockResolvedValue(pool)
      renderPage('/manage/fixtures/matches/match-1/edit', 'test-club-id')
      await screen.findByText('Edit Match')
      await user.click(screen.getByRole('tab', { name: 'Home XI' }))
      await screen.findByRole('button', { name: 'Select players' })
      return user
    }

    const rowOrder = () => screen.getAllByTestId(/^selection-row-/).map((row) => row.getAttribute('data-testid'))

    it('shows the header summary and progress, and exactly two buttons: Select players and Announce team', async () => {
      await openHomeXi()
      const header = screen.getByTestId('selection-header')
      expect(within(header).getByRole('heading', { name: '1st XI · Home · vs 2nd XI' })).toBeInTheDocument()
      expect(within(header).getByText('Not announced')).toBeInTheDocument()
      expect(within(header).getByText('2 of 12')).toBeInTheDocument()
      expect(within(header).getByRole('progressbar', { name: '1st XI selection' })).toHaveAttribute('aria-valuenow', '2')
      expect(within(header).getAllByRole('button').map((button) => button.textContent)).toEqual(['Select players', 'Announce team'])
    })

    it('shows Un-announce instead of Announce for an announced side', async () => {
      await openHomeXi({ announced: true })
      expect(screen.getByRole('button', { name: 'Un-announce' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Announce team' })).not.toBeInTheDocument()
    })

    describe('Announce', () => {
      it('is disabled with the exact missing-items text when a player has no batting position', async () => {
        await openHomeXi({
          players: [
            { playerProfileId: 'player-1', battingOrder: 1, role: 'BATSMAN' },
            { playerProfileId: 'player-2', battingOrder: null, role: 'BOWLER' },
          ],
        })
        const button = screen.getByRole('button', { name: 'Announce team' })
        expect(button).toBeDisabled()
        expect(screen.getByText('Cannot announce 1st XI: 1 player has no batting position (Bob Jones).')).toBeInTheDocument()
        expect(screen.getByText('1 player is not in the batting order yet.')).toBeInTheDocument()
      })

      it('is disabled when more players are selected than the maximum', async () => {
        await openHomeXi({ limits: { battingPlaces: 1, twelfthManAllowed: false, maxSelected: 1 } })
        expect(screen.getByRole('button', { name: 'Announce team' })).toBeDisabled()
        expect(screen.getByText('Cannot announce 1st XI: 2 players are selected; the most allowed is 1.')).toBeInTheDocument()
      })

      it('is enabled when complete; the button opens a confirmation, and only the confirmation announces', async () => {
        const user = await openHomeXi()
        announceMatchSide.mockResolvedValue(makeSide({ announced: true }))
        const button = screen.getByRole('button', { name: 'Announce team' })
        expect(button).toBeEnabled()

        await user.click(button)
        const dialog = await screen.findByRole('dialog')
        expect(within(dialog).getByText('Announce this team?')).toBeInTheDocument()
        expect(within(dialog).getByText(/Nobody is notified automatically/)).toBeInTheDocument()
        expect(announceMatchSide).not.toHaveBeenCalled()

        await user.click(within(dialog).getByRole('button', { name: 'Announce team' }))
        await waitFor(() => expect(announceMatchSide).toHaveBeenCalledWith('test-club-id', 'match-1', 'side-1'))
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
      })

      it('Cancel on the confirmation announces nothing', async () => {
        const user = await openHomeXi()
        await user.click(screen.getByRole('button', { name: 'Announce team' }))
        const dialog = await screen.findByRole('dialog')
        await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
        expect(announceMatchSide).not.toHaveBeenCalled()
      })

      it('Un-announce calls the endpoint straight away', async () => {
        const user = await openHomeXi({ announced: true })
        unannounceMatchSide.mockResolvedValue(makeSide())
        await user.click(screen.getByRole('button', { name: 'Un-announce' }))
        await waitFor(() => expect(unannounceMatchSide).toHaveBeenCalledWith('test-club-id', 'match-1', 'side-1'))
      })
    })

    describe('unconfirmed and unavailable lines', () => {
      it('counts unsure, no response and not polled in one calm line, singular for one', async () => {
        await openHomeXi(
          {},
          makePool(
            [
              makeEntry('player-1', 'Jane', 'Smith', { selected: true, availability: 'UNSURE' }),
              makeEntry('player-2', 'Bob', 'Jones', { selected: true, availability: 'AVAILABLE' }),
            ],
            'SQUAD',
          ),
        )
        expect(screen.getByText('1 selected player is not confirmed available')).toBeInTheDocument()
        expect(screen.getByText('(1 unsure).', { exact: false })).toBeInTheDocument()
      })

      it('breaks several kinds down in the line', async () => {
        await openHomeXi(
          {},
          makePool(
            [
              makeEntry('player-1', 'Jane', 'Smith', { selected: true, availability: 'UNSURE' }),
              makeEntry('player-2', 'Bob', 'Jones', { selected: true, availability: 'NO_RESPONSE' }),
            ],
            'GROUP',
          ),
        )
        expect(screen.getByText('2 selected players are not confirmed available')).toBeInTheDocument()
        expect(screen.getByText('(1 unsure, 1 no response).', { exact: false })).toBeInTheDocument()
      })

      it('shows no unconfirmed line when everyone is confirmed available', async () => {
        await openHomeXi()
        expect(screen.queryByText(/not confirmed available/)).not.toBeInTheDocument()
        expect(screen.queryByText(/No availability poll covers/)).not.toBeInTheDocument()
      })

      it('shows the red line for selected players who have since said they are unavailable', async () => {
        await openHomeXi(
          {},
          makePool(
            [
              makeEntry('player-1', 'Jane', 'Smith', { selected: true, availability: 'UNAVAILABLE' }),
              makeEntry('player-2', 'Bob', 'Jones', { selected: true, availability: 'UNAVAILABLE' }),
            ],
            'SQUAD',
          ),
        )
        expect(screen.getByText('2 selected players have since said they are unavailable')).toBeInTheDocument()
        expect(screen.getAllByText('Said unavailable')).toHaveLength(2)
      })
    })

    describe('the list badges', () => {
      it('the role badge opens the role menu and changing the role calls the role endpoint', async () => {
        const user = await openHomeXi()
        updateMatchSidePlayerRole.mockResolvedValue(makeSide())
        await user.click(screen.getByRole('button', { name: 'Jane Smith, role Batsman, change role' }))
        await user.click(await screen.findByRole('menuitem', { name: 'Bowler' }))
        await waitFor(() =>
          expect(updateMatchSidePlayerRole).toHaveBeenCalledWith('test-club-id', 'match-1', 'side-1', 'player-1', 'BOWLER'),
        )
      })

      it('the Captain badge opens a Remove menu that clears the captain and keeps the rest of the payload', async () => {
        const user = await openHomeXi({ captainPlayerId: 'player-1', wicketKeeperPlayerId: 'player-2' })
        updateMatchSide.mockResolvedValue(makeSide())
        await user.click(screen.getByRole('button', { name: 'Jane Smith, captain, open options' }))
        await user.click(await screen.findByRole('menuitem', { name: 'Remove as captain' }))
        await waitFor(() =>
          expect(updateMatchSide).toHaveBeenCalledWith('test-club-id', 'match-1', 'side-1', {
            captainPlayerId: null,
            wicketKeeperPlayerId: 'player-2',
            twelfthManPlayerId: null,
          }),
        )
      })

      it('the Wicketkeeper badge opens a Remove menu that clears the keeper and keeps the captain', async () => {
        const user = await openHomeXi({ captainPlayerId: 'player-1', wicketKeeperPlayerId: 'player-2' })
        updateMatchSide.mockResolvedValue(makeSide())
        await user.click(screen.getByRole('button', { name: 'Bob Jones, wicketkeeper, open options' }))
        await user.click(await screen.findByRole('menuitem', { name: 'Remove as wicketkeeper' }))
        await waitFor(() =>
          expect(updateMatchSide).toHaveBeenCalledWith('test-club-id', 'match-1', 'side-1', {
            captainPlayerId: 'player-1',
            wicketKeeperPlayerId: null,
            twelfthManPlayerId: null,
          }),
        )
      })
    })

    describe('optimistic reorder', () => {
      it('shows the new order at once and sends the full order', async () => {
        const user = await openHomeXi()
        let resolveReorder: (side: MatchSide) => void = () => {}
        reorderMatchSidePlayers.mockReturnValue(new Promise<MatchSide>((resolve) => { resolveReorder = resolve }))
        expect(rowOrder()).toEqual(['selection-row-player-1', 'selection-row-player-2'])

        await user.click(screen.getByRole('button', { name: 'Bob Jones, open menu' }))
        await user.click(await screen.findByRole('menuitem', { name: 'Move up' }))

        await waitFor(() => expect(rowOrder()).toEqual(['selection-row-player-2', 'selection-row-player-1']))
        expect(reorderMatchSidePlayers).toHaveBeenCalledWith('test-club-id', 'match-1', 'side-1', ['player-2', 'player-1'])
        resolveReorder(makeSide())
      })

      it('rolls back to the server order and shows an error when the reorder fails', async () => {
        const user = await openHomeXi()
        reorderMatchSidePlayers.mockRejectedValue(new Error('conflict'))

        await user.click(screen.getByRole('button', { name: 'Bob Jones, open menu' }))
        await user.click(await screen.findByRole('menuitem', { name: 'Move up' }))

        expect(await screen.findByText('Something went wrong updating the team. Please try again.')).toBeInTheDocument()
        await waitFor(() => expect(rowOrder()).toEqual(['selection-row-player-1', 'selection-row-player-2']))
      })
    })

    describe('Select players dialog through the page', () => {
      it('Done adds new players at the end of the batting order and sends no role', async () => {
        const user = await openHomeXi({}, NAMED_POOL())
        getSelectionPool.mockResolvedValue(
          makePool([
            makeEntry('player-1', 'Jane', 'Smith', { selected: true }),
            makeEntry('player-2', 'Bob', 'Jones', { selected: true }),
            makeEntry('player-3', 'Amy', 'Lee'),
            makeEntry('player-4', 'Cal', 'Cox'),
          ]),
        )
        applySelection.mockResolvedValue(makeSide())

        await user.click(screen.getByRole('button', { name: 'Select players' }))
        await user.click(await screen.findByRole('checkbox', { name: 'Amy Lee' }))
        await user.click(screen.getByRole('checkbox', { name: 'Cal Cox' }))
        await user.click(screen.getByRole('button', { name: 'Done' }))

        await waitFor(() =>
          expect(applySelection).toHaveBeenCalledWith('test-club-id', 'match-1', 'side-1', {
            players: [
              { playerProfileId: 'player-1' },
              { playerProfileId: 'player-2' },
              { playerProfileId: 'player-3', battingOrder: 3 },
              { playerProfileId: 'player-4', battingOrder: 4 },
            ],
          }),
        )
        await waitFor(() => expect(screen.queryByText('Select players · 1st XI')).not.toBeInTheDocument())
      })

      it('a 409 with rejections keeps the dialog open and shows the reason on the row', async () => {
        const user = await openHomeXi({ players: [] }, makePool([makeEntry('player-3', 'Amy', 'Lee')]))
        const error = Object.assign(new Error('Conflict'), {
          isAxiosError: true,
          response: {
            status: 409,
            data: {
              detail: 'Some players cannot be selected',
              rejections: [{ playerProfileId: 'player-3', playerName: 'Amy Lee', reason: 'TAKEN_FOR_SLOT', message: 'Amy is already in 2nd XI.', taken: null }],
            },
          },
        })
        applySelection.mockRejectedValue(error)

        await user.click(screen.getByRole('button', { name: 'Select players' }))
        await user.click(await screen.findByRole('checkbox', { name: 'Amy Lee' }))
        await user.click(screen.getByRole('button', { name: 'Done' }))

        expect(await screen.findByText('Amy is already in 2nd XI.')).toBeInTheDocument()
        expect(screen.getByText('Select players · 1st XI')).toBeInTheDocument()
      })

      it('Set answer on a squad poll saves through the squad poll override and keeps the dialog open', async () => {
        const user = await openHomeXi({ players: [] }, makePool([], 'SQUAD'))
        getSelectionPool.mockResolvedValue(
          makePool([makeEntry('player-3', 'Amy', 'Lee', { availability: 'UNSURE', selectable: false, reason: 'NOT_CONFIRMED' })], 'SQUAD'),
        )
        setPlayerStatus.mockResolvedValue(undefined)

        await user.click(screen.getByRole('button', { name: 'Select players' }))
        await user.click(await screen.findByRole('button', { name: 'Set answer for Amy Lee' }))
        await user.click(await screen.findByRole('menuitem', { name: 'Available' }))

        await waitFor(() =>
          expect(setPlayerStatus).toHaveBeenCalledWith('test-club-id', 'match-1', 'poll-1', 'player-3', 'AVAILABLE'),
        )
        expect(screen.getByText('Select players · 1st XI')).toBeInTheDocument()
      })

      it('Set answer on a group poll saves through the round override with the match\'s window id', async () => {
        getMatchSquad.mockResolvedValue({
          sectionId: 'section-1', windowDate: '2026-06-01', dayPart: 'AFTERNOON', windowId: 'window-1',
          windowOpen: true, roundId: 'round-1', candidates: [], selected: [],
        })
        const user = await openHomeXi({ players: [] }, makePool([], 'GROUP'))
        getSelectionPool.mockResolvedValue(
          makePool([makeEntry('player-3', 'Amy', 'Lee', { availability: 'NO_RESPONSE', selectable: false, reason: 'NOT_CONFIRMED' })], 'GROUP'),
        )
        setRoundPlayerStatus.mockResolvedValue(undefined)

        await user.click(screen.getByRole('button', { name: 'Select players' }))
        await user.click(await screen.findByRole('button', { name: 'Set answer for Amy Lee' }))
        await user.click(await screen.findByRole('menuitem', { name: 'Unsure' }))

        await waitFor(() =>
          expect(setRoundPlayerStatus).toHaveBeenCalledWith('test-club-id', 'round-1', 'player-3', 'window-1', 'UNSURE'),
        )
      })
    })
  })

  // docs/specs/064-unified-availability-polls.md: each side's Availability / Match Squad tabs
  // branch on that side's coverage (squad endpoint windowId + the squad poll lookup), not a team
  // setting.
  describe('coverage branches (064)', () => {
    const GROUP_COVERED_SQUAD = {
      sectionId: 'section-1',
      windowDate: '2026-06-01',
      dayPart: 'AFTERNOON',
      windowId: 'window-1',
      windowOpen: true,
      roundId: 'round-1',
      candidates: [],
      selected: [],
    }

    beforeEach(() => {
      listMatchSides.mockResolvedValue([makeSide({ teamId: 'team-1', players: [] })])
    })

    it('uncovered side: no Match Squad top-level tab', async () => {
      getMatch.mockResolvedValueOnce(makeMatch())

      renderPage('/manage/fixtures/matches/match-1/edit', 'test-club-id')

      await screen.findByText('Edit Match')
      await waitFor(() => expect(getMatchSquad).toHaveBeenCalled())
      expect(screen.queryByRole('tab', { name: 'Match Squad' })).not.toBeInTheDocument()
    })

    it('squad-poll-covered side: no Match Squad tab', async () => {
      getMatch.mockResolvedValueOnce(makeMatch())
      listPolls.mockResolvedValue([
        { id: 'poll-1', teamId: 'team-1', open: true, autoClose: true, scheduledCloseAt: null, availableCount: 0, unavailableCount: 0, unsureCount: 0, noResponseCount: 0 },
      ])

      renderPage('/manage/fixtures/matches/match-1/edit', 'test-club-id')

      await screen.findByText('Edit Match')
      await waitFor(() => expect(getMatchSquad).toHaveBeenCalled())
      expect(screen.queryByRole('tab', { name: 'Match Squad' })).not.toBeInTheDocument()
    })

    it('group-covered side: no Match Squad tab and no "Covered by a group poll" panel (076)', async () => {
      getMatch.mockResolvedValueOnce(makeMatch())
      getMatchSquad.mockResolvedValue(GROUP_COVERED_SQUAD)

      renderPage('/manage/fixtures/matches/match-1/edit', 'test-club-id')

      await screen.findByText('Edit Match')
      await waitFor(() => expect(getMatchSquad).toHaveBeenCalled())
      expect(screen.queryByRole('tab', { name: 'Match Squad' })).not.toBeInTheDocument()
      expect(screen.queryByText('Covered by a group poll')).not.toBeInTheDocument()
    })

    it('?tab=match-squad&side=home now selects the Home XI tab', async () => {
      getMatch.mockResolvedValueOnce(makeMatch())
      getMatchSquad.mockResolvedValue(GROUP_COVERED_SQUAD)

      renderPage('/manage/fixtures/matches/match-1/edit?tab=match-squad&side=home', 'test-club-id')

      await screen.findByText('Edit Match')

      expect(await screen.findByRole('tab', { name: 'Home XI' })).toHaveAttribute('aria-selected', 'true')
    })

    it('?tab=match-squad&side=away now selects the Away XI tab, falling back to the other XI tab when that side is not a team', async () => {
      getMatch.mockResolvedValueOnce(makeMatch())
      getMatchSquad.mockResolvedValue(GROUP_COVERED_SQUAD)

      const { unmount } = renderPage('/manage/fixtures/matches/match-1/edit?tab=match-squad&side=away', 'test-club-id')

      await screen.findByText('Edit Match')
      expect(await screen.findByRole('tab', { name: 'Away XI' })).toHaveAttribute('aria-selected', 'true')
      unmount()

      getMatch.mockResolvedValueOnce(makeMatch({ awayTeamId: null, awayTeamName: 'Them' }))
      renderPage('/manage/fixtures/matches/match-1/edit?tab=match-squad&side=away', 'test-club-id')
      await screen.findByText('Edit Match')
      expect(await screen.findByRole('tab', { name: 'Home XI' })).toHaveAttribute('aria-selected', 'true')
    })
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
