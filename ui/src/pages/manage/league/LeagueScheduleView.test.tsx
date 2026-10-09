import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  emptyPage,
  makeAffiliation,
  makeLeague,
  makeLeagueTeam,
  makeMatch,
  makeSeason,
  makeTeam,
  renderLeagueView,
} from './leagueViewTestUtils'

// The API modules are mocked at module level; matchApi stays real so listAllMatches' paging is
// genuinely exercised, with only the HTTP layer stubbed (page requests go to mocks.listMatches).
const mocks = vi.hoisted(() => ({
  listLeagues: vi.fn(),
  listSeasons: vi.fn(),
  listTeamsForClub: vi.fn(),
  listLeagueAffiliations: vi.fn(),
  listLeagueContacts: vi.fn(),
  listLeagueTeams: vi.fn(),
  getPlayingConditions: vi.fn(),
  listMatches: vi.fn(),
}))

vi.mock('../../../api/leagueApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../api/leagueApi')>()),
  listLeagues: (clubId: string, params?: unknown) => mocks.listLeagues(clubId, params),
}))
vi.mock('../../../api/seasonApi', () => ({ listSeasons: (clubId: string) => mocks.listSeasons(clubId) }))
vi.mock('../../../api/teamApi', () => ({ listTeamsForClub: (clubId: string) => mocks.listTeamsForClub(clubId) }))
vi.mock('../../../api/leagueAffiliationApi', () => ({
  listLeagueAffiliations: (clubId: string, leagueId: string) => mocks.listLeagueAffiliations(clubId, leagueId),
}))
vi.mock('../../../api/leagueContactApi', () => ({
  listLeagueContacts: (clubId: string, leagueId: string) => mocks.listLeagueContacts(clubId, leagueId),
}))
vi.mock('../../../api/leagueTeamApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../api/leagueTeamApi')>()),
  listLeagueTeams: (...args: unknown[]) => mocks.listLeagueTeams(...args),
}))
vi.mock('../../../api/leaguePlayingConditionsApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../api/leaguePlayingConditionsApi')>()),
  getPlayingConditions: (clubId: string, leagueId: string, seasonId: string) =>
    mocks.getPlayingConditions(clubId, leagueId, seasonId),
}))
vi.mock('../../../api/axiosConfig', () => ({
  default: {
    get: async (url: string, config: { params: unknown }) => ({
      data: await mocks.listMatches(url.split('/')[3], config.params),
    }),
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
  mocks.listSeasons.mockResolvedValue([])
  mocks.listTeamsForClub.mockResolvedValue([])
  mocks.listLeagueAffiliations.mockResolvedValue([])
  mocks.listLeagueContacts.mockResolvedValue([])
  mocks.listLeagueTeams.mockResolvedValue([])
  mocks.getPlayingConditions.mockResolvedValue(null)
  mocks.listMatches.mockResolvedValue(emptyPage())
})

const SCHEDULE_PATH = '/manage/fixtures/leagues/league-1/schedule'

describe('LeagueScheduleView', () => {
  beforeEach(() => {
    mocks.listLeagues.mockResolvedValue([makeLeague()])
    mocks.listSeasons.mockResolvedValue([makeSeason()])
    mocks.listTeamsForClub.mockResolvedValue([makeTeam({ id: 'team-1', name: '1st XI' })])
  })

  const future = (day: number) => `2099-06-${String(day).padStart(2, '0')}T14:30:00Z`

  it("renders the season's matches in the fixtures table for the selected season", async () => {
    mocks.listMatches.mockResolvedValue({
      ...emptyPage(),
      content: [makeMatch({ matchDate: future(1), homeTeamId: 'team-1', awayTeamName: 'Riverside Occasionals' })],
      totalPages: 1,
    })

    renderLeagueView(SCHEDULE_PATH)

    const table = await screen.findByRole('table', { name: 'Fixtures' })
    expect(within(table).getByText('1st XI vs Riverside Occasionals')).toBeInTheDocument()
    expect(within(table).getByTestId('fixture-row-venue')).toHaveTextContent('Riverside Oval')
    expect(screen.getByText(/^Showing 1 upcoming match · 2026$/)).toBeInTheDocument()
    expect(mocks.listMatches).toHaveBeenCalledWith(
      'test-club-id',
      expect.objectContaining({ leagueId: 'league-1', seasonId: 'season-1', sort: 'matchDate,asc', size: 200 }),
    )
  })

  it('opens our matches from the row and shows an "Our match" chip, while a league-only match is a plain row', async () => {
    mocks.listMatches.mockResolvedValue({
      ...emptyPage(),
      content: [
        makeMatch({ id: 'ours', matchDate: future(1), homeTeamId: 'team-1', awayTeamName: 'Riverside Occasionals' }),
        makeMatch({ id: 'theirs', matchDate: future(2), homeTeamId: null, homeTeamName: 'Hawks', awayTeamName: 'Eagles' }),
      ],
      totalPages: 1,
    })

    renderLeagueView(SCHEDULE_PATH)

    const [ours, theirs] = await screen.findAllByTestId('fixture-row')
    expect(ours).toHaveAttribute('data-ours', 'true')
    expect(within(ours).getByTestId('fixture-row-ours')).toHaveTextContent('Our match')
    expect(within(ours).getByRole('link', { name: '1st XI vs Riverside Occasionals' })).toHaveAttribute('href', '/manage/fixtures/matches/ours')
    expect(theirs).toHaveAttribute('data-ours', 'false')
    expect(within(theirs).queryByRole('link')).not.toBeInTheDocument()
    expect(within(theirs).getByTestId('fixture-row-ours')).toBeEmptyDOMElement()
  })

  it('renders the empty state when the season has no matches', async () => {
    renderLeagueView(SCHEDULE_PATH)

    expect(await screen.findByText('No fixtures yet')).toBeInTheDocument()
  })

  it('shows no empty state while matches are loading', async () => {
    mocks.listMatches.mockReturnValue(new Promise(() => undefined))

    renderLeagueView(SCHEDULE_PATH)

    expect(await screen.findByLabelText('Loading fixtures')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Share schedule' })).toBeDisabled()
    expect(screen.queryByText('No fixtures yet')).not.toBeInTheDocument()
  })

  it('renders the no-seasons copy when the club has no seasons', async () => {
    mocks.listSeasons.mockResolvedValue([])

    renderLeagueView(SCHEDULE_PATH)

    expect(
      await screen.findByText('No seasons yet — matches are scheduled for a league and a specific season.'),
    ).toBeInTheDocument()
    expect(mocks.listMatches).not.toHaveBeenCalled()
  })

  // The truncation regression (docs/specs/072-league-view-pages.md): 45 matches over three pages. The old single-page call
  // showed the first 20.
  it('shows every match of a 45-match season across three pages', async () => {
    mocks.listMatches.mockImplementation(async (_clubId: string, params: { page: number }) => ({
      content: Array.from({ length: 15 }, (_, index) => {
        const n = params.page * 15 + index
        return makeMatch({ id: `match-${n}`, homeTeamId: 'team-1', awayTeamName: `Opponent ${n}`, matchDate: `2099-0${(index % 9) + 1}-${10 + params.page}T10:00:00Z` })
      }),
      totalElements: 45,
      totalPages: 3,
      number: params.page,
      size: 15,
    }))

    renderLeagueView(SCHEDULE_PATH)

    expect(await screen.findByText(/^Showing 45 upcoming matches/)).toBeInTheDocument()
    expect(mocks.listMatches).toHaveBeenCalledTimes(3)
    expect(mocks.listMatches.mock.calls.map(([, params]) => (params as { page: number }).page)).toEqual([0, 1, 2])
    expect(screen.getAllByTestId('fixture-row')).toHaveLength(45)
  })

  describe('filters (091)', () => {
    beforeEach(() => {
      mocks.listLeagueAffiliations.mockResolvedValue([makeAffiliation({ teamId: 'team-1' })])
      mocks.listLeagueTeams.mockResolvedValue([makeLeagueTeam({ id: 'lt-hawks', name: 'Hawks' })])
      mocks.listMatches.mockResolvedValue({
        ...emptyPage(),
        content: [
          makeMatch({ id: 'played', matchDate: '2020-06-01T14:30:00Z', homeTeamId: 'team-1', awayTeamName: 'Old Boys' }),
          makeMatch({ id: 'ours', matchDate: future(1), homeTeamId: 'team-1', awayTeamName: 'Riverside Occasionals' }),
          makeMatch({ id: 'theirs', matchDate: future(2), homeTeamId: null, homeTeamName: 'Hawks', homeLeagueTeamId: 'lt-hawks', awayTeamName: 'Eagles', venue: 'Eagle Park' }),
        ],
        totalPages: 1,
      })
    })

    it('hides played matches by default and Show played brings them back', async () => {
      const user = userEvent.setup()
      renderLeagueView(SCHEDULE_PATH)

      expect(await screen.findAllByTestId('fixture-row')).toHaveLength(2)
      expect(screen.queryByText('1st XI vs Old Boys')).not.toBeInTheDocument()

      await user.click(screen.getByRole('checkbox', { name: /show played/i }))
      expect(await screen.findAllByTestId('fixture-row')).toHaveLength(3)
      expect(screen.getByText('1st XI vs Old Boys')).toBeInTheDocument()
      expect(screen.getByText(/^Showing 3 matches/)).toBeInTheDocument()
    })

    it('Only our matches keeps the club-team matches', async () => {
      const user = userEvent.setup()
      renderLeagueView(SCHEDULE_PATH)
      await screen.findAllByTestId('fixture-row')

      await user.click(screen.getByRole('checkbox', { name: /only our matches/i }))

      expect(screen.getAllByTestId('fixture-row')).toHaveLength(1)
      expect(screen.getByText('1st XI vs Riverside Occasionals')).toBeInTheDocument()
    })

    it('the Team select narrows to a club team or a league team, and All teams clears it', async () => {
      const user = userEvent.setup()
      renderLeagueView(SCHEDULE_PATH)
      await screen.findAllByTestId('fixture-row')

      await user.click(screen.getByLabelText('Team'))
      await user.click(await screen.findByRole('option', { name: 'Hawks' }))
      expect(screen.getAllByTestId('fixture-row')).toHaveLength(1)
      expect(screen.getByText('Hawks vs Eagles')).toBeInTheDocument()

      await user.click(screen.getByLabelText('Team'))
      await user.click(await screen.findByRole('option', { name: 'All teams' }))
      expect(screen.getAllByTestId('fixture-row')).toHaveLength(2)
    })

    it('searches the team names and the venue, and says so when nothing matches', async () => {
      const user = userEvent.setup()
      renderLeagueView(SCHEDULE_PATH)
      await screen.findAllByTestId('fixture-row')

      await user.type(screen.getByLabelText('Search'), 'eagle park')
      expect(screen.getAllByTestId('fixture-row')).toHaveLength(1)

      await user.clear(screen.getByLabelText('Search'))
      await user.type(screen.getByLabelText('Search'), 'zzz')
      expect(await screen.findByText('No matching fixtures')).toBeInTheDocument()
    })
  })
})
