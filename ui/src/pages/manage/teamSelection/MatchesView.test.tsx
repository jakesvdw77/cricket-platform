import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TeamSelectionHubLayout from './TeamSelectionHubLayout'
import MatchesView from './MatchesView'
import { makeMatch, makeOverview, makePick, sampleMatches } from './teamSelectionTestUtils'

vi.mock('../../../api/leagueApi', () => ({ listLeagues: () => Promise.resolve([]) }))
vi.mock('../../../api/sectionApi', () => ({ listSections: () => Promise.resolve([]) }))
vi.mock('../../../api/teamApi', () => ({ listTeamsForClub: () => Promise.resolve([]) }))
vi.mock('../../../api/seasonApi', () => ({
  listSeasons: () =>
    Promise.resolve([{ id: 's-now', clubId: 'club-1', label: '2026', startDate: '2026-01-01', endDate: '2026-12-31', active: true, createdAt: '2026-01-01T00:00:00Z', updatedAt: '', updatedBy: null }]),
}))
// The hook and its fetcher live in one module, so the HTTP client is what the tests replace.
const get = vi.fn()
vi.mock('../../../api/axiosConfig', () => ({ default: { get: (...args: unknown[]) => get(...args) } }))
const getTeamSelection = {
  mockReset: () => get.mockReset(),
  mockResolvedValue: (value: unknown) => get.mockResolvedValue({ data: value }),
  mockRejectedValue: (error: unknown) => get.mockRejectedValue(error),
}
const lastParams = () => get.mock.lastCall?.[1].params
vi.mock('../matches/useTeamSheetShare', async () => ({ useTeamSheetShare: (await import('./teamSelectionShareMock')).useFakeTeamSheetShare }))
const announceMatchSide = vi.fn()
const updateMatchSide = vi.fn()
vi.mock('../../../api/matchSideApi', () => ({
  announceMatchSide: (...args: unknown[]) => announceMatchSide(...args),
  updateMatchSide: (...args: unknown[]) => updateMatchSide(...args),
}))

function renderView() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/manage/team-selection/matches']}>
        <Routes>
          <Route element={<Outlet context={{ clubId: 'club-1' }} />}>
            <Route path="/manage/team-selection" element={<TeamSelectionHubLayout />}>
              <Route path="matches" element={<MatchesView />} />
            </Route>
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const rows = () => screen.queryAllByTestId('selection-row')

beforeEach(() => {
  localStorage.clear()
  getTeamSelection.mockReset()
  getTeamSelection.mockResolvedValue(makeOverview(sampleMatches()))
  announceMatchSide.mockReset()
  updateMatchSide.mockReset()
})

