import { render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ManagerOverviewPage from './ManagerOverviewPage'
import type { ManagerOverview, OverviewMatch } from '../../api/overviewApi'

const getManagerOverview = vi.fn()

function stubViewport(width: number) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => {
      const min = /min-width:\s*([\d.]+)px/.exec(query)
      const matches = min ? width >= Number(min[1]) : true
      return { matches, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn() }
    }),
  )
}
afterEach(() => vi.unstubAllGlobals())
vi.mock('../../api/overviewApi', () => ({ getManagerOverview: (clubId: string) => getManagerOverview(clubId) }))
vi.mock('../../auth/keycloak', () => ({ keycloak: { tokenParsed: { name: 'Riya Naidu' } } }))

function overview(overrides: Partial<ManagerOverview> = {}): ManagerOverview {
  return {
    matchesThisWeek: 3,
    teamsNotAnnounced: 1,
    pollAnswersAwaited: 22,
    activePlayers: 84,
    upcomingMatches: [],
    openPolls: [],
    recentResults: [],
    quickActions: { createMatch: true, createPoll: true, addPlayer: true, messageSquad: true },
    ...overrides,
  }
}

function match(overrides: Partial<OverviewMatch> = {}): OverviewMatch {
  return {
    matchId: 'm1',
    matchDate: '2026-10-10T11:00:00Z',
    venue: 'Riverside Oval',
    homeTeamId: 't1',
    homeTeamName: 'Villagers 1',
    awayTeamId: null,
    awayTeamName: 'Northside CC',
    sectionId: null,
    ownSides: [{ teamId: 't1', teamName: 'Villagers 1', selectedCount: 9, maxSelected: 12, announced: false }],
    ...overrides,
  }
}

