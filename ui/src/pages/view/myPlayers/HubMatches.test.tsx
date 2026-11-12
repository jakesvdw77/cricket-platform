import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from '../../../api/axiosConfig'
import { HubMatches } from './HubMatches'
import { calls, httpError, newQueryClient, routeApi } from '../../../test/accountTestUtils'
import type { ApiMock } from '../../../test/accountTestUtils'
import { LocationProbe } from '../../../test/LocationProbe'
import { LIVE_SCORE, matchDto, matchList, summary } from '../../../test/hubMatchFixtures'

vi.mock('../../../api/axiosConfig', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }))

// docs/specs/135 (Schedule > Matches): Live Now pinned first, Upcoming with a countdown, Recent collapsed.
const http = api as unknown as ApiMock

const started = () => new Date(Date.now() - 80 * 60_000).toISOString()
const LIVE = summary({ matchId: 'live1', phase: 'LIVE', date: '2026-11-01', startedAt: started(), selection: 'SELECTED', hasLiveScore: true, hasStream: true, home: { name: 'Riverside U15 A' }, away: { name: 'Hillside U15' } })
const RECENT = summary({ matchId: 'old1', phase: 'RECENT', date: '2026-10-25', time: '09:00', result: { homeScore: '142/6', awayScore: '138/9', resultLine: 'Riverside U15 A won by 4 runs' } })
const PENDING = summary({ matchId: 'old2', phase: 'RECENT', date: '2026-10-18', result: null })

