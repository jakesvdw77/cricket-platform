import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyPage, makeLeague, makeSeason, renderLeagueView } from './leagueViewTestUtils'

// docs/specs/122-league-sharing.md (Entry points): the league view's Manage League panel offers "Share League" (not "Share schedule"), ticking Schedule on every tab
// except Conditions, which ticks Playing conditions.
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
  it('offers "Share League" in the Manage League panel, with no "Share schedule" and no header Share button', async () => {
    renderLeagueView(`${PATH}/schedule`)

    await userEvent.click(await screen.findByRole('button', { name: 'Manage League' }))

    expect(screen.getByRole('menuitem', { name: /Share League/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Share' })).not.toBeInTheDocument()
    expect(screen.queryByText(/Share schedule/i)).not.toBeInTheDocument()
  })

  it.each([
    ['schedule', 'SCHEDULE'],
    ['teams', 'SCHEDULE'],
    ['conditions', 'CONDITIONS'],
  ])('Share League on the %s tab opens the dialog with %s ticked and the selected season', async (tab, ticked) => {
    renderLeagueView(`${PATH}/${tab}`)

    await userEvent.click(await screen.findByRole('button', { name: 'Manage League' }))
    await userEvent.click(screen.getByRole('menuitem', { name: /Share League/ }))

    const dialog = await screen.findByRole('dialog', { name: 'Share league stub' })
    expect(dialog).toHaveAttribute('data-preselected', ticked)
    expect(dialog).toHaveAttribute('data-season', 'season-1')
    expect(dialog).toHaveTextContent('Internal League')
  })

  it.each([
    ['schedule', 'Manage Schedule', /Share Schedule/, 'SCHEDULE'],
    ['teams', 'Manage Teams', /Share Teams/, 'TEAMS'],
    ['conditions', 'Manage Playing Conditions', /Share Playing Conditions/, 'CONDITIONS'],
  ])('the %s tab menu share item opens the dialog with only %s ticked', async (tab, label, item, ticked) => {
    renderLeagueView(`${PATH}/${tab}`)

    await userEvent.click(await screen.findByRole('button', { name: label }))
    await userEvent.click(screen.getByRole('menuitem', { name: item }))

    const dialog = await screen.findByRole('dialog', { name: 'Share league stub' })
    expect(dialog).toHaveAttribute('data-preselected', ticked)
    expect(dialog).toHaveAttribute('data-season', 'season-1')
  })
})
