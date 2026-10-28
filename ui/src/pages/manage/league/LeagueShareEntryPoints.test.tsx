import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyPage, makeLeague, makeSeason, renderLeagueView } from './leagueViewTestUtils'

// docs/specs/122-league-sharing.md (Entry points): the Playing conditions tab opens the Share League dialog with Playing
// conditions ticked, the league view header's button is labelled "Share" (not "Share schedule") and ticks Schedule on every tab.
// The dialog itself is covered by ShareLeagueDialog.test.tsx; here it is a stub that shows what it was opened with.
vi.mock('../../../components/ShareLeagueDialog', () => ({
  ShareLeagueDialog: (props: { open: boolean; preselected: string[]; seasonId?: string | null; league: { name: string } }) =>
    props.open ? (
      <div role="dialog" aria-label="Share league stub" data-preselected={props.preselected.join(',')} data-season={props.seasonId ?? ''}>
        {props.league.name}
      </div>
    ) : null,
}))

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
  getPlayingConditions: (clubId: string, leagueId: string, seasonId: string) => mocks.getPlayingConditions(clubId, leagueId, seasonId),
}))
vi.mock('../../../api/axiosConfig', () => ({
  default: {
    get: async (url: string, config: { params: unknown }) => ({ data: await mocks.listMatches(url.split('/')[3], config.params) }),
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
  mocks.listLeagues.mockResolvedValue([makeLeague()])
  mocks.listSeasons.mockResolvedValue([makeSeason()])
  mocks.listTeamsForClub.mockResolvedValue([])
  mocks.listLeagueAffiliations.mockResolvedValue([])
  mocks.listLeagueContacts.mockResolvedValue([])
  mocks.listLeagueTeams.mockResolvedValue([])
  mocks.getPlayingConditions.mockResolvedValue(null)
  mocks.listMatches.mockResolvedValue(emptyPage())
})

const PATH = '/manage/fixtures/leagues/league-1'

describe('league view Share entry points', () => {
  it('labels the header button "Share" with no "Share schedule" anywhere', async () => {
    renderLeagueView(`${PATH}/schedule`)

    expect((await screen.findAllByRole('button', { name: 'Share' })).length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: /Share schedule/i })).not.toBeInTheDocument()
  })

  it.each(['schedule', 'teams', 'conditions'])('the header Share on the %s tab opens the dialog with Schedule ticked and the selected season', async (tab) => {
    renderLeagueView(`${PATH}/${tab}`)

    await userEvent.click((await screen.findAllByRole('button', { name: 'Share' }))[0])

    const dialog = await screen.findByRole('dialog', { name: 'Share league stub' })
    expect(dialog).toHaveAttribute('data-preselected', 'SCHEDULE')
    expect(dialog).toHaveAttribute('data-season', 'season-1')
    expect(dialog).toHaveTextContent('Internal League')
  })

  it('the Playing conditions tab Share opens the dialog with only Playing conditions ticked', async () => {
    renderLeagueView(`${PATH}/conditions`)
    await screen.findByText('Playing conditions for 2026')

    await userEvent.click(screen.getAllByRole('button', { name: 'Share' }).at(-1) as HTMLElement)

    expect(await screen.findByRole('dialog', { name: 'Share league stub' })).toHaveAttribute('data-preselected', 'CONDITIONS')
  })
})
