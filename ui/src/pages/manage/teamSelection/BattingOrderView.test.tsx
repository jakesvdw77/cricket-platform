import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import BattingOrderView from './BattingOrderView'
import TeamSelectionHubLayout from './TeamSelectionHubLayout'
import { makeMatch, makeOverview, makePick, makeSide, sampleBoard } from './teamSelectionTestUtils'

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
const announceMatchSide = vi.fn()
const reorderMatchSidePlayers = vi.fn()
vi.mock('../../../api/matchSelectionApi', () => ({ applySelection: (...args: unknown[]) => applySelection(...args) }))
vi.mock('../../../api/matchSideApi', () => ({
  createMatchSide: (...args: unknown[]) => createMatchSide(...args),
  removeMatchSidePlayer: (...args: unknown[]) => removeMatchSidePlayer(...args),
  announceMatchSide: (...args: unknown[]) => announceMatchSide(...args),
  reorderMatchSidePlayers: (...args: unknown[]) => reorderMatchSidePlayers(...args),
}))

const lastParams = () => get.mock.lastCall?.[1].params

function renderView() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/manage/team-selection/batting']}>
        <Routes>
          <Route element={<Outlet context={{ clubId: 'club-1' }} />}>
            <Route path="/manage/team-selection" element={<TeamSelectionHubLayout />}>
              <Route path="batting" element={<BattingOrderView />} />
            </Route>
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  localStorage.clear()
  get.mockReset()
  get.mockResolvedValue({ data: sampleBoard() })
  applySelection.mockReset().mockResolvedValue({})
  createMatchSide.mockReset().mockResolvedValue({ id: 'new-side' })
  removeMatchSidePlayer.mockReset().mockResolvedValue({})
  announceMatchSide.mockReset().mockResolvedValue({})
  reorderMatchSidePlayers.mockReset().mockResolvedValue({})
})

const cellAt = (match: string, team: string, position: number) => screen.getByTestId(`batting-cell-${match}-${team}-${position}`)

