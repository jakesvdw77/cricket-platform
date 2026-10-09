import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PlayersView from './PlayersView'
import TeamSelectionHubLayout from './TeamSelectionHubLayout'
import { makeCell, makeMatch, makeOverview, makePlayer, makeSide } from './teamSelectionTestUtils'
import type { TeamSelectionOverview } from '../../../api/teamSelectionApi'

vi.mock('../../../api/leagueApi', () => ({ listLeagues: () => Promise.resolve([]) }))
vi.mock('../../../api/sectionApi', () => ({ listSections: () => Promise.resolve([]) }))
vi.mock('../../../api/teamApi', () => ({ listTeamsForClub: () => Promise.resolve([]) }))
vi.mock('../../../api/seasonApi', () => ({
  listSeasons: () =>
    Promise.resolve([{ id: 's-now', clubId: 'club-1', label: '2026', startDate: '2026-01-01', endDate: '2026-12-31', active: true, createdAt: '2026-01-01T00:00:00Z', updatedAt: '', updatedBy: null }]),
}))
const get = vi.fn()
vi.mock('../../../api/axiosConfig', () => ({ default: { get: (...args: unknown[]) => get(...args) } }))
const applySelection = vi.fn()
const createMatchSide = vi.fn()
const removeMatchSidePlayer = vi.fn()
vi.mock('../../../api/matchSelectionApi', () => ({ applySelection: (...args: unknown[]) => applySelection(...args) }))
vi.mock('../../../api/matchSideApi', () => ({
  createMatchSide: (...args: unknown[]) => createMatchSide(...args),
  removeMatchSidePlayer: (...args: unknown[]) => removeMatchSidePlayer(...args),
}))

const lastParams = () => get.mock.lastCall?.[1].params

function renderView() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/manage/team-selection/players']}>
        <Routes>
          <Route element={<Outlet context={{ clubId: 'club-1' }} />}>
            <Route path="/manage/team-selection" element={<TeamSelectionHubLayout />}>
              <Route path="players" element={<PlayersView />} />
            </Route>
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const pick = (id: string, battingOrder: number | null) => ({
  playerId: id, firstName: 'X', lastName: id, battingOrder, role: 'BATSMAN' as const, captain: false, wicketKeeper: false, twelfthMan: false,
})

// Two matches: m-1 has Ann picked (and Bob not), m-2 has no side yet.
function overview(): TeamSelectionOverview {
  const m1 = makeMatch({ matchId: 'm-1', label: 'Vets A v Oakfield', sides: [makeSide({ pickedCount: 1, picks: [pick('ann', 1)] })] }, 'IN_PROGRESS')
  const m2 = makeMatch({ matchId: 'm-2', matchDate: '2026-10-24T10:00:00', label: 'Vets A v Hillside', sides: [makeSide({ sideId: null })] })
  return {
    ...makeOverview([m1, m2]),
    players: [
      makePlayer('ann', 'Ann', 'Archer', [makeCell({ matchId: 'm-1', picked: true }), makeCell({ matchId: 'm-2', sideId: null })]),
      makePlayer('bob', 'Bob', 'Baker', [makeCell({ matchId: 'm-1' }), makeCell({ matchId: 'm-2', sideId: null, pickable: false, reasonCode: 'SAID_UNAVAILABLE' })]),
    ],
  }
}

const cell = (player: string, match: string, team = 'team-1') => screen.getByTestId(`cell-${player}-${match}-${team}`)

beforeEach(() => {
  localStorage.clear()
  get.mockReset()
  get.mockResolvedValue({ data: overview() })
  applySelection.mockReset().mockResolvedValue({})
  createMatchSide.mockReset().mockResolvedValue({ id: 'new-side' })
  removeMatchSidePlayer.mockReset().mockResolvedValue({})
})

