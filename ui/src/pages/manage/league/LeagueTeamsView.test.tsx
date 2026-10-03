import { screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  emptyPage,
  makeAffiliation,
  makeLeague,
  makeLeagueTeam,
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

const TEAMS_PATH = '/manage/fixtures/leagues/league-1/teams'

describe('LeagueTeamsView', () => {
  beforeEach(() => {
    mocks.listLeagues.mockResolvedValue([makeLeague()])
    mocks.listSeasons.mockResolvedValue([makeSeason()])
    // Honour activeOnly the way the endpoint does, so a test can prove inactive teams never show.
    mocks.listLeagueTeams.mockImplementation(
      async (_clubId: string, _leagueId: string, _seasonId: string, options?: { activeOnly?: boolean }) =>
        [
          makeLeagueTeam({ id: 'lt-active', name: 'Riverside Occasionals' }),
          makeLeagueTeam({ id: 'lt-inactive', name: 'Dormant CC', active: false }),
        ].filter((team) => !options?.activeOnly || team.active),
    )
  })

  it('lists the season\'s own teams under "Our teams", each linking to the team\'s detail page', async () => {
    mocks.listTeamsForClub.mockResolvedValue([makeTeam({ id: 'team-1', sectionId: 'section-1', name: '1st XI' })])
    mocks.listLeagueAffiliations.mockResolvedValue([makeAffiliation({ teamId: 'team-1' })])

    renderLeagueView(TEAMS_PATH)

    expect(await screen.findByRole('heading', { name: 'Teams in 2026' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Our teams' })).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: '1st XI' })).toHaveAttribute(
      'href',
      '/manage/sections/section-1/teams/team-1',
    )
  })

  it('lists active league teams under "League teams" with no link, and never an inactive one', async () => {
    renderLeagueView(TEAMS_PATH)

    expect(await screen.findByRole('heading', { name: 'League teams' })).toBeInTheDocument()
    expect(await screen.findByText('Riverside Occasionals')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Riverside Occasionals' })).not.toBeInTheDocument()
    expect(screen.queryByText('Dormant CC')).not.toBeInTheDocument()
    expect(mocks.listLeagueTeams).toHaveBeenCalledWith('test-club-id', 'league-1', 'season-1', { activeOnly: true })
  })

  it('renders both groups, own teams first, and only the group that has entries', async () => {
    mocks.listTeamsForClub.mockResolvedValue([makeTeam({ id: 'team-1', name: '1st XI' })])
    mocks.listLeagueAffiliations.mockResolvedValue([makeAffiliation({ teamId: 'team-1' })])

    const { unmount } = renderLeagueView(TEAMS_PATH)
    const own = await screen.findByRole('heading', { name: 'Our teams' })
    const league = await screen.findByRole('heading', { name: 'League teams' })
    expect(own.compareDocumentPosition(league) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    unmount()

    // Only league teams: no "Our teams" group.
    mocks.listLeagueAffiliations.mockResolvedValue([])
    const second = renderLeagueView(TEAMS_PATH)
    await screen.findByRole('heading', { name: 'League teams' })
    expect(screen.queryByRole('heading', { name: 'Our teams' })).not.toBeInTheDocument()
    second.unmount()

    // Only own teams: no "League teams" group.
    mocks.listLeagueAffiliations.mockResolvedValue([makeAffiliation({ teamId: 'team-1' })])
    mocks.listLeagueTeams.mockResolvedValue([])
    renderLeagueView(TEAMS_PATH)
    await screen.findByRole('heading', { name: 'Our teams' })
    expect(screen.queryByRole('heading', { name: 'League teams' })).not.toBeInTheDocument()
  })

  it('uses a logo-less avatar with the abbreviation, falling back to initials from the name', async () => {
    mocks.listTeamsForClub.mockResolvedValue([makeTeam({ id: 'team-1', name: 'Irene Villagers', abbreviation: 'IV1' })])
    mocks.listLeagueAffiliations.mockResolvedValue([makeAffiliation({ teamId: 'team-1' })])
    mocks.listLeagueTeams.mockResolvedValue([makeLeagueTeam({ name: 'Centurion Brits', abbreviation: null })])

    renderLeagueView(TEAMS_PATH)

    expect(await screen.findByText('IV1')).toBeInTheDocument()
    expect(await screen.findByText('CB')).toBeInTheDocument()
  })

  it('shows the empty copy when the season has neither own nor league teams', async () => {
    mocks.listLeagueTeams.mockResolvedValue([])

    renderLeagueView(TEAMS_PATH)

    expect(await screen.findByText('No teams registered for this season yet.')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Our teams' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'League teams' })).not.toBeInTheDocument()
  })

  it('does not show the empty copy while the teams are still loading', async () => {
    mocks.listLeagueTeams.mockReturnValue(new Promise(() => undefined))

    renderLeagueView(TEAMS_PATH)

    expect(await screen.findByLabelText('Loading teams')).toBeInTheDocument()
    expect(screen.queryByText('No teams registered for this season yet.')).not.toBeInTheDocument()
  })

  it('shows the no-seasons copy when the club has no seasons', async () => {
    mocks.listSeasons.mockResolvedValue([])

    renderLeagueView(TEAMS_PATH)

    expect(
      await screen.findByText('No seasons yet — teams are affiliated to a league for a specific season.'),
    ).toBeInTheDocument()
    expect(mocks.listLeagueTeams).not.toHaveBeenCalled()
  })

  it('has no Edit action on any tile, only the header Edit', async () => {
    mocks.listTeamsForClub.mockResolvedValue([makeTeam({ id: 'team-1', name: '1st XI' })])
    mocks.listLeagueAffiliations.mockResolvedValue([makeAffiliation({ teamId: 'team-1' })])

    renderLeagueView(TEAMS_PATH)

    await screen.findByRole('link', { name: '1st XI' })
    expect(screen.getAllByRole('link', { name: 'Edit' }).map((link) => link.getAttribute('href'))).toEqual([
      '/manage/fixtures/leagues/league-1/edit',
    ])
    expect(within(screen.getByRole('heading', { name: 'Teams in 2026' }).closest('.MuiCard-root') as HTMLElement).queryByText('Edit')).not.toBeInTheDocument()
  })
})
