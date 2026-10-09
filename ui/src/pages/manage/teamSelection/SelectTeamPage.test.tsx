import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SelectTeamPage from './SelectTeamPage'
import type { Match } from '../../../api/matchApi'
import type { MatchSide } from '../../../api/matchSideApi'
import type { SelectionPool, SelectionPoolEntry } from '../../../api/matchSelectionApi'

const getMatch = vi.fn()
const listPreviousMatches = vi.fn()
const listTeamsForClub = vi.fn()
const listSeasons = vi.fn()
const listLeagues = vi.fn()
const listMatchSides = vi.fn()
const createMatchSide = vi.fn()
const updateMatchSide = vi.fn()
const updateMatchSidePlayerRole = vi.fn()
const removeMatchSidePlayer = vi.fn()
const reorderMatchSidePlayers = vi.fn()
const announceMatchSide = vi.fn()
const unannounceMatchSide = vi.fn()
const listPolls = vi.fn()
const createPlayer = vi.fn()
const addToSquad = vi.fn()
const getMatchSquad = vi.fn()
const getSelectionPool = vi.fn()
const applySelection = vi.fn()
const setPlayerStatus = vi.fn()
const setRoundPlayerStatus = vi.fn()

vi.mock('../../../api/matchApi', () => ({
  getMatch: (clubId: string, matchId: string) => getMatch(clubId, matchId),
  listPreviousMatches: (clubId: string, teamId: string, seasonId: string, params: unknown) =>
    listPreviousMatches(clubId, teamId, seasonId, params),
}))

vi.mock('../matches/useTeamSheetShare', async () => ({ useTeamSheetShare: (await import('./teamSelectionShareMock')).useFakeTeamSheetShare }))

vi.mock('../../../api/playerApi', () => ({
  createPlayer: (clubId: string, payload: unknown) => createPlayer(clubId, payload),
}))

vi.mock('../../../api/teamApi', () => ({
  listTeamsForClub: (clubId: string) => listTeamsForClub(clubId),
}))

vi.mock('../../../api/seasonApi', () => ({
  listSeasons: (clubId: string) => listSeasons(clubId),
}))

vi.mock('../../../api/leagueApi', () => ({
  listLeagues: (clubId: string) => listLeagues(clubId),
}))

vi.mock('../../../api/teamSquadApi', () => ({
  addToSquad: (clubId: string, teamId: string, seasonId: string, playerId: string) =>
    addToSquad(clubId, teamId, seasonId, playerId),
}))

vi.mock('../../../api/matchSideApi', () => ({
  listMatchSides: (clubId: string, matchId: string) => listMatchSides(clubId, matchId),
  createMatchSide: (clubId: string, matchId: string, teamId: string) => createMatchSide(clubId, matchId, teamId),
  updateMatchSide: (clubId: string, matchId: string, sideId: string, payload: unknown) =>
    updateMatchSide(clubId, matchId, sideId, payload),
  updateMatchSidePlayerRole: (clubId: string, matchId: string, sideId: string, playerId: string, role: string) =>
    updateMatchSidePlayerRole(clubId, matchId, sideId, playerId, role),
  removeMatchSidePlayer: (clubId: string, matchId: string, sideId: string, playerId: string) =>
    removeMatchSidePlayer(clubId, matchId, sideId, playerId),
  reorderMatchSidePlayers: (clubId: string, matchId: string, sideId: string, ids: string[]) =>
    reorderMatchSidePlayers(clubId, matchId, sideId, ids),
  announceMatchSide: (clubId: string, matchId: string, sideId: string) => announceMatchSide(clubId, matchId, sideId),
  unannounceMatchSide: (clubId: string, matchId: string, sideId: string) => unannounceMatchSide(clubId, matchId, sideId),
}))