function renderPage(clubId: string | null = 'club-1') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Routes>
          <Route element={<OutletProvider clubId={clubId ?? undefined} />}>
            <Route path="/" element={<ManagerOverviewPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function OutletProvider({ clubId }: { clubId?: string }) {
  return <Outlet context={{ clubId }} />
}

describe('ManagerOverviewPage', () => {
  beforeEach(() => getManagerOverview.mockReset())

  it('greets by first name and shows the key figures, scoped by plurals', async () => {
    getManagerOverview.mockResolvedValue(overview({ matchesThisWeek: 1, teamsNotAnnounced: 1 }))
    renderPage()

    expect(await screen.findByRole('heading', { level: 1, name: /, Riya$/ })).toBeInTheDocument()
    expect(getManagerOverview).toHaveBeenCalledWith('club-1')
    expect(screen.getByText('match this week')).toBeInTheDocument()
    expect(screen.getByText('team not announced')).toBeInTheDocument()
    expect(screen.getByText('poll answers awaited')).toBeInTheDocument()
    expect(screen.getByText('84')).toBeInTheDocument()
  })

  it('uses the warning colour for "not announced" only when above zero', async () => {
    getManagerOverview.mockResolvedValue(overview({ teamsNotAnnounced: 2 }))
    const { unmount } = renderPage()
    const warn = (await screen.findByText('teams not announced')).previousElementSibling as HTMLElement
    const calm = screen.getByText('matches this week').previousElementSibling as HTMLElement
    expect(getComputedStyle(warn).color).not.toBe(getComputedStyle(calm).color)
    unmount()

    getManagerOverview.mockResolvedValue(overview({ teamsNotAnnounced: 0 }))
    renderPage()
    const zero = (await screen.findByText('teams not announced')).previousElementSibling as HTMLElement
    const other = screen.getByText('matches this week').previousElementSibling as HTMLElement
    expect(getComputedStyle(zero).color).toBe(getComputedStyle(other).color)
  })

  it('lists upcoming matches with selection status and a link to the own side selection', async () => {
    getManagerOverview.mockResolvedValue(
      overview({
        upcomingMatches: [
          match(),
          match({
            matchId: 'm2',
            homeTeamId: null,
            homeTeamName: 'Hilltop CC',
            awayTeamId: 't2',
            awayTeamName: 'U14',
            ownSides: [{ teamId: 't2', teamName: 'U14', selectedCount: 11, maxSelected: 11, announced: true }],
          }),
          match({ matchId: 'm3', ownSides: [], venue: null }),
        ],
      }),
    )
    renderPage()

    const first = (await screen.findAllByText('Villagers 1 v Northside CC'))[0].closest('a')!
    expect(first).toHaveAttribute('href', '/manage/fixtures/matches/m1/edit?tab=home-xi')
    expect(within(first).getByText('9 of 12 selected')).toBeInTheDocument()
    expect(within(first).getByText('Pick team')).toBeInTheDocument()

    const second = screen.getByText('Hilltop CC v U14').closest('a')!
    expect(second).toHaveAttribute('href', '/manage/fixtures/matches/m2/edit?tab=away-xi')
    expect(within(second).getByText('Announced')).toBeInTheDocument()

    const third = screen.getAllByText('Villagers 1 v Northside CC')[1].closest('a')!
    expect(third).toHaveAttribute('href', '/manage/fixtures/matches/m3')
    expect(within(third).queryByText(/selected/)).not.toBeInTheDocument()
  })

  it('shows open polls with progress and links per kind', async () => {
    getManagerOverview.mockResolvedValue(
      overview({
        openPolls: [
          { kind: 'SQUAD', id: 'p1', matchId: 'm1', title: 'U14 week 41', repliedCount: 8, totalCount: 14, scheduledCloseAt: null },
          { kind: 'GROUP', id: 'g1', matchId: null, title: 'Senior week 41', repliedCount: 11, totalCount: 16, scheduledCloseAt: '2026-10-09T10:00:00Z' },
        ],
      }),
    )
    renderPage()

    const squad = (await screen.findByText('U14 week 41')).closest('a')!
    expect(squad).toHaveAttribute('href', '/manage/availability/squad/m1/p1')
    expect(within(squad).getByText(/8 of 14 replied · no close date/)).toBeInTheDocument()
    expect(within(squad).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '8')
    const group = screen.getByText('Senior week 41').closest('a')!
    expect(group).toHaveAttribute('href', '/manage/availability/group/g1')
    expect(within(group).getByText(/11 of 16 replied · closes/)).toBeInTheDocument()
  })

  it('shows "No results yet" while the list is empty and rows when it is not', async () => {
    getManagerOverview.mockResolvedValue(overview())
    const { unmount } = renderPage()
    expect(await screen.findByText('No results yet')).toBeInTheDocument()
    unmount()

    getManagerOverview.mockResolvedValue(overview({ recentResults: [{ matchId: 'm9', summary: 'Won by 24 runs' }] }))
    renderPage()
    expect(await screen.findByText('Won by 24 runs')).toHaveAttribute('href', '/manage/fixtures/matches/m9')
    expect(screen.queryByText('No results yet')).not.toBeInTheDocument()
  })

  it('shows designed empty states with the next action for a brand-new club', async () => {
    getManagerOverview.mockResolvedValue(overview({ matchesThisWeek: 0, teamsNotAnnounced: 0, pollAnswersAwaited: 0, activePlayers: 0 }))
    renderPage()

    expect(await screen.findByText('No matches coming up')).toBeInTheDocument()
    expect(screen.getByText('Nothing waiting on an answer')).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Create match' })).toHaveLength(1)
    expect(screen.getAllByRole('link', { name: 'Create availability poll' })).toHaveLength(1)
  })

  it('renders each quick action in the Actions menu only when its flag is true', async () => {
    stubViewport(1200)
    const user = userEvent.setup()
    getManagerOverview.mockResolvedValue(overview({ upcomingMatches: [match()] }))
    const { unmount } = renderPage()
    await user.click(await screen.findByRole('button', { name: 'Actions' }))
    expect(screen.getByRole('menuitem', { name: 'Create match' })).toHaveAttribute('href', '/manage/fixtures/matches/new')
    expect(screen.getByRole('menuitem', { name: 'Create availability poll' })).toHaveAttribute('href', '/manage/availability/new')
    expect(screen.getByRole('menuitem', { name: 'Add player' })).toHaveAttribute('href', '/manage/players/new')
    expect(screen.getByRole('menuitem', { name: 'Message the squad' })).toHaveAttribute('href', '/manage/communication')
    unmount()

    getManagerOverview.mockResolvedValue(
      overview({ upcomingMatches: [match()], quickActions: { createMatch: false, createPoll: false, addPlayer: true, messageSquad: false } }),
    )
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Actions' }))
    expect(screen.getAllByRole('menuitem')).toHaveLength(1)
    expect(screen.getByRole('menuitem', { name: 'Add player' })).toBeInTheDocument()
  })

  it('has no old action buttons and hides the control when no action is allowed', async () => {
    stubViewport(1200)
    getManagerOverview.mockResolvedValue(
      overview({ upcomingMatches: [match()], quickActions: { createMatch: false, createPoll: false, addPlayer: false, messageSquad: false } }),
    )
    renderPage()
    await screen.findByText('Villagers 1 v Northside CC')
    expect(screen.queryByRole('button', { name: 'Actions' })).not.toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Quick actions' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Add player' })).not.toBeInTheDocument()
  })

  it('on a phone shows the speed dial instead of the Actions button', async () => {
    stubViewport(375)
    getManagerOverview.mockResolvedValue(overview({ upcomingMatches: [match()] }))
    renderPage()
    expect(await screen.findByRole('button', { name: 'Quick actions' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Actions' })).not.toBeInTheDocument()
  })

  it('shows a loading indicator, then an error with retry', async () => {
    getManagerOverview.mockReturnValueOnce(new Promise(() => {}))
    const { unmount } = renderPage()
    expect(screen.getByLabelText('Loading overview')).toBeInTheDocument()
    unmount()

    getManagerOverview.mockRejectedValueOnce(new Error('boom'))
    renderPage()
    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't load your overview")
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('does not call the API without a club', () => {
    renderPage(null)
    expect(getManagerOverview).not.toHaveBeenCalled()
    expect(screen.getByText('No club is associated with your account.')).toBeInTheDocument()
  })
})
