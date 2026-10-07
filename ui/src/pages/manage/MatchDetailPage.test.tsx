import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MatchDetailPage from './MatchDetailPage'
import type { Match } from '../../api/matchApi'
import type { MatchSide } from '../../api/matchSideApi'
import type { SquadMember } from '../../api/teamSquadApi'
import type { MatchAvailabilityPoll } from '../../api/matchAvailabilityApi'

const getMatch = vi.fn()
const listTeamsForClub = vi.fn()
const listSeasons = vi.fn()
const listLeagues = vi.fn()
const listSquad = vi.fn()
const listMatchSides = vi.fn()
const listPolls = vi.fn()
const getMatchSquad = vi.fn()
const generateTeamSheetPdf = vi.fn()

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
}))

vi.mock('../../api/matchSquadApi', () => ({
  getMatchSquad: (clubId: string, matchId: string, teamId: string) => getMatchSquad(clubId, matchId, teamId),
}))

vi.mock('../../utils/teamSheetPdf', () => ({
  generateTeamSheetPdf: (...args: unknown[]) => generateTeamSheetPdf(...args),
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
    homeLeagueTeamId: null,
    awayLeagueTeamId: null,
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
    isCaptain: false,
    ...overrides,
  }
}

function makePoll(overrides: Partial<MatchAvailabilityPoll> = {}): MatchAvailabilityPoll {
  return {
    id: 'poll-1',
    teamId: 'team-1',
    open: true,
    autoClose: true,
    scheduledCloseAt: null,
    canReopen: true,
    availableCount: 0,
    unavailableCount: 0,
    unsureCount: 0,
    noResponseCount: 0,
    ...overrides,
  }
}

function makeTeam(id: string, name: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    clubId: 'test-club-id',
    sectionId: 'section-1',
    name,
    logoUrl: null,
    abbreviation: null,
    active: true,
    createdAt: '',
    updatedAt: '',
    updatedBy: null,
    ...overrides,
  }
}

const UNCOVERED = { sectionId: 'section-1', windowDate: null, dayPart: null, windowId: null, windowOpen: false, roundId: null, candidates: [], selected: [] }
const COVERED = { ...UNCOVERED, windowDate: '2026-06-01', dayPart: 'AFTERNOON', windowId: 'window-1', windowOpen: true, roundId: 'round-1' }
const LEAGUE = { id: 'league-1', name: 'Premier League', maxPlayingXiSize: 11 }

