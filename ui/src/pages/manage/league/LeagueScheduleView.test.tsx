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
      data: url.includes('/imports')
        ? { content: [], totalElements: 0, totalPages: 0, number: 0, size: 1 }
        : await mocks.listMatches(url.split('/')[3], config.params),
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

// docs/specs/127-return-navigation.md: the origin and label carried in an href.
function returnOf(href: string | null) {
  const params = new URLSearchParams((href ?? '').split('?')[1])
  return { to: params.get('returnTo'), label: params.get('returnLabel') }
}

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
    expect(screen.getAllByTestId('fixture-row-away').map((c) => c.querySelector('[title]')?.getAttribute('title'))).toContain('Riverside Occasionals')
    expect(within(table).getByTestId('fixture-row-venue')).toHaveTextContent('Riverside Oval')
    expect(screen.queryByTestId('fixtures-count')).not.toBeInTheDocument()
    expect(screen.queryByText(/^1 upcoming match$/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Showing/)).not.toBeInTheDocument()
    expect(mocks.listMatches).toHaveBeenCalledWith(
      'test-club-id',
      expect.objectContaining({ leagueId: 'league-1', seasonId: 'season-1', sort: 'matchDate,asc', size: 200 }),
    )
  })

  it('fuses the toolbar into the fixtures table card, with the switches in the toolbar row', async () => {
    mocks.listMatches.mockResolvedValue({
      ...emptyPage(),
      content: [makeMatch({ matchDate: future(1), homeTeamId: 'team-1', awayTeamName: 'Riverside Occasionals' })],
      totalPages: 1,
    })
    renderLeagueView(SCHEDULE_PATH)

    const card = await screen.findByTestId('fixtures-fused-card')
    const toolbar = within(card).getByTestId('toolbar-card-fused')
    expect(within(toolbar).getByLabelText('Search')).toBeInTheDocument()
    expect(within(toolbar).getByRole('button', { name: /only our matches/i })).toBeInTheDocument()
    expect(toolbar.nextElementSibling).toBe(within(card).getByRole('table', { name: 'Fixtures' }))
    expect(screen.queryByTestId('toolbar-card')).not.toBeInTheDocument()
  })

  it('keeps the fused card for No matching fixtures: the message replaces the rows and the search keeps focus', async () => {
    const user = userEvent.setup()
    mocks.listMatches.mockResolvedValue({
      ...emptyPage(),
      content: [makeMatch({ matchDate: future(1), homeTeamId: 'team-1', awayTeamName: 'Riverside Occasionals' })],
      totalPages: 1,
    })
    renderLeagueView(SCHEDULE_PATH)
    await screen.findByTestId('fixtures-fused-card')

    const input = screen.getByLabelText('Search')
    await user.type(input, 'zzz')
    expect(await screen.findByText('No matching fixtures')).toBeInTheDocument()
    const card = screen.getByTestId('fixtures-fused-card')
    expect(within(card).getByText('No matching fixtures')).toBeInTheDocument()
    expect(within(card).queryByRole('table', { name: 'Fixtures' })).not.toBeInTheDocument()
    expect(screen.queryByTestId('toolbar-card')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Search')).toBe(input)
    expect(document.activeElement).toBe(input)
  })

  it('has one flat control bar: Team, Search and both switches in a single row with no card, the switches once', async () => {
    renderLeagueView(SCHEDULE_PATH)

    const bar = await screen.findByTestId('filter-bar-bare')
    expect(within(bar).getByLabelText('Team')).toBeInTheDocument()
    expect(within(bar).getByLabelText('Search')).toBeInTheDocument()
    const inline = within(bar).getByTestId('filter-bar-inline-controls')
    expect(within(inline).getByRole('button', { name: /only our matches/i })).toBeInTheDocument()
    expect(within(inline).getByRole('button', { name: /view entire season/i })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /only our matches/i })).toHaveLength(1)
    expect(screen.getAllByRole('button', { name: /view entire season/i })).toHaveLength(1)
    expect(within(inline).getByRole('button', { name: /only our matches/i })).toHaveAttribute('aria-pressed', 'false')
  })

  it('puts one white Manage Schedule menu on the tab row: Add Match, Import Schedule, Share Schedule', async () => {
    mocks.listMatches.mockResolvedValue({
      ...emptyPage(),
      content: [makeMatch({ matchDate: future(1), homeTeamId: 'team-1', awayTeamName: 'Riverside Occasionals' })],
      totalPages: 1,
    })
    renderLeagueView(SCHEDULE_PATH)

    await screen.findByRole('table', { name: 'Fixtures' })
    const actions = screen.getByTestId('league-tab-actions')
    const trigger = within(actions).getByRole('button', { name: 'Manage Schedule' })
    expect(trigger.className).toContain('MuiButton-outlined')
    expect(within(actions).getAllByRole('button')).toHaveLength(1)
    expect(screen.getByRole('navigation', { name: 'League views' })).toContainElement(actions)
    await userEvent.click(trigger)
    const items = (await screen.findAllByRole('menuitem')).map((item) => item.querySelector('span')?.textContent)
    expect(items).toEqual(['Add Match', 'Import Schedule', 'Share Schedule'])
    expect(screen.getByRole('menuitem', { name: /Add Match/ })).toHaveAttribute('href', expect.stringContaining('/manage/fixtures/matches/new?leagueId=league-1&seasonId=season-1'))
    expect(screen.getByRole('menuitem', { name: /Import Schedule/ })).toHaveAttribute('href', expect.stringContaining('/schedule/import?seasonId=season-1&from=view'))
  })

  it('shows Import Schedule and Add Match in the empty state as well as the Manage Schedule menu', async () => {
    const user = userEvent.setup()
    renderLeagueView(SCHEDULE_PATH)

    expect(await screen.findByText('No fixtures yet')).toBeInTheDocument()
    expect(within(screen.getByTestId('league-tab-actions')).getByRole('button', { name: 'Manage Schedule' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Import Schedule' })).toHaveLength(1)
    const add = screen.getByRole('link', { name: 'Add Match' })
    expect(add.className).toContain('MuiButton-contained')
    expect(add).toHaveAttribute('href', expect.stringContaining('/manage/fixtures/matches/new?leagueId=league-1&seasonId=season-1'))
    await user.click(add)
    expect(screen.getByTestId('location')).toHaveTextContent('/manage/fixtures/matches/new?leagueId=league-1&seasonId=season-1')
  })

  it('disables Add Match and Import Schedule while the league has no season', async () => {
    mocks.listSeasons.mockResolvedValue([])
    renderLeagueView(SCHEDULE_PATH)

    await screen.findByText(/No seasons yet/)
    expect(screen.queryByRole('link', { name: 'Add Match' })).not.toBeInTheDocument()
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
    expect(within(ours).getByRole('link', { name: '1st XI vs Riverside Occasionals' })).toHaveAttribute('href', expect.stringContaining('/manage/fixtures/matches/ours'))
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

    expect(await screen.findAllByTestId('fixture-row')).toHaveLength(45)
    expect(screen.queryByText(/^45 upcoming matches$/)).not.toBeInTheDocument()
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

    it('hides played matches by default and View entire season brings them back', async () => {
      const user = userEvent.setup()
      renderLeagueView(SCHEDULE_PATH)

      expect(await screen.findAllByTestId('fixture-row')).toHaveLength(2)
      expect(screen.queryAllByTestId('fixture-row-away').map((c) => c.querySelector('[title]')?.getAttribute('title'))).not.toContain('Old Boys')

      await user.click(screen.getByRole('button', { name: /view entire season/i }))
      expect(screen.getByRole('button', { name: /view entire season/i })).toHaveAttribute('aria-pressed', 'true')
      expect(await screen.findAllByTestId('fixture-row')).toHaveLength(3)
      expect(screen.getAllByTestId('fixture-row-away').map((c) => c.querySelector('[title]')?.getAttribute('title'))).toContain('Old Boys')
      expect(screen.queryByText(/^3 matches$/)).not.toBeInTheDocument()
    })

    it('Only our matches keeps the club-team matches', async () => {
      const user = userEvent.setup()
      renderLeagueView(SCHEDULE_PATH)
      await screen.findAllByTestId('fixture-row')

      await user.click(screen.getByRole('button', { name: /only our matches/i }))

      expect(screen.getAllByTestId('fixture-row')).toHaveLength(1)
      expect(screen.getAllByTestId('fixture-row-away').map((c) => c.querySelector('[title]')?.getAttribute('title'))).toContain('Riverside Occasionals')
    })

    it('the Team select narrows to a club team or a league team, and All teams clears it', async () => {
      const user = userEvent.setup()
      renderLeagueView(SCHEDULE_PATH)
      await screen.findAllByTestId('fixture-row')

      await user.click(screen.getByLabelText('Team'))
      await user.click(await screen.findByRole('option', { name: 'Hawks' }))
      expect(screen.getAllByTestId('fixture-row')).toHaveLength(1)
      expect(screen.getAllByTestId('fixture-row-away').map((c) => c.querySelector('[title]')?.getAttribute('title'))).toContain('Eagles')

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

  // docs/specs/127-return-navigation.md
  describe('return navigation (127)', () => {
    const future = (day: number) => `2099-06-${String(day).padStart(2, '0')}T14:30:00Z`

    beforeEach(() => {
      mocks.listLeagues.mockResolvedValue([makeLeague()])
      mocks.listSeasons.mockResolvedValue([makeSeason()])
      mocks.listTeamsForClub.mockResolvedValue([makeTeam({ id: 'team-1', name: '1st XI' })])
      mocks.listMatches.mockResolvedValue({
        ...emptyPage(),
        content: [
          makeMatch({ id: 'played', matchDate: '2020-06-01T14:30:00Z', homeTeamId: 'team-1', awayTeamName: 'Old Boys' }),
          makeMatch({ id: 'ours', matchDate: future(1), homeTeamId: 'team-1', awayTeamName: 'Riverside Occasionals' }),
        ],
        totalPages: 1,
      })
    })

    it('starts with the whole season visible when the address has showAll=1', async () => {
      renderLeagueView(`${SCHEDULE_PATH}?seasonId=season-1&showAll=1`)

      expect(await screen.findAllByTestId('fixture-row')).toHaveLength(2)
      expect(screen.getByRole('button', { name: /view entire season/i })).toHaveAttribute('aria-pressed', 'true')
    })

    it('still starts on upcoming matches only without showAll', async () => {
      renderLeagueView(`${SCHEDULE_PATH}?seasonId=season-1`)

      expect(await screen.findAllByTestId('fixture-row')).toHaveLength(1)
      expect(screen.getByRole('button', { name: /view entire season/i })).toHaveAttribute('aria-pressed', 'false')
    })

    it('the row link and menu items return to this schedule (tab and season) labelled with the league', async () => {
      const user = userEvent.setup()
      renderLeagueView(`${SCHEDULE_PATH}?seasonId=season-1`)

      const [row] = await screen.findAllByTestId('fixture-row')
      const origin = { to: `${SCHEDULE_PATH}?seasonId=season-1`, label: 'Internal League schedule' }
      expect(returnOf(within(row).getByRole('link', { name: '1st XI vs Riverside Occasionals' }).getAttribute('href'))).toEqual(origin)
      await user.click(within(row).getByRole('button', { name: /^Actions for/ }))
      for (const item of screen.getAllByRole('menuitem')) expect(returnOf(item.getAttribute('href'))).toEqual(origin)
    })

    it('the empty state Add Match carries the schedule as its origin', async () => {
      mocks.listMatches.mockResolvedValue(emptyPage())
      renderLeagueView(`${SCHEDULE_PATH}?seasonId=season-1`)

      const add = await screen.findByRole('link', { name: 'Add Match' })
      expect(returnOf(add.getAttribute('href'))).toEqual({ to: `${SCHEDULE_PATH}?seasonId=season-1`, label: 'Internal League schedule' })
    })
  })
})