describe('PlayersView', () => {
  it('shows the picked dot on picked cells and the Picked n / max header and footer', async () => {
    renderView()
    await screen.findByTestId('cell-ann-m-1-team-1')
    expect(within(cell('ann', 'm-1')).getByTestId('picked-dot')).toBeInTheDocument()
    expect(within(cell('bob', 'm-1')).queryByTestId('picked-dot')).not.toBeInTheDocument()
    expect(screen.getByText('Picked 1 / 12')).toBeInTheDocument()
    expect(screen.getAllByText('1 / 12')).toHaveLength(1)
    expect(screen.getAllByText('0 / 12')).toHaveLength(1)
  })

  it('picks a player with the current picks kept and the next batting position, then refreshes the overview', async () => {
    renderView()
    const bob = await screen.findByTestId('cell-bob-m-1-team-1')
    const reads = get.mock.calls.length
    await userEvent.click(bob)
    await waitFor(() => expect(applySelection).toHaveBeenCalledTimes(1))
    expect(applySelection).toHaveBeenCalledWith('club-1', 'm-1', 'side-1', {
      players: [{ playerProfileId: 'ann' }, { playerProfileId: 'bob', battingOrder: 2 }],
    })
    await waitFor(() => expect(get.mock.calls.length).toBeGreaterThan(reads))
  })

  it('shows each answer with the pick state in the cell name, and a legend with a Picked entry', async () => {
    const data = overview()
    data.players[0].cells[0] = makeCell({ matchId: 'm-1', picked: true, availability: 'UNSURE' })
    data.players[1].cells[1] = makeCell({ matchId: 'm-2', sideId: null, pickable: false, availability: 'UNAVAILABLE', reasonCode: 'SAID_UNAVAILABLE' })
    data.players[1].cells[0] = makeCell({ matchId: 'm-1', availability: 'NOT_POLLED' })
    get.mockResolvedValue({ data })
    renderView()
    expect(await screen.findByTestId('cell-ann-m-1-team-1')).toHaveAccessibleName(/Ann Archer, .*: Unsure, picked, click to remove/)
    expect(cell('bob', 'm-2')).toHaveAccessibleName(/Bob Baker, .*: Unavailable, not picked: Said they are unavailable/)
    expect(within(cell('bob', 'm-1')).getByText('–')).toBeInTheDocument()
    expect(within(cell('ann', 'm-1')).getByText('?')).toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: 'Legend' })).getByText('Picked for the match')).toBeInTheDocument()
  })

  it('creates the side first when the match has none', async () => {
    renderView()
    await userEvent.click(await screen.findByTestId('cell-ann-m-2-team-1'))
    await waitFor(() => expect(applySelection).toHaveBeenCalledTimes(1))
    expect(createMatchSide).toHaveBeenCalledWith('club-1', 'm-2', 'team-1')
    expect(applySelection).toHaveBeenCalledWith('club-1', 'm-2', 'new-side', { players: [{ playerProfileId: 'ann', battingOrder: 1 }] })
  })

  it('unpicks a picked player through the remove endpoint', async () => {
    renderView()
    await userEvent.click(await screen.findByTestId('cell-ann-m-1-team-1'))
    await waitFor(() => expect(removeMatchSidePlayer).toHaveBeenCalledWith('club-1', 'm-1', 'side-1', 'ann'))
    expect(applySelection).not.toHaveBeenCalled()
  })

  it("shows the rule's message when a pick is refused", async () => {
    applySelection.mockRejectedValue({
      isAxiosError: true,
      response: { status: 409, data: { detail: 'Not allowed', rejections: [{ playerProfileId: 'bob', playerName: 'Bob Baker', reason: 'TAKEN_FOR_SLOT', message: 'Bob Baker is already picked for Vets B in this slot.', taken: null }] } },
    })
    renderView()
    await userEvent.click(await screen.findByTestId('cell-bob-m-1-team-1'))
    expect(await screen.findByRole('alert')).toHaveTextContent('Bob Baker is already picked for Vets B in this slot.')
  })

  it('mutes a cell that cannot be picked, says why in a tooltip and does not write on click', async () => {
    renderView()
    const muted = await screen.findByTestId('cell-bob-m-2-team-1')
    expect(muted).toHaveAttribute('data-muted', 'true')
    expect(muted).toHaveAttribute('aria-disabled', 'true')
    await userEvent.hover(muted)
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Said they are unavailable')
    await userEvent.click(muted)
    expect(applySelection).not.toHaveBeenCalled()
    expect(createMatchSide).not.toHaveBeenCalled()
  })

  it.each([
    ['AGE_INELIGIBLE', 'age rule'],
    ['NOT_CONFIRMED', 'not confirmed'],
    ['TAKEN_FOR_SLOT', 'another match in this time slot'],
    ['NOT_IN_POOL', 'selection pool'],
    ['TEAM_FULL', 'team is full'],
  ] as const)('explains %s in words', async (code, text) => {
    const data = overview()
    data.players[1].cells[0] = makeCell({ matchId: 'm-1', pickable: false, reasonCode: code })
    get.mockResolvedValue({ data })
    renderView()
    await userEvent.hover(await screen.findByTestId('cell-bob-m-1-team-1'))
    expect((await screen.findByRole('tooltip')).textContent?.toLowerCase()).toContain(text)
  })

  it('sends the hub filters and Show past, and filters the rows by the search text', async () => {
    renderView()
    await screen.findByTestId('cell-ann-m-1-team-1')
    expect(lastParams()).toEqual({ seasonId: 's-now' })
    await userEvent.click(screen.getByRole('checkbox', { name: /view entire season/i }))
    await waitFor(() => expect(lastParams()).toEqual({ seasonId: 's-now', includePast: true }))
    await userEvent.type(screen.getByPlaceholderText('Search players'), 'bak')
    expect(screen.queryByTestId('cell-ann-m-1-team-1')).not.toBeInTheDocument()
    expect(screen.getByTestId('cell-bob-m-1-team-1')).toBeInTheDocument()
  })

  it('tells the manager when the server cut the list short', async () => {
    get.mockResolvedValue({ data: { ...overview(), truncated: true } })
    renderView()
    expect(await screen.findByText(/Showing the first 2 matches and 2 players/)).toBeInTheDocument()
  })

  it('shows two marks in one match column for a derby, each for its own side', async () => {
    const derby = makeMatch(
      {
        matchId: 'd-1',
        label: 'Vets A v Vets B',
        sides: [
          makeSide({ sideId: 's-a', teamId: 'team-a', teamName: 'Vets A', pickedCount: 1, picks: [pick('ann', 1)] }),
          makeSide({ sideId: 's-b', teamId: 'team-b', teamName: 'Vets B', home: false }),
        ],
      },
      'IN_PROGRESS',
    )
    get.mockResolvedValue({
      data: {
        ...makeOverview([derby]),
        players: [
          makePlayer('ann', 'Ann', 'Archer', [
            makeCell({ matchId: 'd-1', teamId: 'team-a', sideId: 's-a', picked: true }),
            makeCell({ matchId: 'd-1', teamId: 'team-b', sideId: 's-b', pickable: false, reasonCode: 'TAKEN_FOR_SLOT' }),
          ]),
        ],
      },
    })
    renderView()
    await screen.findByTestId('cell-ann-d-1-team-a')
    expect(screen.getAllByRole('columnheader', { name: /Vets A v Vets B/ })).toHaveLength(1)
    expect(within(cell('ann', 'd-1', 'team-a')).getByTestId('picked-dot')).toBeInTheDocument()
    expect(within(cell('ann', 'd-1', 'team-b')).queryByTestId('picked-dot')).not.toBeInTheDocument()
    expect(cell('ann', 'd-1', 'team-b')).toHaveAttribute('data-muted', 'true')
    expect(screen.getByText('Vets A: Picked 1 / 12')).toBeInTheDocument()
    expect(screen.getByText('Vets B: Picked 0 / 12')).toBeInTheDocument()
  })

  it('shows an empty state when there are no matches', async () => {
    get.mockResolvedValue({ data: makeOverview([]) })
    renderView()
    expect(await screen.findByText('No upcoming matches')).toBeInTheDocument()
  })
})