describe('BattingOrderView', () => {
  it('lays the matches out in slot order, one column per club side, with positions 1 to 11 and the 12th man down', async () => {
    renderView()
    await screen.findByTestId('batting-cell-m-1-team-1-1')
    const slots = screen.getAllByRole('columnheader').filter((header) => /^(Morning|Afternoon)$/.test(header.textContent ?? ''))
    expect(slots.map((slot) => slot.textContent)).toEqual(['Morning', 'Afternoon'])
    const headers = screen.getAllByRole('columnheader').map((header) => header.textContent ?? '')
    expect(headers.filter((text) => /^Vets/.test(text)).length).toBe(4)
    const rowHeads = screen.getAllByRole('rowheader').map((head) => head.textContent)
    expect(rowHeads.slice(0, 13)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12th man', 'No position'])
  })

  it('shows names with C and WK markers at their positions, the 12th man and the unpositioned pick', async () => {
    renderView()
    await screen.findByTestId('batting-cell-m-1-team-1-1')
    expect(cellAt('m-1', 'team-1', 1)).toHaveTextContent('Ann SmithC')
    expect(cellAt('m-1', 'team-1', 2)).toHaveTextContent('Bob SmithWK')
    expect(screen.getByTestId('batting-twelfth-m-1-team-1')).toHaveTextContent('Cy Smith')
    expect(screen.getByTestId('batting-unpositioned-m-1-team-1')).toHaveTextContent('Dee Smith')
  })

  it('shows + Add on each open position and nowhere else', async () => {
    renderView()
    await screen.findByTestId('batting-cell-m-1-team-1-1')
    expect(screen.queryByTestId('add-m-1-team-1-1')).not.toBeInTheDocument()
    expect(screen.queryByTestId('add-m-1-team-1-2')).not.toBeInTheDocument()
    expect(screen.getByTestId('add-m-1-team-1-3')).toHaveTextContent('+ Add')
    expect(screen.getByTestId('add-m-2-team-2-1')).toBeInTheDocument()
  })

  it('offers only the eligible players, not the picked or the ruled out', async () => {
    renderView()
    await userEvent.click(await screen.findByTestId('add-m-1-team-1-3'))
    const menu = await screen.findByRole('menu', { name: 'Players for position 3' })
    expect(within(menu).getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['Fay Jones'])
  })

  it('adds the chosen player at that position, keeping the current picks, then refreshes the overview', async () => {
    renderView()
    await userEvent.click(await screen.findByTestId('add-m-1-team-1-3'))
    const reads = get.mock.calls.length
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Fay Jones' }))
    await waitFor(() => expect(applySelection).toHaveBeenCalledTimes(1))
    expect(applySelection).toHaveBeenCalledWith('club-1', 'm-1', 'side-1', {
      players: [
        { playerProfileId: 'bob' },
        { playerProfileId: 'ann' },
        { playerProfileId: 'dee' },
        { playerProfileId: 'cy' },
        { playerProfileId: 'fay', battingOrder: 3 },
      ],
    })
    await waitFor(() => expect(get.mock.calls.length).toBeGreaterThan(reads))
  })

  it('creates the side first when the match has none', async () => {
    renderView()
    await userEvent.click(await screen.findByTestId('add-m-2-team-2-4'))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Gus Brown' }))
    await waitFor(() => expect(applySelection).toHaveBeenCalledTimes(1))
    expect(createMatchSide).toHaveBeenCalledWith('club-1', 'm-2', 'team-2')
    expect(applySelection).toHaveBeenCalledWith('club-1', 'm-2', 'new-side', { players: [{ playerProfileId: 'gus', battingOrder: 4 }] })
  })

  it("shows the rule's message when the pick is refused", async () => {
    applySelection.mockRejectedValue({
      isAxiosError: true,
      response: { status: 409, data: { detail: 'Not allowed', rejections: [{ playerProfileId: 'fay', playerName: 'Fay Jones', reason: 'TAKEN_FOR_SLOT', message: 'Fay Jones is already picked for Vets B in this slot.', taken: null }] } },
    })
    renderView()
    await userEvent.click(await screen.findByTestId('add-m-1-team-1-3'))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Fay Jones' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Fay Jones is already picked for Vets B in this slot.')
  })

  it('says so when nobody is eligible', async () => {
    const data = sampleBoard()
    data.players = []
    get.mockResolvedValue({ data })
    renderView()
    await userEvent.click(await screen.findByTestId('add-m-1-team-1-3'))
    expect(await screen.findByRole('menuitem', { name: 'No eligible players' })).toHaveAttribute('aria-disabled', 'true')
  })

  it('links each column to the Select team page and offers Announce only on a column that is ready', async () => {
    renderView()
    await screen.findByTestId('batting-cell-m-1-team-1-1')
    expect(screen.getByRole('link', { name: 'Select players, Vets A v Oakfield' })).toHaveAttribute('href', '/manage/team-selection/matches/m-1/sides/side-1')
    expect(screen.getByRole('link', { name: 'Select players, Vets A v Vets B, Vets B' })).toHaveAttribute('href', '/manage/team-selection/matches/m-3/sides/s-b')
    expect(screen.getAllByRole('button', { name: /^Announce team/ })).toHaveLength(1)
  })

  it('announces after the confirm dialog and refreshes the overview', async () => {
    renderView()
    await userEvent.click(await screen.findByRole('button', { name: 'Announce team, Vets A v Vets B, Vets A' }))
    expect(announceMatchSide).not.toHaveBeenCalled()
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Announce team' }))
    await waitFor(() => expect(announceMatchSide).toHaveBeenCalledWith('club-1', 'm-3', 's-a'))
  })

  it('keeps the two sides of a derby in separate columns with their own gauges', async () => {
    renderView()
    await screen.findByTestId('batting-cell-m-3-team-a-1')
    expect(cellAt('m-3', 'team-b', 1)).toHaveTextContent('Eve Smith')
    expect(screen.getByTestId('add-m-3-team-a-1')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Vets A selection, 12 of 12 picked' })).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Vets B selection, 1 of 12 picked' })).toBeInTheDocument()
  })

  it('sends the hub filters and Show past, and filters the columns by the search text', async () => {
    renderView()
    await screen.findByTestId('batting-cell-m-1-team-1-1')
    expect(lastParams()).toEqual({ seasonId: 's-now' })
    await userEvent.click(screen.getByRole('checkbox', { name: /show past matches/i }))
    await waitFor(() => expect(lastParams()).toEqual({ seasonId: 's-now', includePast: true }))
    await userEvent.type(screen.getByPlaceholderText('Search by team or opponent'), 'hillside')
    expect(screen.queryByTestId('batting-cell-m-1-team-1-1')).not.toBeInTheDocument()
    expect(screen.getByTestId('batting-cell-m-2-team-2-1')).toBeInTheDocument()
  })

  it('shows fewer positions for a side with fewer batting places as a dash, not an Add', async () => {
    const data = makeOverview([
      makeMatch({ matchId: 'x-1', sides: [makeSide({ limits: { battingPlaces: 9, twelfthManAllowed: false, maxSelected: 9 }, picks: [makePick('ann', 1)], pickedCount: 1 })] }),
      makeMatch({ matchId: 'x-2', sides: [makeSide({ teamId: 'team-2', sideId: 's2' })] }),
    ])
    get.mockResolvedValue({ data })
    renderView()
    await screen.findByTestId('batting-cell-x-1-team-1-1')
    expect(screen.queryByTestId('add-x-1-team-1-10')).not.toBeInTheDocument()
    expect(screen.getByTestId('add-x-2-team-2-10')).toBeInTheDocument()
    expect(cellAt('x-1', 'team-1', 10)).toHaveTextContent('-')
  })

  describe('move up and move down', () => {
    const threeBatters = () => {
      const data = makeOverview([
        makeMatch({
          matchId: 'x-1',
          label: 'Vets A v Oakfield',
          sides: [makeSide({ picks: [makePick('cal', 3), makePick('ann', 1), makePick('bob', 2), makePick('cy', null, { twelfthMan: true })], pickedCount: 4 })],
        }),
      ])
      get.mockResolvedValue({ data })
    }

    it('swaps a batter with the one above, sending the full batting order to the reorder call', async () => {
      threeBatters()
      renderView()
      const reads = get.mock.calls.length
      await userEvent.click(await screen.findByRole('button', { name: 'Move Cal Smith up, Vets A v Oakfield' }))
      await waitFor(() => expect(reorderMatchSidePlayers).toHaveBeenCalledTimes(1))
      expect(reorderMatchSidePlayers).toHaveBeenCalledWith('club-1', 'x-1', 'side-1', ['ann', 'cal', 'bob'])
      await waitFor(() => expect(get.mock.calls.length).toBeGreaterThan(reads))
    })

    it('swaps a batter with the one below', async () => {
      threeBatters()
      renderView()
      await userEvent.click(await screen.findByRole('button', { name: 'Move Ann Smith down, Vets A v Oakfield' }))
      await waitFor(() => expect(reorderMatchSidePlayers).toHaveBeenCalledWith('club-1', 'x-1', 'side-1', ['bob', 'ann', 'cal']))
    })

    it('disables up at position 1 and down at the last filled position', async () => {
      threeBatters()
      renderView()
      expect(await screen.findByRole('button', { name: 'Move Ann Smith up, Vets A v Oakfield' })).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Move Ann Smith down, Vets A v Oakfield' })).toBeEnabled()
      expect(screen.getByRole('button', { name: 'Move Cal Smith down, Vets A v Oakfield' })).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Move Cal Smith up, Vets A v Oakfield' })).toBeEnabled()
    })

    it('ignores further clicks while a write is in flight', async () => {
      threeBatters()
      reorderMatchSidePlayers.mockReturnValue(new Promise(() => {}))
      renderView()
      await userEvent.click(await screen.findByRole('button', { name: 'Move Cal Smith up, Vets A v Oakfield' }))
      await waitFor(() => expect(screen.getByRole('button', { name: 'Move Bob Smith up, Vets A v Oakfield' })).toBeDisabled())
      fireEvent.click(screen.getByRole('button', { name: 'Move Bob Smith up, Vets A v Oakfield' }))
      expect(reorderMatchSidePlayers).toHaveBeenCalledTimes(1)
    })

    it("shows the rule's message in the dismissible alert when the move is refused", async () => {
      threeBatters()
      reorderMatchSidePlayers.mockRejectedValue({ isAxiosError: true, response: { status: 409, data: { detail: 'Order not allowed.' } } })
      renderView()
      await userEvent.click(await screen.findByRole('button', { name: 'Move Cal Smith up, Vets A v Oakfield' }))
      expect(await screen.findByRole('alert')).toHaveTextContent('Order not allowed.')
    })

    it('offers no arrows on the 12th man, an empty position, the no position row or an announced side', async () => {
      threeBatters()
      renderView()
      await screen.findByTestId('batting-cell-x-1-team-1-1')
      expect(screen.queryByRole('button', { name: /Move Cy Smith/ })).not.toBeInTheDocument()
      expect(within(cellAt('x-1', 'team-1', 4)).queryByRole('button', { name: /^Move/ })).not.toBeInTheDocument()
      expect(screen.getAllByRole('button', { name: /^Move/ })).toHaveLength(6)
    })

    describe('on an announced side', () => {
      const move = 'Move Eve Smith down, Vets A v Vets B, Vets B'
      const announcedSide = () => {
        const data = makeOverview([
          makeMatch({
            matchId: 'x-1',
            label: 'Vets A v Oakfield',
            sides: [makeSide({ announced: true, picks: [makePick('ann', 1), makePick('bob', 2)], pickedCount: 2 })],
          }),
        ])
        get.mockResolvedValue({ data })
      }

      it('shows the arrows', async () => {
        renderView()
        await screen.findByTestId('batting-cell-m-3-team-b-1')
        expect(within(cellAt('m-3', 'team-b', 1)).getAllByRole('button')).toHaveLength(2)
        expect(screen.getByRole('button', { name: move })).toBeInTheDocument()
      })

      it('asks first, and does nothing on cancel', async () => {
        announcedSide()
        renderView()
        await userEvent.click(await screen.findByRole('button', { name: 'Move Ann Smith down, Vets A v Oakfield' }))
        const dialog = await screen.findByRole('dialog')
        expect(within(dialog).getByText('Change an announced team?')).toBeInTheDocument()
        expect(reorderMatchSidePlayers).not.toHaveBeenCalled()
        await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
        expect(reorderMatchSidePlayers).not.toHaveBeenCalled()
      })

      it('sends the reorder on confirm', async () => {
        announcedSide()
        renderView()
        await userEvent.click(await screen.findByRole('button', { name: 'Move Ann Smith down, Vets A v Oakfield' }))
        await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Move and un-announce' }))
        await waitFor(() => expect(reorderMatchSidePlayers).toHaveBeenCalledTimes(1))
        expect(reorderMatchSidePlayers).toHaveBeenCalledWith('club-1', 'x-1', 'side-1', ['bob', 'ann'])
      })
    })

    it('moves a non-announced side immediately, with no dialog', async () => {
      threeBatters()
      renderView()
      await userEvent.click(await screen.findByRole('button', { name: 'Move Cal Smith up, Vets A v Oakfield' }))
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      await waitFor(() => expect(reorderMatchSidePlayers).toHaveBeenCalledTimes(1))
    })
  })
})
