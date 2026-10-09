import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes, useLocation, useOutletContext } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AvailabilityHubLayout from './AvailabilityHubLayout'
import PlayerAvailabilityRedirect from './PlayerAvailabilityRedirect'
import SectionAvailabilityRedirect from '../SectionAvailabilityRedirect'
import type { AvailabilitySummary } from '../../../api/availabilitySummaryApi'
import type { Season } from '../../../api/seasonApi'
import type { AvailabilityHubContext } from './hubContext'

vi.mock('../../../api/leagueApi', () => ({
  listLeagues: () => Promise.resolve([{ id: 'lg-1', name: 'Over 40 League' }]),
}))
const listTeamsForClub = vi.fn()
vi.mock('../../../api/teamApi', () => ({
  listTeamsForClub: (...args: unknown[]) => listTeamsForClub(...args),
}))
vi.mock('../../../api/sectionApi', () => ({
  listSections: () =>
    Promise.resolve([
      { id: 'sec-1', name: 'Over 40', parentSectionId: 'sec-0' },
      { id: 'sec-0', name: 'Vets', parentSectionId: null },
    ]),
}))

const listSeasons = vi.fn()
vi.mock('../../../api/seasonApi', () => ({ listSeasons: (...args: unknown[]) => listSeasons(...args) }))

