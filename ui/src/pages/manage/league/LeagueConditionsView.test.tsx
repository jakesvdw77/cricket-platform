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

// docs/specs/127-return-navigation.md: the origin and label carried in an href.
function returnOf(href: string | null) {
  const params = new URLSearchParams((href ?? '').split('?')[1])
  return { to: params.get('returnTo'), label: params.get('returnLabel') }
}

describe('LeagueConditionsView', () => {
  beforeEach(() => {
    mocks.listLeagues.mockResolvedValue([makeLeague()])
    mocks.listSeasons.mockResolvedValue([makeSeason()])
  })

  it('renders the empty copy when nothing is set for the season', async () => {
    renderLeagueView(CONDITIONS_PATH)

    expect(await screen.findByText('No Playing Conditions set for this season yet.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Playing Conditions.pdf' })).not.toBeInTheDocument()
    expect(mocks.getPlayingConditions).toHaveBeenCalledWith('test-club-id', 'league-1', 'season-1')
  })

  it('renders every row, including bonus rows, without showing the stored file name', async () => {
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

    // The stored uuid-prefixed file name is never shown, and the PDF is a Manage League option, not a tab button.
    expect(screen.queryByText(/2f6a1c9e/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Playing Conditions.pdf' })).not.toBeInTheDocument()
  })

  it('omits the bonus rows, shows the "(auto)" hint when bonus points are off', async () => {
    mocks.getPlayingConditions.mockResolvedValue(
      makePlayingConditions({ maxOversPerBowler: null, bonusPointsEnabled: false, documentUrl: null }),
    )

    renderLeagueView(CONDITIONS_PATH)

    expect(await screen.findByText('4 (auto)')).toBeInTheDocument()
    expect(screen.queryByText(/Before over/)).not.toBeInTheDocument()
    expect(screen.queryByText(/% of target/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Playing Conditions.pdf' })).not.toBeInTheDocument()
  })

  it('shows the empty copy when a document exists with no structured fields', async () => {
    mocks.getPlayingConditions.mockResolvedValue(
      makePlayingConditions({ documentUrl: '/media/only-a-pdf.pdf', uploadedAt: '2026-02-01T09:00:00Z', maxOversPerInnings: null }),
    )

    renderLeagueView(CONDITIONS_PATH)

    expect(await screen.findByText('No Playing Conditions set for this season yet.')).toBeInTheDocument()
  })

  it('has one white Manage Playing Conditions menu on the tab row: Edit, Share, View Document in that order', async () => {
    mocks.getPlayingConditions.mockResolvedValue(makePlayingConditions({ documentUrl: 'https://example.test/pc.pdf' }))
    renderLeagueView(CONDITIONS_PATH)

    await screen.findByText('Playing conditions for 2026')
    const actions = screen.getByTestId('league-tab-actions')
    const trigger = within(actions).getByRole('button', { name: 'Manage Playing Conditions' })
    expect(trigger.className).toContain('MuiButton-outlined')
    expect(within(actions).getAllByRole('button')).toHaveLength(1)
    await userEvent.click(trigger)
    const items = (await screen.findAllByRole('menuitem')).map((item) => item.querySelector('span')?.textContent)
    expect(items).toEqual(['Edit Playing Conditions', 'Share Playing Conditions', 'View Document'])
    expect(screen.getByRole('menuitem', { name: /Edit Playing Conditions/ })).toHaveAttribute('href', expect.stringContaining('/manage/fixtures/leagues/league-1/edit?tab=conditions&seasonId=season-1'))
  })

  it('disables View Document with "No PDF uploaded" when the season has none', async () => {
    mocks.getPlayingConditions.mockResolvedValue(makePlayingConditions({ documentUrl: null }))
    renderLeagueView(CONDITIONS_PATH)

    await screen.findByText('Playing conditions for 2026')
    await userEvent.click(within(screen.getByTestId('league-tab-actions')).getByRole('button', { name: 'Manage Playing Conditions' }))
    const item = await screen.findByRole('menuitem', { name: /View Document/ })
    expect(item).toHaveAttribute('aria-disabled', 'true')
    expect(item).toHaveTextContent('No PDF uploaded')
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

  // docs/specs/124: the two rules read as lines in the Innings card.
  it('shows no limit and free hit Yes by default, and the limit with the free hit off when set', async () => {
    mocks.getPlayingConditions.mockResolvedValue(makePlayingConditions())
    const { unmount } = renderLeagueView(CONDITIONS_PATH)
    const innings = await screen.findByTestId('conditions-innings')
    expect(within(innings).getByText('Balls per over').nextSibling).toHaveTextContent('No limit')
    expect(within(innings).getByText('Free hit after a no ball').nextSibling).toHaveTextContent('Yes')
    unmount()

    mocks.getPlayingConditions.mockResolvedValue(makePlayingConditions({ maxBallsPerOver: 8, freeHitOnNoBall: false }))
    renderLeagueView(CONDITIONS_PATH)
    const next = await screen.findByTestId('conditions-innings')
    expect(await within(next).findByText('At most 8, wides and no balls included')).toBeInTheDocument()
    expect(within(next).getByText('Free hit after a no ball').nextSibling).toHaveTextContent('No')
  })

  // docs/specs/127-return-navigation.md
  it('Edit Conditions carries the Conditions tab (with the season) as its origin', async () => {
    mocks.getPlayingConditions.mockResolvedValue(makePlayingConditions())
    renderLeagueView(`${CONDITIONS_PATH}`)

    await screen.findByText('Playing conditions for 2026')
    await userEvent.click(within(screen.getByTestId('league-tab-actions')).getByRole('button', { name: 'Manage Playing Conditions' }))
    const edit = await screen.findByRole('menuitem', { name: /Edit Playing Conditions/ })
    expect(returnOf(edit.getAttribute('href'))).toEqual({ to: CONDITIONS_PATH, label: 'Internal League playing conditions' })
  })
})
