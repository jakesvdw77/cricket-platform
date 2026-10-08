import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes, useLocation, useOutletContext } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AvailabilityHubLayout from './AvailabilityHubLayout'
import PlayerAvailabilityRedirect from './PlayerAvailabilityRedirect'
import SectionAvailabilityRedirect from '../SectionAvailabilityRedirect'
import type { AvailabilitySummary } from '../../../api/availabilitySummaryApi'
import type { Season } from '../../../api/seasonApi'
import type { AvailabilityHubContext } from './hubContext'

vi.mock('../../../api/leagueApi', () => ({ listLeagues: () => Promise.resolve([]) }))
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
vi.mock('../../../api/availabilitySummaryApi', async () => {
  const actual = await vi.importActual<typeof import('../../../api/availabilitySummaryApi')>('../../../api/availabilitySummaryApi')
  return { ...actual, getAvailabilitySummary: (...args: unknown[]) => getAvailabilitySummary(...args) }
})

const summary: AvailabilitySummary = { openPolls: 3, playersResponded: 12, playersInAudience: 20, playersStillToAnswer: 8.5, closingSoon: 0 }

beforeEach(() => {
  getAvailabilitySummary.mockReset()
  getAvailabilitySummary.mockResolvedValue(summary)
  listSeasons.mockReset()
  listSeasons.mockResolvedValue(SEASONS)
  localStorage.clear()
})

function View({ name }: { name: string }) {
  const { clubId, filters, setFilters, seasonId, showGroup, setShowGroup, showClosed, setShowClosed } =
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
  it('titles the page Availability with no back link (079) and a switch of exactly Polls, Players and Coverage links', () => {
    renderAt('/manage/availability')

    expect(screen.getByRole('heading', { level: 1, name: 'Availability' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /back/i })).not.toBeInTheDocument()
    const nav = screen.getByRole('navigation', { name: 'Availability views' })
    const links = nav.querySelectorAll('a')
    expect(Array.from(links).map((link) => link.textContent)).toEqual(['Polls', 'Players', 'Coverage'])
    expect(screen.getByRole('link', { name: 'Polls' })).toHaveAttribute('href', '/manage/availability')
    expect(screen.getByRole('link', { name: 'Players' })).toHaveAttribute('href', '/manage/availability/players')
    expect(screen.getByRole('link', { name: 'Coverage' })).toHaveAttribute('href', '/manage/availability/coverage')
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

  it('marks Coverage as current on /manage/availability/coverage (with or without a trailing slash) and renders the Coverage view', () => {
    for (const path of ['/manage/availability/coverage', '/manage/availability/coverage/']) {
      const { unmount } = renderAt(path)
      expect(screen.getByRole('link', { name: 'Coverage' })).toHaveAttribute('aria-current', 'page')
      expect(screen.getByRole('link', { name: 'Coverage' })).toHaveClass('Mui-selected')
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

    await user.click(screen.getByRole('link', { name: 'Coverage' }))
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

  // docs/specs/083: no season control on any view; Players and Coverage get the default season.
  it('has no season control on any view, and hands Players and Coverage the default season', async () => {
    for (const path of ['/manage/availability', '/manage/availability/players', '/manage/availability/coverage']) {
      const view = renderAt(path)
      expect(screen.queryByRole('button', { name: /season/i })).not.toBeInTheDocument()
      if (path.endsWith('availability')) {
        expect(listSeasons).not.toHaveBeenCalled()
      } else {
        await waitFor(() => expect(screen.getByTestId('ctx')).toHaveTextContent('season=s-now'))
      }
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

  it('shows the four counters on Polls with the active Open polls and the N / M responded text', async () => {
    renderAt('/manage/availability')

    await waitFor(() => expect(values()).toEqual(['3', '12 / 20', '8.5', '0']))
    expect(getAvailabilitySummary).toHaveBeenCalledWith('club-1', {
      sectionId: null, type: 'ALL', includeClosed: false,
    })
    for (const label of ['Open polls', 'Players responded', 'Players still to answer', 'Close in 48 hours']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
    expect(screen.getByTestId('page-counter-open-polls')).toHaveAttribute('data-active', 'true')
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
    expect(screen.queryByTestId('counters-scope')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'pick section' }))

    await waitFor(() =>
      expect(getAvailabilitySummary).toHaveBeenLastCalledWith('club-1', expect.objectContaining({ sectionId: 'sec-1' })),
    )
    expect(await screen.findByTestId('counters-scope')).toHaveTextContent('Showing: Vets › Over 40')
  })

  it('does not send or show the league and team filters until the list filters by them (slice 3)', async () => {
    const user = userEvent.setup()
    renderAt('/manage/availability')
    await waitFor(() => expect(values()).toHaveLength(4))
    const calls = getAvailabilitySummary.mock.calls.length

    await user.click(screen.getByRole('button', { name: 'pick league and team' }))
    await user.click(screen.getByRole('button', { name: 'pick section' }))

    await waitFor(() => expect(getAvailabilitySummary.mock.calls.length).toBeGreaterThan(calls))
    for (const [, sent] of getAvailabilitySummary.mock.calls) {
      expect(sent).not.toHaveProperty('leagueId')
      expect(sent).not.toHaveProperty('teamId')
    }
    expect(await screen.findByTestId('counters-scope')).toHaveTextContent(/^Showing: Vets › Over 40$/)
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
})