function season(id: string, label: string, startDate: string, endDate: string): Season {
  return { id, clubId: 'club-1', label, startDate, endDate, active: true, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', updatedBy: null }
}
const SEASONS = [season('s-old', '2025', '2025-01-01', '2025-12-31'), season('s-now', '2026', '2026-01-01', '2026-12-31')]

const getAvailabilitySummary = vi.fn()
const listAvailabilitySummaryPlayers = vi.fn()
vi.mock('../../../api/availabilitySummaryApi', async () => {
  const actual = await vi.importActual<typeof import('../../../api/availabilitySummaryApi')>('../../../api/availabilitySummaryApi')
  return {
    ...actual,
    getAvailabilitySummary: (...args: unknown[]) => getAvailabilitySummary(...args),
    listAvailabilitySummaryPlayers: (...args: unknown[]) => listAvailabilitySummaryPlayers(...args),
  }
})

const summary: AvailabilitySummary = { openPolls: 3, playersResponded: 12, playersInAudience: 20, playersStillToAnswer: 8.5, closingSoon: 0 }

beforeEach(() => {
  getAvailabilitySummary.mockReset()
  getAvailabilitySummary.mockResolvedValue(summary)
  listAvailabilitySummaryPlayers.mockReset()
  listAvailabilitySummaryPlayers.mockResolvedValue({
    content: [{ playerProfileId: 'pl-1', displayName: 'Ann Lee', polls: [{ kind: 'SQUAD', id: 'p1', matchId: 'm1', title: 'Lions vs Rivals' }] }],
    totalElements: 1, totalPages: 1, number: 0, size: 25, last: true,
  })
  listTeamsForClub.mockReset()
  listTeamsForClub.mockResolvedValue([{ id: 'tm-1', name: 'Lions' }])
  listSeasons.mockReset()
  listSeasons.mockResolvedValue(SEASONS)
  localStorage.clear()
})

function View({ name }: { name: string }) {
  const { clubId, filters, setFilters, seasonId, showGroup, setShowGroup, showClosed, setShowClosed, setJumpToToday, setPollRows } =
    useOutletContext<AvailabilityHubContext>()
  const { pathname, search } = useLocation()
  return (
    <div>
      <div>{`${name} view for ${clubId} at ${pathname}${search}`}</div>
      <div data-testid="ctx">{`section=${filters.sectionId ?? 'none'} season=${seasonId ?? 'none'}`}</div>
      <button type="button" onClick={() => setFilters({ sectionId: 'sec-1' })}>
        pick section
      </button>
      <button type="button" onClick={() => setFilters({ leagueId: 'lg-1', teamId: 'tm-1' })}>
        pick league and team
      </button>
      <button type="button" onClick={() => setShowGroup(!showGroup)}>
        toggle group
      </button>
      <button type="button" onClick={() => setShowClosed(!showClosed)}>
        toggle closed
      </button>
      <button type="button" onClick={() => setJumpToToday({ disabled: false, onClick: () => window.dispatchEvent(new Event('jumped')) })}>
        register jump
      </button>
      <button
        type="button"
        onClick={() =>
          setPollRows([
            { key: 'g1', kind: 'GROUP', title: 'Thursday fixtures', open: true, autoClose: true, scheduledCloseAt: new Date(Date.now() + 30 * 3_600_000).toISOString(), answered: 15, total: 18, path: '/manage/availability/group/g1' },
            { key: 's1', kind: 'SQUAD', title: 'Lions vs Rivals', open: true, autoClose: true, scheduledCloseAt: new Date(Date.now() + 100 * 3_600_000).toISOString(), answered: 3, total: 11, path: '/manage/availability/squad/m1/s1' },
            { key: 's2', kind: 'SQUAD', title: 'Lions vs Old', open: false, autoClose: true, scheduledCloseAt: new Date(Date.now() - 24 * 3_600_000).toISOString(), answered: 9, total: 11, path: '/manage/availability/squad/m2/s2' },
          ])
        }
      >
        register polls
      </button>
      <button type="button" onClick={() => setJumpToToday(null)}>
        clear jump
      </button>
    </div>
  )
}

function Page({ name }: { name: string }) {
  const { pathname } = useLocation()
  return <div>{`${name} page at ${pathname}`}</div>
}

// Mirrors the route table in App.tsx (docs/specs/073 section 1) under a ManagerHome-like Outlet context.
function renderAt(path: string, clubId: string | null = 'club-1') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/manage" element={<Outlet context={{ clubId: clubId ?? undefined }} />}>
          <Route path="availability" element={<AvailabilityHubLayout />}>
            <Route index element={<View name="Polls" />} />
            <Route path="players" element={<View name="Players" />} />
            <Route path="coverage" element={<View name="Coverage" />} />
          </Route>
          <Route path="availability/new" element={<Page name="New poll" />} />
          <Route path="availability/group/:roundId" element={<Page name="Group responses" />} />
          <Route path="availability/squad/:matchId/:pollId" element={<Page name="Squad responses" />} />
          <Route path="player-availability" element={<PlayerAvailabilityRedirect />} />
          <Route path="section-availability" element={<SectionAvailabilityRedirect />} />
        </Route>
      </Routes>
    </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('AvailabilityHubLayout (docs/specs/073)', () => {
  it('titles the page Availability with no back link (079) and a switch of exactly Polls, Players and Match-day cover links', () => {
    renderAt('/manage/availability')

    expect(screen.getByRole('heading', { level: 1, name: 'Availability' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /back/i })).not.toBeInTheDocument()
    const nav = screen.getByRole('navigation', { name: 'Availability views' })
    const links = nav.querySelectorAll('a')
    expect(Array.from(links).map((link) => link.textContent)).toEqual(['Polls', 'Players', 'Match-day cover'])
    expect(screen.getByRole('link', { name: 'Polls' })).toHaveAttribute('href', '/manage/availability')
    expect(screen.getByRole('link', { name: 'Players' })).toHaveAttribute('href', '/manage/availability/players')
    expect(screen.getByRole('link', { name: 'Match-day cover' })).toHaveAttribute('href', '/manage/availability/coverage')
  })

  it('renders the Jump to today action a view registers in the header slot of Players, replacing the placeholder (085)', async () => {
    const user = userEvent.setup()
    const jumped = vi.fn()
    window.addEventListener('jumped', jumped)
    renderAt('/manage/availability/players')

    expect(screen.queryByRole('button', { name: 'Jump to today' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'register jump' }))
    await user.click(screen.getByRole('button', { name: 'Jump to today' }))
    expect(jumped).toHaveBeenCalledTimes(1)
    // The placeholder New poll is gone while the real button shows.
    expect(screen.queryByRole('button', { name: 'New poll', hidden: true })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'clear jump' }))
    expect(screen.queryByRole('button', { name: 'Jump to today' })).not.toBeInTheDocument()
    window.removeEventListener('jumped', jumped)
  })

  it('spaces the header, counters, toolbar and content 12 px apart on every view (085 I)', () => {
    for (const path of ['/manage/availability', '/manage/availability/players', '/manage/availability/coverage']) {
      const { container, unmount } = renderAt(path)
      expect(getComputedStyle(container.firstElementChild as HTMLElement).gap).toBe('12px')
      unmount()
    }
  })

  it('names the view in the browser tab title and restores it on unmount (085)', () => {
    document.title = 'Cricket Legend'
    for (const [path, title] of [
      ['/manage/availability', 'Polls · Availability'],
      ['/manage/availability/players', 'Players · Availability'],
      ['/manage/availability/coverage', 'Match-day cover · Availability'],
    ]) {
      const { unmount } = renderAt(path)
      expect(document.title).toBe(title)
      unmount()
    }
    expect(document.title).toBe('Cricket Legend')
  })

  it('marks Polls as the current view on /manage/availability, with or without a trailing slash and ?showClosed=true', () => {
    for (const path of ['/manage/availability', '/manage/availability/', '/manage/availability?showClosed=true']) {
      const { unmount } = renderAt(path)
      expect(screen.getByRole('link', { name: 'Polls' })).toHaveAttribute('aria-current', 'page')
      expect(screen.getByRole('link', { name: 'Polls' })).toHaveClass('Mui-selected')
      expect(screen.getByRole('link', { name: 'Players' })).not.toHaveAttribute('aria-current')
      expect(screen.getByText(/^Polls view for club-1/)).toBeInTheDocument()
      unmount()
    }
  })

  it('marks Players as current on /manage/availability/players and renders the Players view', () => {
    renderAt('/manage/availability/players')

    expect(screen.getByRole('link', { name: 'Players' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Players' })).toHaveClass('Mui-selected')
    expect(screen.getByRole('link', { name: 'Polls' })).not.toHaveAttribute('aria-current')
    expect(screen.getByText('Players view for club-1 at /manage/availability/players')).toBeInTheDocument()
  })

  it('marks Match-day cover as current on /manage/availability/coverage (with or without a trailing slash) and renders the Coverage view', () => {
    for (const path of ['/manage/availability/coverage', '/manage/availability/coverage/']) {
      const { unmount } = renderAt(path)
      expect(screen.getByRole('link', { name: 'Match-day cover' })).toHaveAttribute('aria-current', 'page')
      expect(screen.getByRole('link', { name: 'Match-day cover' })).toHaveClass('Mui-selected')
      expect(screen.getByRole('link', { name: 'Polls' })).not.toHaveAttribute('aria-current')
      expect(screen.getByRole('link', { name: 'Players' })).not.toHaveAttribute('aria-current')
      expect(screen.getByText(/^Coverage view for club-1 at \/manage\/availability\/coverage/)).toBeInTheDocument()
      unmount()
    }
  })

  it('has three switch links and hides New poll on Coverage', () => {
    renderAt('/manage/availability/coverage')

    const links = screen.getByRole('navigation', { name: 'Availability views' }).querySelectorAll('a')
    expect(links).toHaveLength(3)
    expect(screen.queryByRole('button', { name: 'New poll' })).not.toBeInTheDocument()
  })

  it('switching is real navigation without a query string, in both directions', async () => {
    const user = userEvent.setup()
    renderAt('/manage/availability?showClosed=true')

    await user.click(screen.getByRole('link', { name: 'Players' }))
    expect(screen.getByText('Players view for club-1 at /manage/availability/players')).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: 'Match-day cover' }))
    expect(screen.getByText('Coverage view for club-1 at /manage/availability/coverage')).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: 'Polls' }))
    expect(screen.getByText('Polls view for club-1 at /manage/availability')).toBeInTheDocument()
  })

  it('shows New poll only on Polls, and it opens the New poll page', async () => {
    const user = userEvent.setup()
    renderAt('/manage/availability/players')
    expect(screen.queryByRole('button', { name: 'New poll' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: 'Polls' }))
    await user.click(screen.getByRole('button', { name: 'New poll' }))

    expect(screen.getByText('New poll page at /manage/availability/new')).toBeInTheDocument()
  })

  it('renders Not authorized and no switch without a club', () => {
    renderAt('/manage/availability', null)

    expect(screen.getByText('Not authorized')).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Availability views' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument()
  })

  // docs/specs/083: no season control on any view; every view (Polls included, which scopes its lists by it) gets the default season.
  it('has no season control on any view, and hands every view the default season', async () => {
    for (const path of ['/manage/availability', '/manage/availability/players', '/manage/availability/coverage']) {
      const view = renderAt(path)
      expect(screen.queryByRole('button', { name: /season/i })).not.toBeInTheDocument()
      await waitFor(() => expect(screen.getByTestId('ctx')).toHaveTextContent('season=s-now'))
      view.unmount()
    }
  })

  it('keeps the shared filters when switching views and carries them in the address', async () => {
    const user = userEvent.setup()
    renderAt('/manage/availability')

    await user.click(screen.getByRole('button', { name: 'pick section' }))
    expect(screen.getByTestId('ctx')).toHaveTextContent('section=sec-1')

    await user.click(screen.getByRole('link', { name: 'Players' }))
    expect(screen.getByTestId('ctx')).toHaveTextContent('section=sec-1')
    await waitFor(() => expect(screen.getByText(/^Players view for club-1 at \/manage\/availability\/players\?section=sec-1/)).toBeInTheDocument())

    await user.click(screen.getByRole('link', { name: 'Polls' }))
    expect(screen.getByTestId('ctx')).toHaveTextContent('section=sec-1')
  })

  it('forwards clubId to both views through its Outlet context', () => {
    const { unmount } = renderAt('/manage/availability')
    expect(screen.getByText(/^Polls view for club-1/)).toBeInTheDocument()
    unmount()
    renderAt('/manage/availability/players')
    expect(screen.getByText(/^Players view for club-1/)).toBeInTheDocument()
  })
})