function renderMatches(routes: Record<string, unknown>, key = 'k1') {
  routeApi(http, routes)
  return render(
    <QueryClientProvider client={newQueryClient()}>
      <MemoryRouter>
        <HubMatches playerKey={key} playerName="Sam" />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => vi.clearAllMocks())

describe('HubMatches', () => {
  it('opens on the Live pill with the LIVE badge, elapsed time, selection, Live Score and Watch Live top right', async () => {
    renderMatches({
      'GET /me/players/k1/matches': matchList({ live: [LIVE], upcoming: [summary({ matchId: 'up1', date: '2099-11-08' })] }),
      'GET /me/players/k1/matches/live1': matchDto({ matchId: 'live1', phase: 'LIVE', liveScore: LIVE_SCORE }),
    })

    const live = await screen.findAllByTestId('hub-match-row')
    expect(live[0]).toHaveAttribute('data-phase', 'LIVE')
    expect(within(live[0]).getByTestId('live-badge')).toHaveTextContent('LIVE')
    expect(within(live[0]).getByTestId('match-elapsed')).toHaveTextContent('Started 1h 20m ago')
    expect(within(live[0]).getByTestId('selection-tag')).toHaveTextContent('Selected')
    expect(within(live[0]).getByRole('link', { name: 'Riverside U15 A versus Hillside U15' })).toHaveAttribute('href', '/account/players/k1/schedule/matches/live1?from=matches%3Alive')
    expect(await within(live[0]).findByRole('link', { name: 'Live Score, opens in a new tab' })).toHaveAttribute('target', '_blank')
    expect(within(live[0]).getByRole('link', { name: 'Watch Live' })).toHaveAttribute('href', '/account/players/k1/schedule/matches/live1/watch?from=matches%3Alive')
    // Only the chosen pill's list is shown, so the upcoming row is behind its own pill.
    expect(live).toHaveLength(1)
    expect(screen.getByRole('button', { name: /^Upcoming/ })).toHaveTextContent('1')
  })

  it('always has a Live pill (count 0) and opens on Upcoming with no live controls when nothing is on', async () => {
    renderMatches({ 'GET /me/players/k1/matches': matchList({ upcoming: [summary()] }) })

    await screen.findByTestId('hub-match-row')
    expect(screen.getByRole('button', { name: /^Live/ })).toHaveTextContent('0')
    expect(screen.queryByTestId('live-badge')).not.toBeInTheDocument()
  })

  it('shows an icon and a friendly line, not "None yet", on an empty Live pill', async () => {
    renderMatches({ 'GET /me/players/k1/matches': matchList({ upcoming: [summary()] }) })

    await screen.findByTestId('hub-match-row')
    await userEvent.setup().click(screen.getByRole('button', { name: /^Live/ }))
    expect(screen.getByTestId('matches-none')).toHaveTextContent('No match is live right now')
    expect(screen.getByTestId('matches-none')).toHaveTextContent('Sam')
  })

  it('lists Upcoming under its date with the time, a countdown and the Title Case selection tag, no chevron or kebab', async () => {
    renderMatches({ 'GET /me/players/k1/matches': matchList({ upcoming: [summary()] }) })

    const row = await screen.findByTestId('hub-match-row')
    expect(screen.getByRole('heading', { name: /8 November 2099/ })).toBeInTheDocument()
    expect(row).toHaveTextContent(/09:00 · in \d+ days/)
    expect(within(row).getByTestId('selection-tag')).toHaveTextContent('Waiting For Team Announcement')
    expect(within(row).getByTestId('match-league-line')).toHaveTextContent('TVL Division 1')
    expect(within(row).getByTestId('hub-venue-line')).toHaveTextContent('Riverside Oval')
    expect(within(row).queryByRole('button')).not.toBeInTheDocument()
  })

  it('opens on Recent when it is all there is, newest first, with the result and Result pending', async () => {
    renderMatches({ 'GET /me/players/k1/matches': matchList({ recent: [RECENT, PENDING] }) })

    await screen.findAllByTestId('hub-match-row')
    const rows = screen.getAllByTestId('hub-match-row')
    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveTextContent('142/6')
    expect(within(rows[0]).getByTestId('match-result-line')).toHaveTextContent('Riverside U15 A won by 4 runs')
    expect(within(rows[1]).getByTestId('match-result-line')).toHaveTextContent('Result pending')
  })

  it('shows the empty state naming the player', async () => {
    renderMatches({ 'GET /me/players/k1/matches': matchList() })

    expect(await screen.findByTestId('hub-matches-empty')).toHaveTextContent('No matches for Sam yet')
  })

  it('shows an error with Retry', async () => {
    renderMatches({ 'GET /me/players/k1/matches': httpError(500) })

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Retry' }))
    expect(calls(http.get, '/me/players/k1/matches').length).toBeGreaterThan(1)
  })

  it('asks for the selected player\'s matches', async () => {
    renderMatches({ 'GET /me/players/k2/matches': matchList({ upcoming: [summary({ matchId: 'z' })] }) }, 'k2')

    await screen.findByTestId('hub-match-row')
    expect(calls(http.get, '/me/players/k2/matches')).toHaveLength(1)
  })
})

describe('HubMatches pills and tab', () => {
  function renderAt(entry: string, list: unknown) {
    routeApi(http, { 'GET /me/players/k1/matches': list })
    return render(
      <QueryClientProvider client={newQueryClient()}>
        <MemoryRouter initialEntries={[entry]}>
          <HubMatches playerKey="k1" playerName="Sam" />
          <LocationProbe />
        </MemoryRouter>
      </QueryClientProvider>,
    )
  }
  const pill = (name: RegExp) => screen.getByRole('button', { name })
  const both = matchList({ upcoming: [summary({ matchId: 'up1' })], recent: [RECENT], upcomingTotal: 1, recentTotal: 1 })

  it('shows Live, Upcoming and Recent pills with their counts', async () => {
    renderAt('/x', matchList({ live: [LIVE], upcoming: [summary()], recent: [RECENT, PENDING], upcomingTotal: 4, recentTotal: 12 }))

    await screen.findAllByTestId('hub-match-row')
    expect(screen.getAllByRole('navigation', { name: 'Matches' })).toHaveLength(1)
    expect(pill(/^Live/)).toHaveTextContent('1')
    expect(pill(/^Upcoming/)).toHaveTextContent('4')
    expect(pill(/^Recent/)).toHaveTextContent('12')
  })

  it('falls back to live, then upcoming, then recent when no tab is asked for', async () => {
    const { unmount } = renderAt('/x', matchList({ live: [LIVE], upcoming: [summary()], recent: [RECENT] }))
    await screen.findByTestId('matches-live')
    unmount()

    const second = renderAt('/x', both)
    await screen.findByTestId('matches-upcoming')
    second.unmount()

    renderAt('/x', matchList({ recent: [RECENT] }))
    await screen.findByTestId('matches-recent')
  })

  it('reads ?tab= from the URL, ignores an unknown value, and writes the tapped pill back', async () => {
    const { unmount } = renderAt('/x?tab=recent', both)
    await screen.findByTestId('matches-recent')
    expect(pill(/^Recent/)).toHaveAttribute('aria-current', 'page')
    unmount()

    renderAt('/x?tab=bogus', both)
    await screen.findByTestId('matches-upcoming')
    await userEvent.setup().click(pill(/^Recent/))
    expect(screen.getByTestId('location')).toHaveTextContent('/x?tab=recent')
    expect(screen.getByTestId('matches-recent')).toBeInTheDocument()
    expect(within(screen.getByTestId('matches-recent')).getByTestId('hub-match-row')).toBeInTheDocument()
  })

  it('hands the chosen pill to the rows as from', async () => {
    renderAt('/x?tab=recent', both)

    const row = await screen.findByTestId('hub-match-row')
    expect(within(row).getByRole('link', { name: /versus/ })).toHaveAttribute('href', expect.stringContaining('from=matches%3Arecent'))
  })

  it('grows recentLimit by 10 with Show More while rows are hidden', async () => {
    renderAt('/x?tab=recent', matchList({ recent: [RECENT], recentTotal: 25 }))

    await userEvent.setup().click(await screen.findByTestId('show-more'))
    const limits = () => http.get.mock.calls.filter((call) => call[0] === '/me/players/k1/matches').map((call) => (call[1] as { params?: { recentLimit?: number } } | undefined)?.params?.recentLimit)
    await vi.waitFor(() => expect(limits()).toContain(20))
    expect(limits()).toContain(10)
  })

  it('has no Show More when every recent match is already listed', async () => {
    renderAt('/x?tab=recent', matchList({ recent: [RECENT], recentTotal: 1 }))

    await screen.findByTestId('matches-recent')
    expect(screen.queryByTestId('show-more')).not.toBeInTheDocument()
  })

  it.each([
    ['live', 'No match is live right now'],
    ['upcoming', 'No upcoming matches'],
    ['recent', 'No recent matches'],
  ])('shows the empty panel for the %s pill with its title', async (tab, title) => {
    const others = {
      live: matchList({ upcoming: [summary()] }),
      upcoming: matchList({ recent: [RECENT], recentTotal: 1 }),
      recent: matchList({ upcoming: [summary()], upcomingTotal: 1 }),
    } as const
    renderAt(`/x?tab=${tab}`, others[tab as keyof typeof others])

    const none = await screen.findByTestId('matches-none')
    expect(none).toHaveTextContent(title)
    expect(none).toHaveTextContent('Sam')
  })
})
