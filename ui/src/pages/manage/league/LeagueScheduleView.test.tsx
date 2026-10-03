import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  emptyPage,
  makeAffiliation,
  makeLeague,
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
  listLeagues: (clubId: string) => mocks.listLeagues(clubId),
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

  it('renders the matching league\'s matches via LeagueFixtures for the selected season', async () => {
    mocks.listMatches.mockResolvedValue({
      ...emptyPage(),
      content: [makeMatch({ homeTeamId: 'team-1', awayTeamName: 'Riverside Occasionals' })],
      totalPages: 1,
    })

    renderLeagueView(SCHEDULE_PATH)

    expect(await screen.findByText('1st XI')).toBeInTheDocument()
    expect(screen.getByText('Riverside Occasionals')).toBeInTheDocument()
    expect(mocks.listMatches).toHaveBeenCalledWith(
      'test-club-id',
      expect.objectContaining({ leagueId: 'league-1', seasonId: 'season-1', sort: 'matchDate,asc', size: 200 }),
    )
  })

  it('renders the LeagueFixtures empty state when the season has no matches', async () => {
    renderLeagueView(SCHEDULE_PATH)

    expect(await screen.findByText('No fixtures yet')).toBeInTheDocument()
  })

  it('disables Share schedule and shows no empty state or countdown while matches are loading', async () => {
    mocks.listMatches.mockReturnValue(new Promise(() => undefined))

    renderLeagueView(SCHEDULE_PATH)

    expect(await screen.findByLabelText('Loading fixtures')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Share schedule' })).toBeDisabled()
    expect(screen.queryByText('No fixtures yet')).not.toBeInTheDocument()
    expect(screen.queryByText('Next match')).not.toBeInTheDocument()
  })

  it('renders the no-seasons copy when the club has no seasons', async () => {
    mocks.listSeasons.mockResolvedValue([])

    renderLeagueView(SCHEDULE_PATH)

    expect(
      await screen.findByText('No seasons yet — matches are scheduled for a league and a specific season.'),
    ).toBeInTheDocument()
    expect(mocks.listMatches).not.toHaveBeenCalled()
  })

  // The truncation regression (docs/specs/072-league-view-pages.md): 45 matches over three pages, the
  // next upcoming match only on the last one. The old single-page call showed the first 20 and a wrong
  // (or no) countdown.
  it('shows every match of a 45-match season across three pages and finds the next match on a later page', async () => {
    mocks.listMatches.mockImplementation(async (_clubId: string, params: { page: number }) => ({
      content: Array.from({ length: 15 }, (_, index) => {
        const n = params.page * 15 + index
        // The last page holds the only future-dated fixtures.
        const matchDate =
          params.page === 2 ? `2099-0${(index % 9) + 1}-10T10:00:00Z` : `2020-0${(index % 9) + 1}-${10 + params.page}T10:00:00Z`
        return makeMatch({ id: `match-${n}`, homeTeamId: 'team-1', awayTeamName: `Opponent ${n}`, matchDate })
      }),
      totalElements: 45,
      totalPages: 3,
      number: params.page,
      size: 15,
    }))

    renderLeagueView(SCHEDULE_PATH)

    expect(await screen.findByText('Next match')).toBeInTheDocument()
    expect(mocks.listMatches).toHaveBeenCalledTimes(3)
    expect(mocks.listMatches.mock.calls.map(([, params]) => (params as { page: number }).page)).toEqual([0, 1, 2])
    // The countdown repeats its own match, so count distinct opponents instead of text nodes.
    const names = new Set(screen.getAllByText(/^Opponent \d+$/).map((node) => node.textContent))
    expect(names.size).toBe(45)
    expect(names.has('Opponent 0')).toBe(true)
    expect(names.has('Opponent 44')).toBe(true)
  })

  it('renders NextMatchCountdown above LeagueFixtures when an upcoming match exists', async () => {
    mocks.listMatches.mockResolvedValue({
      ...emptyPage(),
      content: [makeMatch({ id: 'future', homeTeamId: 'team-1', awayTeamName: 'Riverside Occasionals', matchDate: '2099-06-01T14:30:00Z' })],
      totalPages: 1,
    })

    renderLeagueView(SCHEDULE_PATH)

    const countdownLabel = await screen.findByText('Next match')
    const fixturesHeading = screen.getByRole('heading', { name: 'Fixtures' })
    expect(fixturesHeading.compareDocumentPosition(countdownLabel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    const fixtureTeams = screen.getAllByText('1st XI')
    expect(countdownLabel.compareDocumentPosition(fixtureTeams[fixtureTeams.length - 1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('renders no countdown when the season has no upcoming match', async () => {
    mocks.listMatches.mockResolvedValue({
      ...emptyPage(),
      content: [makeMatch({ id: 'past', homeTeamId: 'team-1', awayTeamName: 'Riverside Occasionals', matchDate: '2020-06-01T14:30:00Z' })],
      totalPages: 1,
    })

    renderLeagueView(SCHEDULE_PATH)

    await screen.findByText('Riverside Occasionals')
    expect(screen.queryByText('Next match')).not.toBeInTheDocument()
  })

  it('opens ShareScheduleDialog from the "Share schedule" button', async () => {
    const user = userEvent.setup()
    mocks.listLeagueAffiliations.mockResolvedValue([makeAffiliation({ teamId: 'team-1' })])

    renderLeagueView(SCHEDULE_PATH)

    await screen.findByRole('heading', { name: 'Fixtures' })
    expect(screen.queryByText('Share Schedule')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Share schedule' }))

    expect(await screen.findByText('Share Schedule')).toBeInTheDocument()
    expect(within(screen.getByRole('dialog')).getByText('Share Schedule')).toBeInTheDocument()
  })
})