describe('Availability routes (docs/specs/073 section 1)', () => {
  it('the sub-flow routes resolve to their own pages with no switch', () => {
    for (const [path, text] of [
      ['/manage/availability/new', 'New poll page at /manage/availability/new'],
      ['/manage/availability/group/r1', 'Group responses page at /manage/availability/group/r1'],
      ['/manage/availability/squad/m1/p1', 'Squad responses page at /manage/availability/squad/m1/p1'],
    ]) {
      const { unmount } = renderAt(path)
      expect(screen.getByText(text)).toBeInTheDocument()
      expect(screen.queryByRole('navigation', { name: 'Availability views' })).not.toBeInTheDocument()
      unmount()
    }
  })

  it('/manage/player-availability?x=1 replaces itself with /manage/availability/players?x=1 under the hub', () => {
    renderAt('/manage/player-availability?x=1')

    expect(screen.getByText('Players view for club-1 at /manage/availability/players?x=1')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Players' })).toHaveAttribute('aria-current', 'page')
  })

  it('/manage/section-availability still redirects to the New poll group branch', () => {
    renderAt('/manage/section-availability?sectionId=s1')

    expect(screen.getByText('New poll page at /manage/availability/new')).toBeInTheDocument()
  })
})

describe('AvailabilityHubLayout counters (docs/specs/081)', () => {
  const values = () => screen.getAllByTestId('page-counter-value').map((node) => node.textContent)

  it('shows the four counters on Polls with Open polls as a drill-down and the N / M responded text', async () => {
    renderAt('/manage/availability')

    await waitFor(() => expect(values()).toEqual(['3', '12 / 20', '8.5', '0']))
    expect(getAvailabilitySummary).toHaveBeenCalledWith('club-1', {
      leagueId: null, sectionId: null, teamId: null, type: 'ALL', includeClosed: false,
    })
    for (const label of ['Open polls', 'Players responded', 'Players still to answer', 'Close in 48 hours']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
    expect(screen.getByTestId('page-counter-open-polls-marker')).toHaveTextContent('›')
    expect(screen.getByTestId('page-counter-players-responded')).not.toHaveAttribute('data-active')
  })

  it('uses the warning tone only for awaited and closing counters above zero', async () => {
    getAvailabilitySummary.mockResolvedValue({ ...summary, playersStillToAnswer: 5, closingSoon: 2 })
    renderAt('/manage/availability')

    await waitFor(() => expect(values()).toEqual(['3', '12 / 20', '5', '2']))
    const colour = (id: string) => getComputedStyle(screen.getByTestId(`page-counter-${id}`).querySelector('b') as HTMLElement).color
    expect(colour('players-still-to-answer')).toBe(colour('closing-soon'))
    expect(colour('players-still-to-answer')).not.toBe(colour('open-polls'))
  })

  it('keeps the neutral tone at zero', async () => {
    getAvailabilitySummary.mockResolvedValue({ ...summary, playersStillToAnswer: 0, closingSoon: 0 })
    renderAt('/manage/availability')

    await waitFor(() => expect(values()).toHaveLength(4))
    const colour = (id: string) => getComputedStyle(screen.getByTestId(`page-counter-${id}`).querySelector('b') as HTMLElement).color
    expect(colour('players-still-to-answer')).toBe(colour('open-polls'))
    expect(colour('closing-soon')).toBe(colour('open-polls'))
  })

  it('shows the loading skeleton while the request is pending', async () => {
    getAvailabilitySummary.mockReturnValue(new Promise(() => undefined))
    renderAt('/manage/availability')

    expect(await screen.findByTestId('page-counters-loading')).toBeInTheDocument()
    expect(screen.queryByTestId('page-counter-value')).not.toBeInTheDocument()
  })

  it('hides the row entirely when the request fails, and the view still renders', async () => {
    getAvailabilitySummary.mockRejectedValue(new Error('boom'))
    renderAt('/manage/availability')

    await waitFor(() => expect(getAvailabilitySummary).toHaveBeenCalled())
    await waitFor(() => expect(screen.queryByTestId('page-counters-loading')).not.toBeInTheDocument())
    expect(screen.queryByText('Open polls')).not.toBeInTheDocument()
    expect(screen.getByText(/^Polls view for club-1/)).toBeInTheDocument()
  })

  it('refetches with the section filter and shows it in the scope line', async () => {
    const user = userEvent.setup()
    renderAt('/manage/availability')
    await waitFor(() => expect(values()).toHaveLength(4))
    expect(screen.queryByTestId('header-subtitle')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'pick section' }))

    await waitFor(() =>
      expect(getAvailabilitySummary).toHaveBeenLastCalledWith('club-1', expect.objectContaining({ sectionId: 'sec-1' })),
    )
    expect(await screen.findByTestId('header-subtitle')).toHaveTextContent('Showing: Vets › Over 40')
  })

  it('follows the league and team filters and names them in the scope line', async () => {
    const user = userEvent.setup()
    renderAt('/manage/availability')
    await waitFor(() => expect(values()).toHaveLength(4))

    await user.click(screen.getByRole('button', { name: 'pick league and team' }))

    await waitFor(() =>
      expect(getAvailabilitySummary).toHaveBeenLastCalledWith('club-1', expect.objectContaining({ leagueId: 'lg-1', teamId: 'tm-1' })),
    )
    expect(await screen.findByTestId('header-subtitle')).toHaveTextContent('Showing: Over 40 League · Lions')
  })

  it('drops a stored team that is not among the teams, from the request and the scope line', async () => {
    localStorage.setItem('availability:filters:club-1', JSON.stringify({ leagueId: null, sectionId: null, teamId: 'gone' }))
    renderAt('/manage/availability')

    await waitFor(() => expect(values()).toHaveLength(4))
    expect(getAvailabilitySummary).toHaveBeenCalledWith('club-1', expect.objectContaining({ teamId: null }))
    expect(screen.queryByTestId('header-subtitle')).not.toBeInTheDocument()
  })

  it('puts the scope under the Availability title, only on Polls, and keeps it when the counters fail', async () => {
    const user = userEvent.setup()
    getAvailabilitySummary.mockRejectedValue(new Error('boom'))
    renderAt('/manage/availability')
    await user.click(screen.getByRole('button', { name: 'pick section' }))

    const subtitle = await screen.findByTestId('header-subtitle')
    expect(subtitle).toHaveTextContent('Showing: Vets › Over 40')
    expect(subtitle.previousElementSibling).toBe(screen.getByRole('heading', { level: 1, name: 'Availability' }))
    await waitFor(() => expect(screen.queryByTestId('page-counters-loading')).not.toBeInTheDocument())
    expect(screen.queryByText('Open polls')).not.toBeInTheDocument()
  })

  it('shows no scope caption on Players or Match-day cover', async () => {
    localStorage.setItem('availability:filters:club-1', JSON.stringify({ leagueId: null, sectionId: 'sec-1', teamId: null }))
    for (const path of ['/manage/availability/players', '/manage/availability/coverage']) {
      const { unmount } = renderAt(path)
      await screen.findByTestId('ctx')
      expect(screen.queryByTestId('header-subtitle')).not.toBeInTheDocument()
      unmount()
    }
  })

  it('holds the summary request and hides the counters when the team list fails', async () => {
    listTeamsForClub.mockRejectedValue(new Error('boom'))
    renderAt('/manage/availability')

    await waitFor(() => expect(listTeamsForClub).toHaveBeenCalled())
    await waitFor(() => expect(screen.queryByTestId('page-counters-loading')).not.toBeInTheDocument())
    expect(getAvailabilitySummary).not.toHaveBeenCalled()
    expect(screen.queryByText('Open polls')).not.toBeInTheDocument()
  })

  it('does not load teams for the Coverage view', async () => {
    renderAt('/manage/availability/coverage')

    await screen.findByText(/^Coverage view/)
    expect(listTeamsForClub).not.toHaveBeenCalled()
  })

  it('follows the poll type toggle and Show closed, and reads Polls shown when closed are included', async () => {
    const user = userEvent.setup()
    renderAt('/manage/availability')
    await waitFor(() => expect(values()).toHaveLength(4))
    expect(screen.getByText('Open polls')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'toggle group' }))
    await waitFor(() =>
      expect(getAvailabilitySummary).toHaveBeenLastCalledWith('club-1', expect.objectContaining({ type: 'SQUAD', includeClosed: false })),
    )

    await user.click(screen.getByRole('button', { name: 'toggle closed' }))
    await waitFor(() =>
      expect(getAvailabilitySummary).toHaveBeenLastCalledWith('club-1', expect.objectContaining({ type: 'SQUAD', includeClosed: true })),
    )
    expect(await screen.findByText('Polls shown')).toBeInTheDocument()
    expect(screen.queryByText('Open polls')).not.toBeInTheDocument()
  })

  it('presets Show closed from ?showClosed=true', async () => {
    renderAt('/manage/availability?showClosed=true')

    await waitFor(() =>
      expect(getAvailabilitySummary).toHaveBeenCalledWith('club-1', expect.objectContaining({ includeClosed: true })),
    )
    expect(await screen.findByText('Polls shown')).toBeInTheDocument()
  })

  it('renders no counters and makes no request on Players and Coverage', () => {
    for (const path of ['/manage/availability/players', '/manage/availability/coverage']) {
      const { unmount } = renderAt(path)
      expect(screen.queryByTestId('page-counters-loading')).not.toBeInTheDocument()
      expect(screen.queryByText('Open polls')).not.toBeInTheDocument()
      unmount()
    }
    expect(getAvailabilitySummary).not.toHaveBeenCalled()
  })

  // docs/specs/084
  describe('clickable counters (084)', () => {
    const withClosing = { ...summary, closingSoon: 2 }

    it('both poll counters are drill-downs with a chevron and no filter tag or pressed state', async () => {
      getAvailabilitySummary.mockResolvedValue(withClosing)
      renderAt('/manage/availability')
      const open = await screen.findByRole('button', { name: /Open polls/ })
      const closing = screen.getByRole('button', { name: /Close in 48 hours/ })

      for (const button of [open, closing]) expect(button).not.toHaveAttribute('aria-pressed')
      expect(screen.getByTestId('page-counter-open-polls-marker')).toHaveTextContent('›')
      expect(screen.getByTestId('page-counter-closing-soon-marker')).toHaveTextContent('›')
      expect(screen.queryByText('Tap to filter')).not.toBeInTheDocument()
      expect(screen.queryByText('Show all')).not.toBeInTheDocument()
    })

    it('Open polls opens the polls panel with the registered polls, soonest closing first, closed after', async () => {
      const user = userEvent.setup()
      getAvailabilitySummary.mockResolvedValue(withClosing)
      renderAt('/manage/availability')
      await user.click(await screen.findByRole('button', { name: 'register polls' }))

      await user.click(await screen.findByRole('button', { name: /Open polls/ }))

      expect(await screen.findByRole('heading', { level: 2, name: 'Open polls' })).toBeInTheDocument()
      // Show closed is off: the header counts the open ones in the list the page registered.
      expect(screen.getByTestId('polls-panel-header')).toHaveTextContent('2 open polls')
      const rows = screen.getAllByTestId('polls-panel-row')
      expect(rows.map((row) => row.textContent)).toEqual([
        expect.stringContaining('Thursday fixtures'),
        expect.stringContaining('Lions vs Rivals'),
        expect.stringContaining('Lions vs Old'),
      ])
      expect(within(rows[0]).getByRole('link')).toHaveAttribute('href', '/manage/availability/group/g1')
      await user.click(screen.getByRole('button', { name: 'Close polls list' }))
      await waitFor(() => expect(screen.queryByRole('heading', { level: 2, name: 'Open polls' })).not.toBeInTheDocument())
    })

    it('with Show closed on the first counter reads Polls shown and the panel header spells out open and closed', async () => {
      const user = userEvent.setup()
      getAvailabilitySummary.mockResolvedValue(withClosing)
      renderAt('/manage/availability?showClosed=true')
      await user.click(await screen.findByRole('button', { name: 'register polls' }))

      await user.click(await screen.findByRole('button', { name: /Polls shown/ }))

      expect(await screen.findByRole('heading', { level: 2, name: 'Polls shown' })).toBeInTheDocument()
      expect(screen.getByTestId('polls-panel-header')).toHaveTextContent('3 polls shown, 2 open and 1 closed')
    })

    it('Close in 48 hours opens the panel with only the open polls closing within 48 hours', async () => {
      const user = userEvent.setup()
      getAvailabilitySummary.mockResolvedValue(withClosing)
      renderAt('/manage/availability')
      await user.click(await screen.findByRole('button', { name: 'register polls' }))

      await user.click(await screen.findByRole('button', { name: /Close in 48 hours/ }))

      expect(await screen.findByRole('heading', { level: 2, name: 'Closing within 48 hours' })).toBeInTheDocument()
      expect(screen.getByTestId('polls-panel-header')).toHaveTextContent('1 open poll closing within 48 hours')
      expect(screen.getAllByTestId('polls-panel-row')).toHaveLength(1)
      expect(screen.getByText('Thursday fixtures')).toBeInTheDocument()
    })

    it('closes the polls panel when the view leaves Polls, so it is not open on return', async () => {
      const user = userEvent.setup()
      getAvailabilitySummary.mockResolvedValue(withClosing)
      renderAt('/manage/availability')
      await user.click(await screen.findByRole('button', { name: /Open polls/ }))
      expect(await screen.findByRole('heading', { level: 2, name: 'Open polls' })).toBeInTheDocument()

      await user.click(screen.getByRole('link', { name: 'Players', hidden: true }))
      await user.click(await screen.findByRole('link', { name: 'Polls' }))

      await screen.findByRole('button', { name: /Open polls/ })
      expect(screen.queryByRole('heading', { level: 2, name: 'Open polls' })).not.toBeInTheDocument()
    })

    it('shows loading rows until the Polls page has registered its polls', async () => {
      const user = userEvent.setup()
      getAvailabilitySummary.mockResolvedValue(withClosing)
      renderAt('/manage/availability')

      await user.click(await screen.findByRole('button', { name: /Open polls/ }))

      expect(await screen.findByTestId('polls-panel-loading')).toBeInTheDocument()
    })

    it('does not touch the summary request or the figures when a panel opens, and has no closingSoon flag', async () => {
      const user = userEvent.setup()
      getAvailabilitySummary.mockResolvedValue(withClosing)
      renderAt('/manage/availability')
      await screen.findByRole('button', { name: /Close in 48 hours/ })
      const calls = getAvailabilitySummary.mock.calls.length

      await user.click(screen.getByRole('button', { name: /Close in 48 hours/ }))

      expect(getAvailabilitySummary).toHaveBeenCalledTimes(calls)
      for (const [, filters] of getAvailabilitySummary.mock.calls) expect(filters).not.toHaveProperty('closingSoon')
      expect(screen.getAllByTestId('page-counter-value').map((node) => node.textContent)).toEqual(['3', '12 / 20', '8.5', '2'])
    })

    it('at zero the poll counters are plain cards that open nothing', async () => {
      const user = userEvent.setup()
      getAvailabilitySummary.mockResolvedValue({ ...summary, openPolls: 0, closingSoon: 0 })
      renderAt('/manage/availability')
      await waitFor(() => expect(screen.getByTestId('page-counter-closing-soon')).toBeInTheDocument())

      expect(screen.queryByRole('button', { name: /Open polls/ })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /Close in 48 hours/ })).not.toBeInTheDocument()
      expect(screen.queryByTestId('page-counter-closing-soon-marker')).not.toBeInTheDocument()
      await user.click(screen.getByTestId('page-counter-closing-soon'))
      expect(screen.queryByTestId('polls-panel-header')).not.toBeInTheDocument()
    })

    it('the players counters are drill-down buttons (no aria-pressed) that open the panel on the matching tab', async () => {
      const user = userEvent.setup()
      getAvailabilitySummary.mockResolvedValue(withClosing)
      renderAt('/manage/availability')
      const responded = await screen.findByRole('button', { name: /Players responded/ })
      expect(responded).not.toHaveAttribute('aria-pressed')
      expect(screen.getByTestId('page-counter-players-responded-marker')).toHaveTextContent('›')

      await user.click(screen.getByRole('button', { name: /Players still to answer/ }))
      expect(await screen.findByRole('tab', { name: /Still to answer/ })).toHaveAttribute('aria-selected', 'true')
      await screen.findByText('Ann Lee')
      await user.click(screen.getByRole('button', { name: 'Close players list' }))
      await waitFor(() => expect(screen.queryByRole('tab', { name: /Still to answer/ })).not.toBeInTheDocument())

      await user.click(responded)
      expect(await screen.findByRole('tab', { name: /Responded/ })).toHaveAttribute('aria-selected', 'true')
      expect(screen.getByRole('tab', { name: 'Responded · 12' })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: 'Still to answer · 8.5' })).toBeInTheDocument()
    })

    it('the panel request carries exactly the summary filters, and no panel request before it opens', async () => {
      const user = userEvent.setup()
      getAvailabilitySummary.mockResolvedValue(withClosing)
      renderAt('/manage/availability')
      await user.click(await screen.findByRole('button', { name: 'pick league and team' }))
      await user.click(await screen.findByRole('button', { name: 'toggle group' }))
      await user.click(await screen.findByRole('button', { name: 'toggle closed' }))
      expect(listAvailabilitySummaryPlayers).not.toHaveBeenCalled()

      await user.click(await screen.findByRole('button', { name: /Players still to answer/ }))

      await waitFor(() => expect(listAvailabilitySummaryPlayers).toHaveBeenCalled())
      expect(listAvailabilitySummaryPlayers.mock.calls[0][0]).toBe('club-1')
      expect(listAvailabilitySummaryPlayers.mock.calls[0][1]).toEqual({
        leagueId: 'lg-1', sectionId: null, teamId: 'tm-1', type: 'SQUAD', includeClosed: true,
        kind: 'awaiting', search: '',
      })
      expect(await screen.findByTestId('players-panel-scope')).toHaveTextContent('Showing: Over 40 League · Lions')
    })

    it('keeps the panel open when the summary goes pending (a filter change) or fails behind it', async () => {
      const user = userEvent.setup()
      getAvailabilitySummary.mockResolvedValue(withClosing)
      renderAt('/manage/availability')
      await user.click(await screen.findByRole('button', { name: /Players still to answer/ }))
      await screen.findByText('Ann Lee')

      // The filter change lands behind the open panel; its summary is pending, then fails.
      let fail: (reason: Error) => void = () => undefined
      getAvailabilitySummary.mockReturnValue(new Promise((_resolve, reject) => { fail = reject }))
      fireEvent.click(screen.getByText('pick section'))
      await waitFor(() => expect(getAvailabilitySummary).toHaveBeenCalledTimes(2))
      expect(screen.getByRole('tab', { name: /Still to answer/ })).toBeInTheDocument()
      expect(screen.getByText('Ann Lee')).toBeInTheDocument()

      await act(async () => fail(new Error('boom')))
      expect(screen.getByRole('tab', { name: /Still to answer/ })).toBeInTheDocument()
      expect(screen.getByText('Ann Lee')).toBeInTheDocument()
    })

    it('at zero the players counters are plain cards that open nothing', async () => {
      const user = userEvent.setup()
      getAvailabilitySummary.mockResolvedValue({ ...summary, playersResponded: 0, playersStillToAnswer: 0 })
      renderAt('/manage/availability')
      await waitFor(() => expect(screen.getByTestId('page-counter-players-responded')).toBeInTheDocument())

      expect(screen.queryByRole('button', { name: /Players responded/ })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /Players still to answer/ })).not.toBeInTheDocument()
      await user.click(screen.getByTestId('page-counter-players-still-to-answer'))
      expect(screen.queryByRole('tab')).not.toBeInTheDocument()
      expect(listAvailabilitySummaryPlayers).not.toHaveBeenCalled()
    })
  })
})
