import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyPage, makeLeague, makePlayingConditions, makeSeason, renderLeagueView } from './leagueViewTestUtils'

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

const CONDITIONS_PATH = '/manage/fixtures/leagues/league-1/conditions'

describe('LeagueConditionsView', () => {
  beforeEach(() => {
    mocks.listLeagues.mockResolvedValue([makeLeague()])
    mocks.listSeasons.mockResolvedValue([makeSeason()])
  })

  it('renders the empty copy and a Share button when nothing is set for the season', async () => {
    renderLeagueView(CONDITIONS_PATH)

    expect(await screen.findByText('No Playing Conditions set for this season yet.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Share' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Playing Conditions.pdf' })).not.toBeInTheDocument()
    expect(mocks.getPlayingConditions).toHaveBeenCalledWith('test-club-id', 'league-1', 'season-1')
  })

  it('renders every row, including bonus rows, and a "Playing Conditions.pdf" button opening the stored URL', async () => {
    const user = userEvent.setup()
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    mocks.getPlayingConditions.mockResolvedValue(
      makePlayingConditions({
        documentUrl: '/media/2f6a1c9e-rules.pdf',
        maxOversPerBowler: 4,
        fieldingRestrictionsNotes: 'Two fielders outside the circle in the powerplay.',
        allowSubstitutions: true,
        bonusPointsEnabled: true,
        bonusBattingOversThreshold: 17,
        bonusBowlingRestrictionPercentage: 80,
        additionalNotes: 'No DLS below 5 overs a side.',
      }),
    )

    renderLeagueView(CONDITIONS_PATH)

    expect(await screen.findByText('20')).toBeInTheDocument()
    expect(screen.getByText('6')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getByText('Two fielders outside the circle in the powerplay.')).toBeInTheDocument()
    expect(screen.getByText('Substitutions allowed')).toBeInTheDocument()
    expect(screen.getByText('Before over 17')).toBeInTheDocument()
    expect(screen.getByText('80% of target')).toBeInTheDocument()
    expect(screen.getByText('No DLS below 5 overs a side.')).toBeInTheDocument()
    expect(screen.queryByText('No Playing Conditions set for this season yet.')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Playing Conditions.pdf' }))
    expect(openSpy).toHaveBeenCalledWith('/media/2f6a1c9e-rules.pdf', '_blank', 'noopener')
    // The stored uuid-prefixed file name is never shown.
    expect(screen.queryByText(/2f6a1c9e/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'View full document' })).not.toBeInTheDocument()

    openSpy.mockRestore()
  })

  it('omits the bonus rows, shows the "(auto)" hint and hides the PDF button when bonus points are off and no PDF is uploaded', async () => {
    mocks.getPlayingConditions.mockResolvedValue(
      makePlayingConditions({ maxOversPerBowler: null, bonusPointsEnabled: false, documentUrl: null }),
    )

    renderLeagueView(CONDITIONS_PATH)

    expect(await screen.findByText('4 (auto)')).toBeInTheDocument()
    expect(screen.queryByText(/Before over/)).not.toBeInTheDocument()
    expect(screen.queryByText(/% of target/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Playing Conditions.pdf' })).not.toBeInTheDocument()
  })

  it('shows just the PDF button and the empty copy when a document exists with no structured fields', async () => {
    mocks.getPlayingConditions.mockResolvedValue(
      makePlayingConditions({ documentUrl: '/media/only-a-pdf.pdf', uploadedAt: '2026-02-01T09:00:00Z', maxOversPerInnings: null }),
    )

    renderLeagueView(CONDITIONS_PATH)

    expect(await screen.findByRole('button', { name: 'Playing Conditions.pdf' })).toBeInTheDocument()
    expect(screen.getByText('No Playing Conditions set for this season yet.')).toBeInTheDocument()
  })

  it('opens PlayingConditionsShareDialog from the Share button', async () => {
    const user = userEvent.setup()

    renderLeagueView(CONDITIONS_PATH)

    await screen.findByText('Playing conditions for 2026')
    expect(screen.queryByText('Share Playing Conditions')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Share' }))

    expect(await screen.findByText('Share Playing Conditions')).toBeInTheDocument()
    expect(screen.queryByText('Share Schedule')).not.toBeInTheDocument()
  })

  // docs/specs/091 (C): icon-tile section cards, the two top ones the same height.
  it('groups the rows into Innings and Points cards that fill their grid row, with Fielding and Additional notes cards below', async () => {
    mocks.getPlayingConditions.mockResolvedValue(
      makePlayingConditions({ fieldingRestrictionsNotes: 'Two fielders back.', additionalNotes: 'Reserve day.' }),
    )

    renderLeagueView(CONDITIONS_PATH)

    const innings = await screen.findByTestId('conditions-innings')
    const points = screen.getByTestId('conditions-points')
    expect(within(innings).getByRole('heading', { name: 'Innings' })).toBeInTheDocument()
    expect(within(innings).getByText('Max overs per innings')).toBeInTheDocument()
    expect(within(points).getByRole('heading', { name: 'Points' })).toBeInTheDocument()
    expect(within(points).getByText('Forfeit win')).toBeInTheDocument()
    expect(getComputedStyle(innings.parentElement as HTMLElement).alignItems).toBe('stretch')
    expect(getComputedStyle(innings).height).toBe('100%')
    expect(getComputedStyle(points).height).toBe('100%')
    expect(within(screen.getByTestId('conditions-fielding')).getByText('Two fielders back.')).toBeInTheDocument()
    expect(within(screen.getByTestId('conditions-notes')).getByText('Reserve day.')).toBeInTheDocument()
  })

  it('omits the notes cards when there are no notes', async () => {
    mocks.getPlayingConditions.mockResolvedValue(makePlayingConditions())

    renderLeagueView(CONDITIONS_PATH)

    await screen.findByTestId('conditions-innings')
    expect(screen.queryByTestId('conditions-fielding')).not.toBeInTheDocument()
    expect(screen.queryByTestId('conditions-notes')).not.toBeInTheDocument()
  })

  it('names the season on the tab line', async () => {
    renderLeagueView(CONDITIONS_PATH)

    expect(await screen.findByText('Playing conditions for 2026')).toBeInTheDocument()
  })
})