describe('MatchesView', () => {
  it('Share on an announced row opens the team sheet dialog for that match and side', async () => {
    const overview = makeOverview(sampleMatches())
    get.mockImplementation((url: string) =>
      Promise.resolve({ data: url.endsWith('/team-selection') ? overview : { id: overview.matches[3].matchId } }),
    )
    renderView()
    await screen.findAllByTestId('selection-row')
    expect(screen.getAllByRole('button', { name: 'Share' })).toHaveLength(1)
    await userEvent.click(screen.getByRole('button', { name: 'Share' }))
    const dialog = await screen.findByTestId('share-dialog')
    expect(dialog).toHaveAttribute('data-match-id', overview.matches[3].matchId)
    expect(dialog).toHaveAttribute('data-scope', 'home')
  })

  it('shows the counters with the figures of the overview', async () => {
    renderView()
    await screen.findAllByTestId('selection-row')
    for (const [name, value] of [['Upcoming matches', '4'], ['Not started', '1'], ['In progress', '1'], ['Ready to announce', '1'], ['Announced', '1']]) {
      expect(screen.getByRole('button', { name: new RegExp(name) })).toHaveTextContent(value)
    }
  })

  it('filters the table to a counter and each counter equals its filter', async () => {
    renderView()
    await screen.findAllByTestId('selection-row')
    for (const [name, label] of [['Not started', 'Not started'], ['In progress', 'In progress'], ['Ready to announce', 'Ready to announce'], ['Announced', 'Announced']]) {
      const counter = screen.getByRole('button', { name: new RegExp(name) })
      const figure = Number(within(counter).getByText(/^\d+$/).textContent)
      await userEvent.click(counter)
      expect(counter).toHaveAttribute('aria-pressed', 'true')
      expect(rows()).toHaveLength(figure)
      rows().forEach((row) => expect(within(row).getByText(label, { selector: '.MuiChip-label' })).toBeInTheDocument())
    }
  })

  it('turns the filter off when the active counter is chosen again, and the first counter clears it', async () => {
    renderView()
    await screen.findAllByTestId('selection-row')
    const notStarted = screen.getByRole('button', { name: /Not started/ })
    await userEvent.click(notStarted)
    expect(rows()).toHaveLength(1)
    await userEvent.click(notStarted)
    expect(rows()).toHaveLength(4)
    await userEvent.click(notStarted)
    await userEvent.click(screen.getByRole('button', { name: /Upcoming matches/ }))
    expect(rows()).toHaveLength(4)
  })

  it('asks for past matches when View entire season is switched on', async () => {
    renderView()
    await screen.findAllByTestId('selection-row')
    expect(lastParams()).toEqual(expect.not.objectContaining({ includePast: true }))
    getTeamSelection.mockResolvedValue(makeOverview([...sampleMatches(), makeMatch({ matchId: 'old', upcoming: false, matchDate: '2026-09-01T10:00:00' }, 'ANNOUNCED')]))
    await userEvent.click(screen.getAllByRole('checkbox', { name: 'View entire season' })[0])
    await waitFor(() => expect(lastParams()).toEqual(expect.objectContaining({ includePast: true })))
    await waitFor(() => expect(rows()).toHaveLength(5))
    expect(screen.getByRole('button', { name: /Matches shown/ })).toHaveTextContent('5')
  })

  it('shows an empty state when there are no matches', async () => {
    getTeamSelection.mockResolvedValue(makeOverview([]))
    renderView()
    expect(await screen.findByText('No upcoming matches')).toBeInTheDocument()
  })

  it('announces a ready side after confirming', async () => {
    announceMatchSide.mockResolvedValue({})
    renderView()
    await screen.findAllByTestId('selection-row')
    await userEvent.click(screen.getByRole('button', { name: 'Announce' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('No captain selected.')).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Announce anyway' }))
    await waitFor(() => expect(announceMatchSide).toHaveBeenCalledWith('club-1', 'm-3', 'side-3'))
    expect(updateMatchSide).not.toHaveBeenCalled()
  })

  it('saves a captain chosen in the dialog from the row picks, keeping the keeper, before announcing', async () => {
    const matches = sampleMatches()
    matches[2].sides[0] = {
      ...matches[2].sides[0],
      wicketKeeperPlayerId: 'bob',
      twelfthManPlayerId: 'cy',
      picks: [makePick('ann', 1), makePick('bob', 2, { wicketKeeper: true }), makePick('cy', null, { twelfthMan: true })],
    }
    getTeamSelection.mockResolvedValue(makeOverview(matches))
    updateMatchSide.mockResolvedValue({})
    announceMatchSide.mockResolvedValue({})
    renderView()
    await screen.findAllByTestId('selection-row')
    await userEvent.click(screen.getByRole('button', { name: 'Announce' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).queryByText('No wicketkeeper selected.')).not.toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('combobox', { name: 'Captain' }))
    expect(within(await screen.findByRole('listbox')).getAllByRole('option').map((option) => option.textContent)).toEqual(['None', 'Ann Smith', 'Bob Smith'])
    await userEvent.click(screen.getByRole('option', { name: 'Ann Smith' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Announce team' }))
    await waitFor(() => expect(announceMatchSide).toHaveBeenCalledWith('club-1', 'm-3', 'side-3'))
    expect(updateMatchSide).toHaveBeenCalledWith('club-1', 'm-3', 'side-3', { captainPlayerId: 'ann', wicketKeeperPlayerId: 'bob', twelfthManPlayerId: 'cy' })
    expect(updateMatchSide.mock.invocationCallOrder[0]).toBeLessThan(announceMatchSide.mock.invocationCallOrder[0])
  })

  it('shows an error state when the overview fails', async () => {
    getTeamSelection.mockRejectedValue(new Error('boom'))
    renderView()
    expect(await screen.findByText("Couldn't load team selection")).toBeInTheDocument()
  })
})