// docs/specs/076-team-selection.md: the selection pool (names and availability of the selected players, and the dialog's
// candidates) and the atomic apply; the rest of the module stays real.
vi.mock('../../../api/matchSelectionApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/matchSelectionApi')>()
  return {
    ...actual,
    getSelectionPool: (clubId: string, matchId: string, teamId: string, params: unknown) =>
      getSelectionPool(clubId, matchId, teamId, params),
    applySelection: (clubId: string, matchId: string, sideId: string, request: unknown) =>
      applySelection(clubId, matchId, sideId, request),
  }
})

vi.mock('../../../api/matchAvailabilityApi', () => ({
  listPolls: (clubId: string, matchId: string) => listPolls(clubId, matchId),
  setPlayerStatus: (clubId: string, matchId: string, pollId: string, playerId: string, status: string) =>
    setPlayerStatus(clubId, matchId, pollId, playerId, status),
}))

vi.mock('../../../api/matchSquadApi', () => ({
  getMatchSquad: (clubId: string, matchId: string, teamId: string) => getMatchSquad(clubId, matchId, teamId),
}))

vi.mock('../../../api/sectionAvailabilityApi', () => ({
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

function makeSquadMember(overrides: Partial<import('../../../api/teamSquadApi').SquadMember> = {}) {
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
  listTeamsForClub.mockResolvedValue([
    { id: 'team-1', clubId: 'test-club-id', sectionId: 'section-1', name: '1st XI', logoUrl: null, active: true, createdAt: '', updatedAt: '', updatedBy: null },
    { id: 'team-2', clubId: 'test-club-id', sectionId: 'section-1', name: '2nd XI', logoUrl: null, active: true, createdAt: '', updatedAt: '', updatedBy: null },
  ])
  listSeasons.mockResolvedValue([
    { id: 'season-1', clubId: 'test-club-id', label: '2026', startDate: '2026-01-01', endDate: '2026-12-31', active: true, createdAt: '', updatedAt: '', updatedBy: null },
  ])
  listLeagues.mockResolvedValue([])
  listMatchSides.mockResolvedValue([])
  listPolls.mockResolvedValue([])
  listPreviousMatches.mockResolvedValue([])
  // docs/specs/064-unified-availability-polls.md: coverage is resolved for every real-Team side on load - by default
  // nothing covers the match (windowId null, no squad poll).
  getMatchSquad.mockResolvedValue(UNCOVERED_SQUAD)
  getSelectionPool.mockResolvedValue(makePool([]))
})

function LocationProbe() {
  const location = useLocation()
  return <div>At: {location.pathname + location.search}</div>
}

const HOME = '/manage/team-selection/matches/match-1/sides/home'

function renderPage(initialPath: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const view = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/manage" element={<Outlet context={{ clubId: 'test-club-id' }} />}>
            <Route path="team-selection/matches/:matchId/sides/:sideId" element={<SelectTeamPage />} />
          </Route>
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return { ...view, queryClient }
}

describe('SelectTeamPage', () => {
  describe('the side the address names', () => {
    it('"home" creates the MatchSide of the home team on first use, then renders the selection page', async () => {
      getMatch.mockResolvedValue(makeMatch())
      listMatchSides.mockResolvedValueOnce([]).mockResolvedValue([makeSide()])
      createMatchSide.mockResolvedValueOnce(makeSide())

      renderPage(HOME)

      expect(await screen.findByRole('button', { name: 'Select players' })).toBeInTheDocument()
      expect(createMatchSide).toHaveBeenCalledWith('test-club-id', 'match-1', 'team-1')
    })

    it('"away" creates the MatchSide of the away team', async () => {
      getMatch.mockResolvedValue(makeMatch())
      listMatchSides.mockResolvedValueOnce([]).mockResolvedValue([makeSide({ id: 'side-2', teamId: 'team-2' })])
      createMatchSide.mockResolvedValueOnce(makeSide({ id: 'side-2', teamId: 'team-2' }))

      renderPage('/manage/team-selection/matches/match-1/sides/away')

      expect(await screen.findByRole('button', { name: 'Select players' })).toBeInTheDocument()
      expect(createMatchSide).toHaveBeenCalledWith('test-club-id', 'match-1', 'team-2')
    })

    it('a real side id reuses that side without creating a duplicate', async () => {
      getMatch.mockResolvedValue(makeMatch())
      listMatchSides.mockResolvedValue([makeSide({ teamId: 'team-1' }), makeSide({ id: 'side-2', teamId: 'team-2' })])

      renderPage('/manage/team-selection/matches/match-1/sides/side-2')

      expect(await screen.findByRole('button', { name: 'Select players' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Away XI' })).toHaveAttribute('aria-pressed', 'true')
      expect(createMatchSide).not.toHaveBeenCalled()
    })

    it('"away" falls back to the home side when the away side is not a team of the club', async () => {
      getMatch.mockResolvedValue(makeMatch({ awayTeamId: null, awayTeamName: 'Riverside Occasionals' }))
      listMatchSides.mockResolvedValue([makeSide({ teamId: 'team-1' })])

      renderPage('/manage/team-selection/matches/match-1/sides/away')

      expect(await screen.findByRole('button', { name: 'Select players' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Home XI' })).not.toBeInTheDocument()
      expect(createMatchSide).not.toHaveBeenCalled()
    })

    it('says so when none of the club\'s teams plays in the match', async () => {
      getMatch.mockResolvedValue(makeMatch({ homeTeamId: null, homeTeamName: 'A', awayTeamId: null, awayTeamName: 'B' }))

      renderPage(HOME)

      expect(await screen.findByText('No team to select')).toBeInTheDocument()
    })

    it('the Home XI | Away XI switch opens the other side, using its id once it exists', async () => {
      const user = userEvent.setup()
      getMatch.mockResolvedValue(makeMatch())
      listMatchSides.mockResolvedValue([makeSide({ teamId: 'team-1' }), makeSide({ id: 'side-2', teamId: 'team-2' })])

      renderPage(HOME)

      expect(await screen.findByRole('button', { name: 'Home XI' })).toHaveAttribute('aria-pressed', 'true')
      await user.click(screen.getByRole('button', { name: 'Away XI' }))
      expect(await screen.findByRole('button', { name: 'Select players' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Away XI' })).toHaveAttribute('aria-pressed', 'true')
    })
  })

  describe('the header (docs/specs/093)', () => {
    it('shows Back, the Season pill, the title, the date and the league, and one action group in order', async () => {
      getMatch.mockResolvedValue(makeMatch({ leagueId: 'league-1' }))
      listLeagues.mockResolvedValue([{ id: 'league-1', name: 'Premier League' }])
      listMatchSides.mockResolvedValue([makeSide({ teamId: 'team-1' })])

      renderPage(HOME)

      expect(await screen.findByRole('heading', { name: '1st XI v 2nd XI' })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Back to Team selection' })).toHaveAttribute('href', '/manage/team-selection/matches')
      expect(await screen.findByRole('button', { name: 'Season' })).toHaveTextContent('2026')
      await waitFor(() => expect(screen.getByTestId('select-subtitle')).toHaveTextContent('Premier League'))
      const actions = screen.getByTestId('select-actions')
      expect(within(actions).getAllByRole('button').map((button) => button.textContent)).toEqual([
        'Availability',
        'Announce team',
        'Share team',
        'Select players',
      ])
    })

    it('the key-figure strip shows Selected, Captain, Wicketkeeper and Status', async () => {
      getMatch.mockResolvedValue(makeMatch())
      listMatchSides.mockResolvedValue([
        makeSide({
          teamId: 'team-1',
          captainPlayerId: 'player-1',
          wicketKeeperPlayerId: 'player-2',
          players: [
            { playerProfileId: 'player-1', battingOrder: 1, role: 'BATSMAN' },
            { playerProfileId: 'player-2', battingOrder: 2, role: 'BOWLER' },
          ],
        }),
      ])
      getSelectionPool.mockResolvedValue(
        makePool([
          makeEntry('player-1', 'Jane', 'Smith', { selected: true }),
          makeEntry('player-2', 'Bob', 'Jones', { selected: true }),
        ]),
      )

      renderPage(HOME)

      expect(await screen.findByTestId('select-selected-value')).toHaveTextContent('2 of 12')
      await waitFor(() => expect(screen.getByTestId('select-captain-value')).toHaveTextContent('Jane Smith'))
      expect(screen.getByTestId('select-keeper-value')).toHaveTextContent('Bob Jones')
      expect(screen.getByTestId('select-status-value')).toHaveTextContent('In progress')
    })

    it('shows Not started for an empty side and Announced for an announced one', async () => {
      getMatch.mockResolvedValue(makeMatch())
      listMatchSides.mockResolvedValue([makeSide({ teamId: 'team-1' })])
      const { unmount } = renderPage(HOME)
      await waitFor(() => expect(screen.getByTestId('select-status-value')).toHaveTextContent('Not started'))
      unmount()

      listMatchSides.mockResolvedValue([makeSide({ teamId: 'team-1', announced: true })])
      renderPage(HOME)
      await waitFor(() => expect(screen.getByTestId('select-status-value')).toHaveTextContent('Announced'))
    })

    it('has no stray Deactivate control (it lives on Edit Match Details)', async () => {
      getMatch.mockResolvedValue(makeMatch())
      listMatchSides.mockResolvedValue([makeSide({ teamId: 'team-1' })])
      renderPage(HOME)
      await screen.findByRole('button', { name: 'Select players' })
      expect(screen.queryByRole('button', { name: /Deactivate|Reactivate/ })).not.toBeInTheDocument()
    })
  })

  describe('writes refresh the Team selection overview', () => {
    it('announcing invalidates the overview query of the club', async () => {
      getMatch.mockResolvedValue(makeMatch())
      listMatchSides.mockResolvedValue([
        makeSide({
          teamId: 'team-1',
          players: [
            { playerProfileId: 'player-1', battingOrder: 1, role: 'BATSMAN' },
            { playerProfileId: 'player-2', battingOrder: 2, role: 'BOWLER' },
          ],
        }),
      ])
      announceMatchSide.mockResolvedValue(makeSide({ announced: true }))
      const user = userEvent.setup()
      const { queryClient } = renderPage(HOME)
      const spy = vi.spyOn(queryClient, 'invalidateQueries')

      await user.click(await screen.findByRole('button', { name: 'Announce team' }))
      await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Announce team' }))

      await waitFor(() => expect(announceMatchSide).toHaveBeenCalled())
      await waitFor(() =>
        expect(spy).toHaveBeenCalledWith({ queryKey: ['managed-club', 'test-club-id', 'team-selection'] }),
      )
    })

    it('a captain change invalidates the overview query of the club', async () => {
      getMatch.mockResolvedValue(makeMatch())
      listMatchSides.mockResolvedValue([
        makeSide({ teamId: 'team-1', players: [{ playerProfileId: 'player-1', battingOrder: 1, role: 'BATSMAN' }] }),
      ])
      getSelectionPool.mockResolvedValue(makePool([makeEntry('player-1', 'Jane', 'Smith', { selected: true })]))
      updateMatchSide.mockResolvedValue(makeSide())
      const user = userEvent.setup()
      const { queryClient } = renderPage(HOME)
      const spy = vi.spyOn(queryClient, 'invalidateQueries')

      await user.click(await screen.findByRole('button', { name: 'Jane Smith, open menu' }))
      await user.click(await screen.findByRole('menuitem', { name: 'Make captain' }))

      await waitFor(() =>
        expect(spy).toHaveBeenCalledWith({ queryKey: ['managed-club', 'test-club-id', 'team-selection'] }),
      )
    })
  })


  // docs/specs/037-match-improvements.md item 5, re-expressed by 076 as the tap-a-name menu: PUT
  // .../sides/{sideId} is a full 3-field replace, so Make captain must send the side's own current
  // keeper and 12th man too.
  it('Make captain in the tap menu sends a merged 3-field payload, not partial', async () => {
    const user = userEvent.setup()
    getMatch.mockResolvedValue(makeMatch())
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

    renderPage(HOME)

    await screen.findByRole('heading', { name: '1st XI v 2nd XI' })

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

  it('"Add new player" in the Select players dialog creates a player, adds them to the season roster and searches the whole section for them', async () => {
    const user = userEvent.setup()
    getMatch.mockResolvedValue(makeMatch())
    listMatchSides.mockResolvedValue([makeSide({ teamId: 'team-1' })])
    createPlayer.mockResolvedValueOnce({ id: 'player-9', firstName: 'New', lastName: 'Player' })
    addToSquad.mockResolvedValueOnce(makeSquadMember({ playerProfileId: 'player-9' }))

    renderPage(HOME)

    await screen.findByRole('heading', { name: '1st XI v 2nd XI' })
    await user.click(await screen.findByRole('button', { name: 'Select players' }))

    await user.click(await screen.findByRole('button', { name: 'Add new player' }))
    await user.type(await screen.findByLabelText('First name'), 'New')
    await user.type(screen.getByLabelText('Last name'), 'Player')
    await user.type(screen.getByLabelText('Date of birth'), '2010-04-12')
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
      getMatch.mockResolvedValue(makeMatch())
      listMatchSides.mockResolvedValue([makeSide({ id: 'side-1', teamId: 'team-1', players: [] })])

      renderPage(HOME)

      await screen.findByRole('heading', { name: '1st XI v 2nd XI' })
      await screen.findByRole('button', { name: 'Select players' })
      expect(screen.queryByRole('button', { name: 'Re-select from previous match' })).not.toBeInTheDocument()
    })

    it('shows only the players of the chosen match, in its batting order, from the whole-section pool', async () => {
      const user = userEvent.setup()
      getMatch.mockResolvedValue(makeMatch())
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

      renderPage(HOME)

      await screen.findByRole('heading', { name: '1st XI v 2nd XI' })
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

  describe('Availability button', () => {
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

    it('opens the prefilled New poll flow with no poll', async () => {
      const user = userEvent.setup()
      getMatch.mockResolvedValue(makeMatch())

      renderPage(HOME)

      const button = await screen.findByRole('button', { name: 'Availability' })
      await waitFor(() => expect(button).toBeEnabled())
      expect(screen.getByTestId('select-actions')).toContainElement(button)
      await user.click(button)

      expect(
        await screen.findByText('At: /manage/availability/new?type=group&sectionId=section-1&matchId=match-1'),
      ).toBeInTheDocument()
    })

    it('goes to the squad Responses page with one squad poll', async () => {
      const user = userEvent.setup()
      getMatch.mockResolvedValue(makeMatch())
      listPolls.mockResolvedValue([poll('poll-1', 'team-1')])

      renderPage(HOME)

      const button = await screen.findByRole('button', { name: 'Availability' })
      await waitFor(() => expect(button).toBeEnabled())
      await user.click(button)

      expect(await screen.findByText('At: /manage/availability/squad/match-1/poll-1')).toBeInTheDocument()
    })

    it('goes to the group Responses page when a group poll covers the match', async () => {
      const user = userEvent.setup()
      getMatch.mockResolvedValue(makeMatch())
      getMatchSquad.mockResolvedValue(GROUP_COVERED)

      renderPage(HOME)

      const button = await screen.findByRole('button', { name: 'Availability' })
      await waitFor(() => expect(button).toBeEnabled())
      await user.click(button)

      expect(await screen.findByText('At: /manage/availability/group/round-1')).toBeInTheDocument()
    })

    it('opens a Home/Away menu when both sides have a squad poll, each option opening its Responses page', async () => {
      const user = userEvent.setup()
      getMatch.mockResolvedValue(makeMatch())
      listPolls.mockResolvedValue([poll('poll-1', 'team-1'), poll('poll-2', 'team-2')])

      renderPage(HOME)

      const button = await screen.findByRole('button', { name: 'Availability' })
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

    it('stays disabled when the polls query fails', async () => {
      getMatch.mockResolvedValue(makeMatch())
      listPolls.mockRejectedValue(new Error('boom'))

      renderPage(HOME)

      await screen.findByRole('heading', { name: '1st XI v 2nd XI' })
      await waitFor(() => expect(listPolls).toHaveBeenCalled())
      expect(screen.getByRole('button', { name: 'Availability' })).toBeDisabled()
    })
  })

  // docs/specs/076-team-selection.md section 2: the 033 tinting (poll responses fetched by the page)
  // is replaced by badges and one summary line, both read from the selection pool.
  describe('availability comes from the selection pool (076)', () => {
    const TWO_PLAYERS = [
      { playerProfileId: 'player-1', battingOrder: 1, role: 'BATSMAN' as const },
      { playerProfileId: 'player-2', battingOrder: 2, role: 'BOWLER' as const },
    ]

    it('shows an Unsure icon and one calm summary line for selected players who have not confirmed', async () => {
      getMatch.mockResolvedValue(makeMatch())
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

      renderPage(HOME)

      await screen.findByRole('heading', { name: '1st XI v 2nd XI' })

      expect(await screen.findByText("2 selected players are not confirmed available")).toBeInTheDocument()
      expect(screen.getByRole('img', { name: 'Jane Smith, Unsure' })).toBeInTheDocument()
      expect(screen.getByRole('img', { name: 'Bob Jones, No response' })).toBeInTheDocument()
    })

    it('with no covering poll shows one marker line instead of a badge on every row', async () => {
      getMatch.mockResolvedValue(makeMatch())
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

      renderPage(HOME)

      await screen.findByRole('heading', { name: '1st XI v 2nd XI' })

      expect(
        await screen.findByText("No availability poll covers this match, so nobody's availability is confirmed."),
      ).toBeInTheDocument()
      expect(screen.queryByRole('img', { name: /Not polled/ })).not.toBeInTheDocument()
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
      renderPage(HOME)
      await screen.findByRole('heading', { name: '1st XI v 2nd XI' })
      await screen.findByRole('button', { name: 'Select players' })
      return user
    }

    const rowOrder = () => screen.getAllByTestId(/^selection-row-/).map((row) => row.getAttribute('data-testid'))

    it('shows the selected count in the strip and Select players and Announce team in the action group', async () => {
      await openHomeXi()
      expect(screen.getByTestId('select-selected-value')).toHaveTextContent('2 of 12')
      expect(within(screen.getByTestId('select-actions')).getAllByRole('button').map((button) => button.textContent)).toEqual([
        'Availability',
        'Announce team',
        'Share team',
        'Select players',
      ])
    })

    describe('Share team', () => {
      it('is disabled, with a tooltip, until the side is announced', async () => {
        const user = await openHomeXi()
        const share = screen.getByRole('button', { name: 'Share team' })
        expect(share).toBeDisabled()
        await user.hover(share.parentElement as HTMLElement)
        expect(await screen.findByRole('tooltip')).toHaveTextContent('Announce the team to share it')
      })

      it('opens the team sheet dialog for this match, scoped to the side being viewed', async () => {
        const user = await openHomeXi({ announced: true })
        const share = screen.getByRole('button', { name: 'Share team' })
        expect(share).toBeEnabled()
        await user.click(share)
        const dialog = await screen.findByTestId('share-dialog')
        expect(dialog).toHaveAttribute('data-match-id', 'match-1')
        expect(dialog).toHaveAttribute('data-scope', 'home')
      })
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
        expect(dialog.querySelector('img')).not.toBeNull()
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
        expect(screen.getAllByRole('img', { name: /Said unavailable/ })).toHaveLength(2)
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
})
