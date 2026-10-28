import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from '../../../api/axiosConfig'
import type { MyLeagueDto } from '../../../api/myPlayersApi'
import { HubLeague } from './HubLeague'
import type { LeagueTab } from './leagueFormat'
import { calls, httpError, newQueryClient, routeApi } from '../../../test/accountTestUtils'
import type { ApiMock } from '../../../test/accountTestUtils'
import { conditions, leagueDto } from '../../../test/hubLeagueFixtures'

vi.mock('../../../api/axiosConfig', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }))
vi.mock('./HubLeagueShare', () => ({ HubLeagueShare: ({ dto }: { dto: MyLeagueDto }) => <div data-testid="share-stub">{dto.shareDisabledFormats.join(',')}</div> }))

// docs/specs/123 (League page): one query for six tabs, a read-only page with no Back, Edit or fixture link.
const http = api as unknown as ApiMock

function renderLeague(data: MyLeagueDto | Error, tab: LeagueTab = 'details', onTab = vi.fn(), seasonId?: string) {
  routeApi(http, { 'GET /me/players/k1/leagues/l1': data })
  return render(
    <QueryClientProvider client={newQueryClient()}>
      <HubLeague playerKey="k1" leagueId="l1" seasonId={seasonId} clubId="c1" clubName="Paarl CC" tab={tab} onTab={onTab} />
    </QueryClientProvider>,
  )
}

beforeEach(() => vi.clearAllMocks())

describe('HubLeague', () => {
  it('shows the league name, season, and the player\'s teams as tags, then the Details tab', async () => {
    renderLeague(leagueDto())

    expect(await screen.findByRole('heading', { name: 'Boland Under 15' })).toBeInTheDocument()
    const page = screen.getByTestId('hub-league')
    expect(within(page).getByText('2026/27')).toBeInTheDocument()
    expect(within(page).getAllByText('Paarl U15').length).toBeGreaterThan(0)
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Weekend cricket for juniors.')
    expect(screen.getByText('Season starts')).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Key dates' })).not.toBeInTheDocument()
  })

  it('has six tabs in order and reports a tab change', async () => {
    const onTab = vi.fn()
    renderLeague(leagueDto(), 'details', onTab)
    await screen.findByTestId('hub-league')

    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Details', 'Playing conditions', 'Teams', 'Schedule', 'Results', 'Fields'])
    await userEvent.setup().click(screen.getByRole('tab', { name: 'Results' }))
    expect(onTab).toHaveBeenCalledWith('results')
  })

  it.each([
    ['conditions', 'Free hit after a no ball'],
    ['teams', 'Wellington U15'],
    ['schedule', 'Only my games'],
    ['results', 'Paarl U15 won by 30 runs'],
    ['fields', 'Riverside Oval'],
  ] as const)('shows the %s tab content', async (tab, text) => {
    renderLeague(leagueDto(), tab)

    expect(await within(await screen.findByRole('tabpanel')).findByText(text)).toBeInTheDocument()
    expect(screen.getByRole('tab', { selected: true })).toHaveAttribute('id', `hub-league-tab-${tab}`)
  })

  it('shows the balls per over rule on the conditions tab', async () => {
    renderLeague(leagueDto({ playingConditions: conditions({ maxBallsPerOver: 8 }) }), 'conditions')

    expect(await screen.findByText('At most 8, wides and no balls included')).toBeInTheDocument()
  })

  it('shows the Fields empty state', async () => {
    renderLeague(leagueDto({ fields: [] }), 'fields')
    expect(await screen.findByText('No fields for this league yet')).toBeInTheDocument()
  })

  it('puts the website and social icons and the share control in the header, top right', async () => {
    const base = leagueDto()
    renderLeague(leagueDto({ league: { ...base.league, website: 'https://boland.example', socialLinks: [{ platform: 'facebook', url: 'https://facebook.com/b' }] as never } }))

    const share = await screen.findByTestId('share-stub')
    expect(screen.getByRole('link', { name: 'Website (opens in a new tab)' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Facebook (opens in a new tab)' })).toBeInTheDocument()
    const header = share.parentElement as HTMLElement
    expect(within(header).getByRole('link', { name: 'Website (opens in a new tab)' })).toBeInTheDocument()
    expect(header).toHaveStyle({ marginLeft: 'auto' })
  })

  it('passes the club\'s disabled formats to Share and has no Back, Edit or fixture link', async () => {
    renderLeague(leagueDto({ shareDisabledFormats: ['ICS'] }), 'schedule')

    expect(await screen.findByTestId('share-stub')).toHaveTextContent('ICS')
    expect(screen.queryByRole('button', { name: /back/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /edit|add/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('asks for the league with the season from the URL', async () => {
    renderLeague(leagueDto(), 'details', vi.fn(), 's0')
    await screen.findByTestId('hub-league')

    expect(calls(http.get, '/me/players/k1/leagues/l1')[0][1]).toEqual({ params: { seasonId: 's0' } })
  })

  it('shows a busy skeleton while loading', () => {
    http.get.mockImplementation(() => new Promise(() => undefined))
    const { container } = render(
      <QueryClientProvider client={newQueryClient()}>
        <HubLeague playerKey="k1" leagueId="l1" clubId="c1" clubName={null} tab="details" onTab={vi.fn()} />
      </QueryClientProvider>,
    )

    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
  })

  it('shows an error with Retry, for example a 404', async () => {
    const user = userEvent.setup()
    renderLeague(httpError(404))
    expect(await screen.findByText('We could not load this league. Please try again.')).toBeInTheDocument()

    routeApi(http, { 'GET /me/players/k1/leagues/l1': leagueDto() })
    await user.click(screen.getByRole('button', { name: 'Retry' }))

    expect(await screen.findByTestId('hub-league')).toBeInTheDocument()
  })
})
