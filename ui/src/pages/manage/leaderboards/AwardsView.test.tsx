import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AwardsView } from './AwardsView'
import { AWARD_BOARDS, defaultServer, leaderboardApi, makeAwards } from '../../../test/leaderboardFixtures'
import type { LeaderboardServer } from '../../../test/leaderboardFixtures'

// docs/specs/103-player-stats.md (Awards view, decisions 10, 11, 18): leaders and joint winners, the two minimums pre-filled with the
// server defaults and Reset to default, the omitted-category note, Choose categories. On screen only.
let server: LeaderboardServer
const apiGet = vi.fn()
vi.mock('../../../api/axiosConfig', () => ({
  default: { get: (...args: unknown[]) => apiGet(...args), put: vi.fn() },
}))

const leader = (id: string, first: string, last: string, figure: number, over: Record<string, unknown> = {}) => ({
  rank: 1, playerId: id, firstName: first, lastName: last, active: true, figure, matches: 10, innings: 8, sample: null, smallSample: false, detail: null, ...over,
})

function renderView(props: Partial<React.ComponentProps<typeof AwardsView>> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AwardsView
          clubId="club-1"
          filters={{ seasonId: 'season-1' }}
          hasFilters
          onClearFilters={vi.fn()}
          catalogue={AWARD_BOARDS}
          titleText="Irene Villagers, 2026/27 season"
          scopeText="Under 15 section"
          enabled
          {...props}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const wait = { timeout: 5000 }
const awardCalls = () => apiGet.mock.calls.filter(([url]) => (url as string).endsWith('/awards')).map(([, config]) => (config?.params ?? {}) as Record<string, unknown>)
const lastAwards = () => awardCalls()[awardCalls().length - 1]

describe('AwardsView', () => {
  beforeEach(() => {
    localStorage.clear()
    server = defaultServer()
    apiGet.mockReset()
    apiGet.mockImplementation((url: string, config?: unknown) => leaderboardApi(server).get(url, config as never))
  })

  it('names the scope and how many players were considered', async () => {
    renderView()
    expect(screen.getByTestId('awards-title')).toHaveTextContent('Irene Villagers, 2026/27 season')
    expect(await screen.findByText('Under 15 section · 21 players', {}, wait)).toBeInTheDocument()
  })

  it('sends the filters, and no minimum so the server applies its filter-aware defaults', async () => {
    renderView()
    await screen.findByTestId('award-MOST_RUNS', {}, wait)
    expect(lastAwards()).toEqual({ seasonId: 'season-1' })
  })

  it('shows one card per category with the winner, the figure and what stands behind it', async () => {
    renderView()
    const card = await screen.findByTestId('award-MOST_RUNS', {}, wait)
    expect(within(card).getByText('Most runs')).toBeInTheDocument()
    expect(within(card).getByText('Sam Visser')).toBeInTheDocument()
    expect(within(card).getByText('412 runs · 8 innings')).toBeInTheDocument()
  })

  it('shows joint winners together in one card', async () => {
    server.awards = () =>
      makeAwards({ categories: [{ board: AWARD_BOARDS[0], leaders: [leader('p1', 'Sam', 'Visser', 412), leader('p2', 'Thabo', 'Mokoena', 412)] }] })
    renderView()
    const card = await screen.findByTestId('award-MOST_RUNS', {}, wait)
    expect(card).toHaveTextContent('Sam Visser, Thabo Mokoena')
    expect(within(card).getByText('Joint winners · 412')).toBeInTheDocument()
  })

  it('formats a rate winner with its sample', async () => {
    server.awards = () =>
      makeAwards({
        categories: [
          {
            board: AWARD_BOARDS[1],
            leaders: [leader('p1', 'Sam', 'Visser', 41.5, { sample: { innings: 6, ballsFaced: 90, balls: null, overs: null, ballsPerOver: null, wickets: null } })],
          },
        ],
      })
    renderView()
    expect(await screen.findByText('41.50 · 6 innings, 90 balls', {}, wait)).toBeInTheDocument()
  })

  it('pre-fills the minimums with the values the server used and states the defaults', async () => {
    server.awards = () => makeAwards({ minimums: { innings: 3, overs: 8, defaultInnings: 3, defaultOvers: 8 } })
    renderView()
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Minimum innings' })).toHaveValue('3'), wait)
    expect(screen.getByRole('textbox', { name: 'Minimum overs' })).toHaveValue('8')
    expect(screen.getByTestId('awards-default-hint')).toHaveTextContent('Default 3 and 8 for these filters. Applies to Batting average and Economy rate.')
    expect(screen.getByRole('button', { name: 'Reset to default' })).toBeDisabled()
  })

  it('a changed minimum is sent after a debounce, and Reset to default goes back to the server defaults', async () => {
    renderView()
    const innings = await screen.findByRole('textbox', { name: 'Minimum innings' }, wait)
    await waitFor(() => expect(innings).toHaveValue('3'))
    // the field selects its text on focus, so typing replaces the pre-filled default
    await userEvent.type(innings, '5')
    await waitFor(() => expect(lastAwards()).toMatchObject({ minimumInnings: 5 }), { timeout: 3000 })
    expect(lastAwards()).not.toHaveProperty('minimumOvers')

    const reset = screen.getByRole('button', { name: 'Reset to default' })
    expect(reset).toBeEnabled()
    await userEvent.click(reset)
    await waitFor(() => expect(lastAwards()).toEqual({ seasonId: 'season-1' }), { timeout: 3000 })
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Minimum innings' })).toHaveValue('3'))
    expect(screen.getByRole('button', { name: 'Reset to default' })).toBeDisabled()
  })

  it('names a category nobody qualified for in a quiet note with the server reason', async () => {
    server.awards = () =>
      makeAwards({ omitted: [{ board: AWARD_BOARDS[2], reason: 'No bowler reached the minimum overs' }] })
    renderView()
    const note = await screen.findByTestId('award-none-ECONOMY_RATE', {}, wait)
    expect(note).toHaveTextContent('Economy rate')
    expect(note).toHaveTextContent('No bowler reached the minimum overs')
    // the others still show their winners
    expect(screen.getByTestId('award-MOST_RUNS')).toBeInTheDocument()
  })

  it('treats a category that came back with no leaders as omitted too', async () => {
    server.awards = () => makeAwards({ categories: [{ board: AWARD_BOARDS[0], leaders: [] }] })
    renderView()
    expect(await screen.findByTestId('award-none-MOST_RUNS', {}, wait)).toHaveTextContent('Nobody qualified for this category.')
  })

  it('no published results: says so, offering Clear filters only when a filter is set', async () => {
    server.awards = () => makeAwards({ basis: { resultsCounted: 0, playersConsidered: 0 }, categories: [] })
    const onClearFilters = vi.fn()
    const { unmount } = renderView({ onClearFilters })
    expect(await screen.findByText('No published results match these filters', {}, wait)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(onClearFilters).toHaveBeenCalled()
    unmount()
    renderView({ hasFilters: false })
    expect(await screen.findByText('No published results match these filters', {}, wait)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument()
  })

  it('no categories chosen: points at Choose categories', async () => {
    server.awards = () => makeAwards({ categories: [], omitted: [] })
    renderView()
    expect(await screen.findByText('No categories to show', {}, wait)).toBeInTheDocument()
  })

  it('a failed read shows a retry', async () => {
    server.awards = () => new Error('boom')
    renderView()
    expect(await screen.findByText('Could not load the awards', {}, wait)).toBeInTheDocument()
    server.awards = () => makeAwards()
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByTestId('award-MOST_RUNS', {}, wait)).toBeInTheDocument()
  })

  it('waits for the page to be ready before reading', async () => {
    renderView({ enabled: false })
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(awardCalls()).toHaveLength(0)
  })

  it('offers Choose categories', async () => {
    renderView()
    expect(await screen.findByRole('button', { name: 'Choose categories' }, wait)).toBeInTheDocument()
  })
})
