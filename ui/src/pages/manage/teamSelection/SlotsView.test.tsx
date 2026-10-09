import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SlotsView from './SlotsView'
import TeamSelectionHubLayout from './TeamSelectionHubLayout'
import { makeOverview, sampleBoard } from './teamSelectionTestUtils'

vi.mock('../../../api/leagueApi', () => ({ listLeagues: () => Promise.resolve([]) }))
vi.mock('../../../api/sectionApi', () => ({ listSections: () => Promise.resolve([]) }))
vi.mock('../../../api/teamApi', () => ({ listTeamsForClub: () => Promise.resolve([]) }))
vi.mock('../../../api/seasonApi', () => ({
  listSeasons: () =>
    Promise.resolve([{ id: 's-now', clubId: 'club-1', label: '2026', startDate: '2026-01-01', endDate: '2026-12-31', active: true, createdAt: '2026-01-01T00:00:00Z', updatedAt: '', updatedBy: null }]),
}))
const get = vi.fn()
vi.mock('../../../api/axiosConfig', () => ({ default: { get: (...args: unknown[]) => get(...args) } }))

const lastParams = () => get.mock.lastCall?.[1].params

function renderView() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/manage/team-selection/slots']}>
        <Routes>
          <Route element={<Outlet context={{ clubId: 'club-1' }} />}>
            <Route path="/manage/team-selection" element={<TeamSelectionHubLayout />}>
              <Route path="slots" element={<SlotsView />} />
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
})

const card = (match: string, team = 'team-1') => screen.getByTestId(`slot-card-${match}-${team}`)

describe('SlotsView', () => {
  it('shows a block per day and slot, in date order, with a card per match side', async () => {
    renderView()
    await screen.findByTestId('slot-card-m-1-team-1')
    const blocks = screen.getAllByRole('region').filter((region) => /^(Sat|Sun) /.test(region.getAttribute('aria-label') ?? ''))
    expect(blocks.map((block) => block.getAttribute('aria-label'))).toEqual(['Sat 17 Oct Morning', 'Sun 18 Oct Afternoon'])
    expect(within(blocks[0]).getAllByTestId(/slot-card-/)).toHaveLength(2)
    expect(within(blocks[1]).getAllByTestId(/slot-card-/)).toHaveLength(2)
  })

  it('lists the picks in batting order with C and WK markers and the 12th man labelled', async () => {
    renderView()
    await screen.findByTestId('slot-card-m-1-team-1')
    const items = within(card('m-1')).getAllByTestId('slot-pick')
    expect(items.map((item) => item.textContent)).toEqual(['1Ann SmithC', '2Bob SmithWK', 'Cy Smith12th man', 'Dee Smith'])
  })

  it('shows the gauge, says nobody is picked for an empty side and links to the Select team page', async () => {
    renderView()
    await screen.findByTestId('slot-card-m-1-team-1')
    expect(within(card('m-1')).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '4')
    expect(within(card('m-2', 'team-2')).getByText('Nobody picked yet.')).toBeInTheDocument()
    expect(within(card('m-1')).getByRole('link', { name: 'Select players' })).toHaveAttribute('href', '/manage/team-selection/matches/m-1/sides/side-1')
    expect(within(card('m-2', 'team-2')).getByRole('link', { name: 'Select players' })).toHaveAttribute('href', '/manage/team-selection/matches/m-2/sides/home')
  })

  it('shows the announced chip only on an announced side and one card per side of a derby', async () => {
    renderView()
    await screen.findByTestId('slot-card-m-3-team-a')
    expect(within(card('m-3', 'team-b')).getByText('Announced')).toBeInTheDocument()
    expect(within(card('m-3', 'team-a')).queryByText('Announced')).not.toBeInTheDocument()
    expect(within(card('m-3', 'team-b')).getByRole('link', { name: 'Select players' })).toHaveAttribute('href', '/manage/team-selection/matches/m-3/sides/s-b')
  })

  it('sends the hub filters and Show past, and filters by the search text', async () => {
    renderView()
    await screen.findByTestId('slot-card-m-1-team-1')
    expect(lastParams()).toEqual({ seasonId: 's-now' })
    await userEvent.click(screen.getByRole('checkbox', { name: /view entire season/i }))
    await waitFor(() => expect(lastParams()).toEqual({ seasonId: 's-now', includePast: true }))
    await userEvent.type(screen.getByPlaceholderText('Search by team or opponent'), 'hillside')
    expect(screen.queryByTestId('slot-card-m-1-team-1')).not.toBeInTheDocument()
    expect(screen.getByTestId('slot-card-m-2-team-2')).toBeInTheDocument()
  })

  it('tells the manager when the list was cut short and when there are no matches', async () => {
    get.mockResolvedValue({ data: { ...sampleBoard(), truncated: true } })
    const { unmount } = renderView()
    expect(await screen.findByText(/Only the first matches are shown/)).toBeInTheDocument()
    unmount()
    get.mockResolvedValue({ data: makeOverview([]) })
    renderView()
    expect(await screen.findByText('No upcoming matches')).toBeInTheDocument()
  })
})
