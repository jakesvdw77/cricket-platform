import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from '../../../api/axiosConfig'
import type { MyLeaguesDto } from '../../../api/myPlayersApi'
import { HubLeagues } from './HubLeagues'
import { calls, httpError, newQueryClient, routeApi } from '../../../test/accountTestUtils'
import type { ApiMock } from '../../../test/accountTestUtils'
import { leaguesDto } from '../../../test/hubLeagueFixtures'

vi.mock('../../../api/axiosConfig', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }))

// docs/specs/123 (Leagues list): season switcher, one card per league, loading, error, and the empty state.
const http = api as unknown as ApiMock

function renderList(data: MyLeaguesDto | Error, props: { seasonId?: string; onSeasonChange?: (id: string) => void; onOpen?: (l: string, s: string) => void } = {}) {
  routeApi(http, { 'GET /me/players/k1/leagues': data })
  return render(
    <QueryClientProvider client={newQueryClient()}>
      <HubLeagues playerKey="k1" seasonId={props.seasonId} onSeasonChange={props.onSeasonChange ?? vi.fn()} onOpen={props.onOpen ?? vi.fn()} />
    </QueryClientProvider>,
  )
}

beforeEach(() => vi.clearAllMocks())

describe('HubLeagues', () => {
  it('shows a heading and one card per league', async () => {
    renderList(leaguesDto())

    expect(screen.getByRole('heading', { name: 'Leagues' })).toBeInTheDocument()
    expect(await screen.findAllByTestId('hub-league-card')).toHaveLength(2)
    expect(screen.getByRole('heading', { name: 'Boland Under 15' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Cape Premier' })).toBeInTheDocument()
  })

  it('opens a league with its id and the shown season', async () => {
    const onOpen = vi.fn()
    renderList(leaguesDto(), { onOpen })

    await userEvent.setup().click(await screen.findByRole('button', { name: /Cape Premier/ }))

    expect(onOpen).toHaveBeenCalledWith('l2', 's1')
  })

  it('offers the seasons, marks the current one, and reports a change', async () => {
    const user = userEvent.setup()
    const onSeasonChange = vi.fn()
    renderList(leaguesDto(), { onSeasonChange })
    await screen.findAllByTestId('hub-league-card')

    await user.click(screen.getByRole('combobox', { name: 'Season' }))
    const options = screen.getAllByRole('option')
    expect(options.map((o) => o.textContent)).toEqual(['2026/27 (current)', '2025/26'])
    await user.click(options[1])

    expect(onSeasonChange).toHaveBeenCalledWith('s0')
  })

  it('asks for the season from the URL', async () => {
    renderList(leaguesDto({ seasonId: 's0' }), { seasonId: 's0' })
    await screen.findAllByTestId('hub-league-card')

    expect(calls(http.get, '/me/players/k1/leagues')[0][1]).toEqual({ params: { seasonId: 's0' } })
  })

  it('shows the brand icon and "No league available" when the player has none', async () => {
    renderList(leaguesDto({ leagues: [] }))

    const empty = await screen.findByTestId('hub-leagues-empty')
    expect(within(empty).getByText('No league available')).toBeInTheDocument()
    expect(empty.querySelector('img, svg')).not.toBeNull()
    expect(screen.queryByTestId('hub-league-card')).not.toBeInTheDocument()
  })

  it('shows skeletons while loading', async () => {
    http.get.mockImplementation(() => new Promise(() => undefined))
    const { container } = render(
      <QueryClientProvider client={newQueryClient()}>
        <HubLeagues playerKey="k1" onSeasonChange={vi.fn()} onOpen={vi.fn()} />
      </QueryClientProvider>,
    )

    await waitFor(() => expect(container.querySelectorAll('.MuiSkeleton-root')).toHaveLength(3))
  })

  it('shows an error with Retry that loads the list again', async () => {
    const user = userEvent.setup()
    renderList(httpError(500))
    expect(await screen.findByText('We could not load the leagues. Please try again.')).toBeInTheDocument()

    routeApi(http, { 'GET /me/players/k1/leagues': leaguesDto() })
    await user.click(screen.getByRole('button', { name: 'Retry' }))

    expect(await screen.findAllByTestId('hub-league-card')).toHaveLength(2)
  })
})