beforeEach(() => {
  vi.clearAllMocks()
  listTeamsForClub.mockResolvedValue([makeTeam('team-1', '1st XI'), makeTeam('team-2', '2nd XI')])
  listSeasons.mockResolvedValue([])
  listLeagues.mockResolvedValue([])
  listSquad.mockResolvedValue([])
  listMatchSides.mockResolvedValue([])
  listPolls.mockResolvedValue([])
  getMatchSquad.mockResolvedValue(UNCOVERED)
  generateTeamSheetPdf.mockResolvedValue('blob:team-sheet')
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
            <Route path="matches/:matchId" element={<MatchDetailPage />} />
          </Route>
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const PATH = '/manage/fixtures/matches/match-1'

async function renderLoaded(match = makeMatch()) {
  getMatch.mockResolvedValueOnce(match)
  renderPage(PATH, 'test-club-id')
  return screen.findByRole('heading', { level: 1 })
}

// The Availability button waits for the polls and coverage queries to settle.
async function availabilityButton() {
  const button = await screen.findByRole('button', { name: 'Availability' })
  await waitFor(() => expect(button).toBeEnabled())
  return button
}

describe('MatchDetailPage', () => {
  it('renders "Not authorized" and does not fetch when no clubId is in the Outlet context', () => {
    renderPage(PATH, undefined)

    expect(screen.getByText('Not authorized')).toBeInTheDocument()
    expect(getMatch).not.toHaveBeenCalled()
  })

  it('renders an error state when the match fails to load', async () => {
    getMatch.mockRejectedValueOnce(new Error('not found'))

    renderPage(PATH, 'test-club-id')

    expect(await screen.findByText("Couldn't load this match")).toBeInTheDocument()
  })

  describe('header rows', () => {
    it('lays out Back, badges, title row, divider, details and actions in DOM order', async () => {
      await renderLoaded()

      const back = screen.getByRole('link', { name: /back to matches/i })
      const topRow = screen.getByTestId('match-header-top-row')
      const titleRow = screen.getByTestId('match-header-title-row')
      const details = screen.getByTestId('match-header-details')
      const actions = screen.getByTestId('match-header-actions')
      const divider = titleRow.nextElementSibling as HTMLElement

      expect(back).toHaveAttribute('href', '/manage/fixtures/matches')
      expect(topRow).toContainElement(back)
      expect(topRow).toContainElement(screen.getByLabelText('Match badges'))
      expect(divider.tagName).toBe('HR')
      const follows = (a: Element, b: Element) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)
      expect(follows(topRow, titleRow)).toBe(true)
      expect(follows(titleRow, divider)).toBe(true)
      expect(follows(divider, details)).toBe(true)
      expect(follows(details, actions)).toBe(true)
    })

    it('puts Edit on the title row, linking to the edit route, in a no-wrap row', async () => {
      await renderLoaded()

      const titleRow = screen.getByTestId('match-header-title-row')
      const edit = screen.getByRole('link', { name: /^edit$/i })
      expect(edit).toHaveAttribute('href', '/manage/fixtures/matches/match-1/edit')
      expect(titleRow).toContainElement(edit)
      expect(titleRow).toHaveStyle({ flexWrap: 'nowrap', justifyContent: 'space-between' })
      expect(edit).toHaveStyle({ flex: 'none' })
    })

    it('keeps the heading accessible name as the plain "Home vs Away"', async () => {
      await renderLoaded()
      expect(screen.getByRole('heading', { level: 1, name: '1st XI vs 2nd XI' })).toBeInTheDocument()
    })
  })

  describe('badges', () => {
    it('shows an unprefixed Announced / Not announced badge per own team from the sides query, not getMatch', async () => {
      getMatch.mockResolvedValueOnce(makeMatch({ awayTeamId: null, awayTeamName: 'Riverside', homeSideAnnounced: false }))
      listMatchSides.mockResolvedValue([makeSide({ teamId: 'team-1', announced: true })])

      renderPage(PATH, 'test-club-id')

      const badges = await screen.findByLabelText('Match badges')
      expect(await within(badges).findByText('Announced')).toBeInTheDocument()
      expect(within(badges).queryByText('Not announced')).not.toBeInTheDocument()
    })

    it('prefixes each own team with its name when both sides are own', async () => {
      getMatch.mockResolvedValueOnce(makeMatch())
      listMatchSides.mockResolvedValue([makeSide({ teamId: 'team-2', announced: true })])

      renderPage(PATH, 'test-club-id')

      const badges = await screen.findByLabelText('Match badges')
      expect(await within(badges).findByText('2nd XI: Announced')).toBeInTheDocument()
      expect(within(badges).getByText('1st XI: Not announced')).toBeInTheDocument()
    })

    it('shows an Inactive badge for an inactive match', async () => {
      await renderLoaded(makeMatch({ active: false }))
      expect(await screen.findByText('Inactive')).toBeInTheDocument()
    })

    it('shows No poll once settled with no poll, and no poll badge while still loading', async () => {
      let resolvePolls: (value: unknown[]) => void = () => {}
      listPolls.mockReturnValue(new Promise((resolve) => { resolvePolls = resolve }))
      await renderLoaded()

      expect(screen.queryByText(/^(No poll|Poll open|Poll closed)$/)).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Availability' })).toBeDisabled()

      resolvePolls([])
      expect(await screen.findByText('No poll')).toBeInTheDocument()
    })

    it('shows Poll open for an open squad poll', async () => {
      listPolls.mockResolvedValue([makePoll({ open: true })])
      await renderLoaded()
      expect(await screen.findByText('Poll open')).toBeInTheDocument()
    })

    it('shows Poll closed for a closed squad poll', async () => {
      listPolls.mockResolvedValue([makePoll({ open: false })])
      await renderLoaded()
      expect(await screen.findByText('Poll closed')).toBeInTheDocument()
    })

    it('counts a group poll once when it covers both own sides', async () => {
      getMatchSquad.mockResolvedValue(COVERED)
      await renderLoaded()

      expect(await screen.findByText('Poll open')).toBeInTheDocument()
      const button = await availabilityButton()
      const user = userEvent.setup()
      await user.click(button)
      // one poll: navigates straight, no menu
      expect(await screen.findByText('At: /manage/availability/group/round-1')).toBeInTheDocument()
    })

    it('shows Poll open for a derby with two polls where either is open', async () => {
      listPolls.mockResolvedValue([makePoll({ id: 'p1', teamId: 'team-1', open: false }), makePoll({ id: 'p2', teamId: 'team-2', open: true })])
      await renderLoaded()
      expect(await screen.findByText('Poll open')).toBeInTheDocument()
    })
  })

  describe('loading and failed queries', () => {
    it('shows no picked text, bar or empty-state while the sides query is loading', async () => {
      let resolveSides: (value: unknown[]) => void = () => {}
      listMatchSides.mockReturnValue(new Promise((resolve) => { resolveSides = resolve }))
      listLeagues.mockResolvedValue([LEAGUE])
      getMatch.mockResolvedValueOnce(makeMatch({ awayTeamId: null, awayTeamName: 'Riverside', leagueId: 'league-1' }))
      renderPage(PATH, 'test-club-id')

      await screen.findByTestId('match-team-card-home')
      expect(screen.queryByText('No players selected yet.')).not.toBeInTheDocument()
      expect(screen.queryByText(/picked/)).not.toBeInTheDocument()
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()

      // 076: M is the side's own limits.maxSelected, so it appears once the side exists.
      resolveSides([makeSide({ teamId: 'team-1', limits: { battingPlaces: 11, twelfthManAllowed: false, maxSelected: 11 } })])
      expect(await screen.findByText('No players selected yet.')).toBeInTheDocument()
      expect(screen.getByText('0 of 11 picked')).toBeInTheDocument()
    })

    it('treats a failed polls query as not ready: no poll badge, Availability disabled', async () => {
      listPolls.mockRejectedValue(new Error('boom'))
      await renderLoaded()

      await waitFor(() => expect(listPolls).toHaveBeenCalled())
      expect(screen.getByRole('button', { name: 'Availability' })).toBeDisabled()
      expect(screen.queryByText(/^(No poll|Poll open|Poll closed)$/)).not.toBeInTheDocument()
    })

    it('treats a failed match-squad coverage query as not ready', async () => {
      getMatchSquad.mockRejectedValue(new Error('boom'))
      await renderLoaded()

      await waitFor(() => expect(getMatchSquad).toHaveBeenCalled())
      expect(screen.getByRole('button', { name: 'Availability' })).toBeDisabled()
      expect(screen.queryByText('No poll')).not.toBeInTheDocument()
    })
  })

  describe('logos', () => {
    it('shows a real team logo from teamsById and initials from the abbreviation or name', async () => {
      listTeamsForClub.mockResolvedValue([
        makeTeam('team-1', 'Villagers One', { logoUrl: 'https://img.example/v1.png' }),
        makeTeam('team-2', 'CBC One', { abbreviation: 'CBC' }),
      ])
      await renderLoaded()

      const home = await screen.findByTestId('match-logo-home')
      expect(home.querySelector('img')).toHaveAttribute('src', 'https://img.example/v1.png')
      expect(screen.getByTestId('match-logo-away')).toHaveTextContent('CBC')
      expect(screen.queryByTestId('match-header-avatar')).not.toBeInTheDocument()
    })

    it('shows a free-text opponent logo from the side logo url, and name initials for the other side', async () => {
      getMatch.mockResolvedValueOnce(
        makeMatch({ awayTeamId: null, awayTeamName: 'Riverside Occasionals', awayTeamLogoUrl: 'https://img.example/r.png' }),
      )
      renderPage(PATH, 'test-club-id')

      const away = await screen.findByTestId('match-logo-away')
      expect(away.querySelector('img')).toHaveAttribute('src', 'https://img.example/r.png')
      // team-1 has no logo/abbreviation yet the other side does: both sides keep a box, with initials.
      expect(screen.getByTestId('match-logo-home')).toHaveTextContent('1X')
    })

    it('draws the cricket avatar and no logo boxes when neither side has a logo', async () => {
      await renderLoaded()

      expect(await screen.findByTestId('match-header-avatar')).toBeInTheDocument()
      expect(screen.queryByTestId('match-logo-home')).not.toBeInTheDocument()
      expect(screen.queryByTestId('match-logo-away')).not.toBeInTheDocument()
    })
  })

  describe('details and links', () => {
    it('shows When always, and Venue and League/Season only when present', async () => {
      listLeagues.mockResolvedValue([LEAGUE])
      listSeasons.mockResolvedValue([{ id: 'season-1', label: '2026/27' }])
      await renderLoaded(makeMatch({ leagueId: 'league-1' }))

      expect(await screen.findByText('Premier League · 2026/27')).toBeInTheDocument()
      expect(screen.getByText('Riverside Oval')).toBeInTheDocument()
      expect(screen.getByRole('group', { name: 'When' })).toBeInTheDocument()
      expect(screen.getByRole('group', { name: 'Venue' })).toBeInTheDocument()
      expect(screen.getByRole('group', { name: 'League' })).toBeInTheDocument()
    })

    it('omits Venue and League when empty', async () => {
      await renderLoaded(makeMatch({ venue: null }))

      expect(screen.getByRole('group', { name: 'When' })).toBeInTheDocument()
      expect(screen.queryByRole('group', { name: 'Venue' })).not.toBeInTheDocument()
      expect(screen.queryByRole('group', { name: 'League' })).not.toBeInTheDocument()
    })

    it('shows Scoring and Watch live only when set, in a new tab with noopener', async () => {
      await renderLoaded(makeMatch({ scoringUrl: 'https://cricclubs.com/m/1', streamingUrl: 'https://pv.example/live' }))

      const scoring = screen.getByRole('link', { name: 'Scoring link' })
      const live = screen.getByRole('link', { name: 'Watch live link' })
      expect(scoring).toHaveAttribute('href', 'https://cricclubs.com/m/1')
      expect(live).toHaveAttribute('href', 'https://pv.example/live')
      for (const link of [scoring, live]) {
        expect(link).toHaveAttribute('target', '_blank')
        expect(link.getAttribute('rel')).toContain('noopener')
      }
    })

    it('renders no link when neither is set, and only the set one otherwise', async () => {
      await renderLoaded()
      expect(screen.queryByRole('link', { name: 'Scoring link' })).not.toBeInTheDocument()
      expect(screen.queryByRole('link', { name: 'Watch live link' })).not.toBeInTheDocument()
    })

    it('renders only Watch live when only the stream is set', async () => {
      await renderLoaded(makeMatch({ streamingUrl: 'https://pv.example/live' }))
      expect(screen.getByRole('link', { name: 'Watch live link' })).toBeInTheDocument()
      expect(screen.queryByRole('link', { name: 'Scoring link' })).not.toBeInTheDocument()
    })
  })

  describe('actions', () => {
    it('Select team links to the Playing XI tab', async () => {
      await renderLoaded()
      expect(within(screen.getByTestId('match-header-actions')).getByRole('link', { name: 'Select team' })).toHaveAttribute(
        'href',
        '/manage/fixtures/matches/match-1/edit?tab=playing-xi',
      )
    })

    it('Availability opens the prefilled New poll flow with no poll', async () => {
      const user = userEvent.setup()
      await renderLoaded()

      await user.click(await availabilityButton())

      expect(
        await screen.findByText('At: /manage/availability/new?type=group&sectionId=section-1&matchId=match-1'),
      ).toBeInTheDocument()
    })

    it('Availability opens the squad Responses page for one squad poll', async () => {
      const user = userEvent.setup()
      listPolls.mockResolvedValue([makePoll({ id: 'poll-7' })])
      await renderLoaded()

      await user.click(await availabilityButton())

      expect(await screen.findByText('At: /manage/availability/squad/match-1/poll-7')).toBeInTheDocument()
    })

    it('Availability opens a menu for two polls, each option opening its Responses page', async () => {
      const user = userEvent.setup()
      listPolls.mockResolvedValue([makePoll({ id: 'p1', teamId: 'team-1' }), makePoll({ id: 'p2', teamId: 'team-2' })])
      await renderLoaded()

      await user.click(await availabilityButton())

      const menu = await screen.findByRole('menu', { name: 'Availability polls' })
      expect(within(menu).getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
        '1st XI · Home poll',
        '2nd XI · Away poll',
      ])
      await user.click(within(menu).getByRole('menuitem', { name: '2nd XI · Away poll' }))
      expect(await screen.findByText('At: /manage/availability/squad/match-1/p2')).toBeInTheDocument()
    })

    it('Share team sheet opens the dialog and prints through the shared hook', async () => {
      const user = userEvent.setup()
      const open = vi.spyOn(window, 'open').mockReturnValue(null)
      listMatchSides.mockResolvedValue([
        makeSide({ teamId: 'team-1', players: [{ playerProfileId: 'player-1', battingOrder: 1, role: 'BATSMAN' }] }),
      ])
      await renderLoaded()

      await user.click(screen.getByRole('button', { name: 'Share team sheet' }))

      expect(await screen.findByText('Communicate Team Sheet')).toBeInTheDocument()
      await user.click(await screen.findByRole('button', { name: 'Print Both Teams' }))
      await waitFor(() => expect(generateTeamSheetPdf).toHaveBeenCalled())
      await waitFor(() => expect(open).toHaveBeenCalledWith('blob:team-sheet', '_blank'))
      open.mockRestore()
    })

    it('disables all three actions with the reason when neither side is a club team', async () => {
      getMatch.mockResolvedValueOnce(
        makeMatch({ homeTeamId: null, homeTeamName: 'A', awayTeamId: null, awayTeamName: 'B' }),
      )
      renderPage(PATH, 'test-club-id')
      await screen.findByRole('heading', { level: 1 })

      for (const name of ['Select team', 'Availability', 'Share team sheet']) {
        const button = screen.getByRole('button', { name })
        expect(button).toBeDisabled()
        expect(button.closest('span[title]')).toHaveAttribute('title', 'None of your teams is playing in this match')
      }
    })

    it('enables the actions when one club team is playing', async () => {
      getMatch.mockResolvedValueOnce(makeMatch({ awayTeamId: null, awayTeamName: 'Riverside' }))
      renderPage(PATH, 'test-club-id')
      await screen.findByRole('heading', { level: 1 })

      expect(within(screen.getByTestId('match-header-actions')).getByRole('link', { name: 'Select team' })).toBeInTheDocument()
      expect(await availabilityButton()).toBeEnabled()
      expect(screen.getByRole('button', { name: 'Share team sheet' })).toBeEnabled()
    })
  })

  describe('removed sections', () => {
    it('has no Details card and no Availability section', async () => {
      await renderLoaded()
      await availabilityButton()

      expect(screen.queryByRole('heading', { name: 'Availability' })).not.toBeInTheDocument()
      expect(screen.queryByText(/No availability poll open for/)).not.toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: 'Details' })).not.toBeInTheDocument()
      expect(screen.queryByText('Home XI')).not.toBeInTheDocument()
      expect(screen.queryByText('Away XI')).not.toBeInTheDocument()
    })
  })

  describe('body: one card per own team', () => {
    it('renders exactly one card and no opponent card for a free-text opponent', async () => {
      getMatch.mockResolvedValueOnce(makeMatch({ awayTeamId: null, awayTeamName: 'Riverside Occasionals' }))
      renderPage(PATH, 'test-club-id')

      expect(await screen.findByTestId('match-team-card-home')).toBeInTheDocument()
      expect(screen.queryByTestId('match-team-card-away')).not.toBeInTheDocument()
      expect(screen.getAllByTestId(/^match-team-card-/)).toHaveLength(1)
      expect(screen.getByText('1st XI · Home')).toBeInTheDocument()
    })

    it('renders no opponent card for a league-team or other-team opponent either', async () => {
      getMatch.mockResolvedValueOnce(
        makeMatch({ awayTeamId: null, awayTeamName: 'League Team', awayLeagueTeamId: 'lt-1' }),
      )
      renderPage(PATH, 'test-club-id')
      await screen.findByTestId('match-team-card-home')
      expect(screen.getAllByTestId(/^match-team-card-/)).toHaveLength(1)
    })

    it('renders two cards, home first, for a derby', async () => {
      await renderLoaded()

      const cards = await screen.findAllByTestId(/^match-team-card-/)
      expect(cards.map((card) => card.getAttribute('data-testid'))).toEqual([
        'match-team-card-home',
        'match-team-card-away',
      ])
      expect(screen.getByText('1st XI · Home')).toBeInTheDocument()
      expect(screen.getByText('2nd XI · Away')).toBeInTheDocument()
    })

    it('renders no cards and a note when neither side is a club team', async () => {
      getMatch.mockResolvedValueOnce(
        makeMatch({ homeTeamId: null, homeTeamName: 'A', awayTeamId: null, awayTeamName: 'B' }),
      )
      renderPage(PATH, 'test-club-id')

      expect(
        await screen.findByText('None of your teams is playing in this match, so there is no team to select.'),
      ).toBeInTheDocument()
      expect(screen.queryByTestId(/^match-team-card-/)).not.toBeInTheDocument()
    })

    it('shows N of M picked with the progress bar and legend, using the league XI size', async () => {
      listLeagues.mockResolvedValue([{ ...LEAGUE, maxPlayingXiSize: 11 }])
      getMatch.mockResolvedValueOnce(makeMatch({ awayTeamId: null, awayTeamName: 'Riverside', leagueId: 'league-1' }))
      listMatchSides.mockResolvedValue([
        makeSide({
          teamId: 'team-1',
          limits: { battingPlaces: 11, twelfthManAllowed: false, maxSelected: 11 },
          players: [
            { playerProfileId: 'player-1', battingOrder: 1, role: 'BATSMAN' },
            { playerProfileId: 'player-2', battingOrder: 2, role: 'BOWLER' },
          ],
        }),
      ])
      listSquad.mockResolvedValue([makeSquadMember({ playerProfileId: 'player-1' })])
      renderPage(PATH, 'test-club-id')

      expect(await screen.findByText('2 of 11 picked')).toBeInTheDocument()
      expect(screen.getByRole('progressbar', { name: '1st XI selection' })).toHaveAttribute('aria-valuenow', '2')
      expect(screen.getByText('2 picked · 9 to go')).toBeInTheDocument()
      expect(await screen.findByText('Jane Smith')).toBeInTheDocument()
    })

    it('takes M from the side\'s limits (a 12th man makes 12), not from the league\'s XI size', async () => {
      listLeagues.mockResolvedValue([{ ...LEAGUE, maxPlayingXiSize: 11 }])
      getMatch.mockResolvedValueOnce(makeMatch({ awayTeamId: null, awayTeamName: 'Riverside', leagueId: 'league-1' }))
      listMatchSides.mockResolvedValue([
        makeSide({
          teamId: 'team-1',
          limits: { battingPlaces: 11, twelfthManAllowed: true, maxSelected: 12 },
          players: [
            { playerProfileId: 'player-1', battingOrder: 1, role: 'BATSMAN' },
            { playerProfileId: 'player-2', battingOrder: 2, role: 'BOWLER' },
          ],
        }),
      ])
      renderPage(PATH, 'test-club-id')

      expect(await screen.findByText('2 of 12 picked')).toBeInTheDocument()
      expect(screen.getByRole('progressbar', { name: '1st XI selection' })).toHaveAttribute('aria-valuemax', '12')
    })

    it('says squad complete at M of M', async () => {
      listLeagues.mockResolvedValue([{ ...LEAGUE, maxPlayingXiSize: 2 }])
      getMatch.mockResolvedValueOnce(makeMatch({ awayTeamId: null, awayTeamName: 'Riverside', leagueId: 'league-1' }))
      listMatchSides.mockResolvedValue([
        makeSide({
          teamId: 'team-1',
          limits: { battingPlaces: 2, twelfthManAllowed: false, maxSelected: 2 },
          players: [
            { playerProfileId: 'player-1', battingOrder: 1, role: 'BATSMAN' },
            { playerProfileId: 'player-2', battingOrder: 2, role: 'BOWLER' },
          ],
        }),
      ])
      renderPage(PATH, 'test-club-id')

      expect(await screen.findByText('squad complete')).toBeInTheDocument()
    })

    it('shows "N picked" and no bar when the match has no league', async () => {
      getMatch.mockResolvedValueOnce(makeMatch({ awayTeamId: null, awayTeamName: 'Riverside' }))
      listMatchSides.mockResolvedValue([
        makeSide({ teamId: 'team-1', players: [{ playerProfileId: 'player-1', battingOrder: 1, role: 'BATSMAN' }] }),
      ])
      renderPage(PATH, 'test-club-id')

      expect(await screen.findByText('1 picked')).toBeInTheDocument()
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    })

    it('shows "No players selected yet." with a Select team link when nothing is picked', async () => {
      getMatch.mockResolvedValueOnce(makeMatch({ awayTeamId: null, awayTeamName: 'Riverside' }))
      renderPage(PATH, 'test-club-id')

      const card = await screen.findByTestId('match-team-card-home')
      expect(await within(card).findByText('No players selected yet.')).toBeInTheDocument()
      expect(within(card).getByRole('link', { name: 'Select team' })).toHaveAttribute(
        'href',
        '/manage/fixtures/matches/match-1/edit?tab=playing-xi',
      )
    })

    it('renders the read-only XI summary without any editing control when players exist', async () => {
      getMatch.mockResolvedValueOnce(makeMatch({ awayTeamId: null, awayTeamName: 'Riverside' }))
      listMatchSides.mockResolvedValue([
        makeSide({ teamId: 'team-1', players: [{ playerProfileId: 'player-1', battingOrder: 1, role: 'BATSMAN' }] }),
      ])
      listSquad.mockResolvedValue([makeSquadMember({ playerProfileId: 'player-1' })])
      renderPage(PATH, 'test-club-id')

      expect(await screen.findByText('Jane Smith')).toBeInTheDocument()
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
      expect(screen.queryByText('No players selected yet.')).not.toBeInTheDocument()
    })
  })

  describe('Pick match squad (retired by 076)', () => {
    it('has no Pick match squad button, even for a group-covered own side', async () => {
      getMatchSquad.mockResolvedValue(COVERED)
      await renderLoaded()

      await screen.findByTestId('match-team-card-home')
      await waitFor(() => expect(getMatchSquad).toHaveBeenCalled())
      expect(screen.queryByRole('link', { name: 'Pick match squad' })).not.toBeInTheDocument()
    })
  })
})
