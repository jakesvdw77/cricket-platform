import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from '../../../api/axiosConfig'
import { HubMatches } from './HubMatches'
import { calls, httpError, newQueryClient, routeApi } from '../../../test/accountTestUtils'
import type { ApiMock } from '../../../test/accountTestUtils'
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
  it('pins Live Now first with the LIVE badge, elapsed time, selection, Follow Live Score and Watch Live', async () => {
    renderMatches({
      'GET /me/players/k1/matches': matchList({ live: [LIVE], upcoming: [summary({ matchId: 'up1', date: '2099-11-08' })] }),
      'GET /me/players/k1/matches/live1': matchDto({ matchId: 'live1', phase: 'LIVE', liveScore: LIVE_SCORE }),
    })

    const live = await screen.findAllByTestId('hub-match-row')
    expect(live[0]).toHaveAttribute('data-phase', 'LIVE')
    expect(within(live[0]).getByTestId('live-badge')).toHaveTextContent('LIVE')
    expect(within(live[0]).getByTestId('match-elapsed')).toHaveTextContent('Started 1h 20m ago')
    expect(within(live[0]).getByTestId('selection-tag')).toHaveTextContent('Selected')
    expect(within(live[0]).getByRole('link', { name: 'Riverside U15 A versus Hillside U15' })).toHaveAttribute('href', '/account/players/k1/schedule/matches/live1?from=matches')
    expect(await within(live[0]).findByRole('link', { name: 'Follow Live Score' })).toHaveAttribute('target', '_blank')
    expect(within(live[0]).getByRole('link', { name: 'Watch Live' })).toHaveAttribute('href', '/account/players/k1/schedule/matches/live1/watch?from=matches')
    expect(screen.getByRole('heading', { name: 'Live Now' })).toBeInTheDocument()
    expect(live[1]).toHaveAttribute('data-phase', 'UPCOMING')
  })

  it('has no Live Now section, and no live controls, when nothing is on', async () => {
    renderMatches({ 'GET /me/players/k1/matches': matchList({ upcoming: [summary()] }) })

    await screen.findByTestId('hub-match-row')
    expect(screen.queryByRole('heading', { name: 'Live Now' })).not.toBeInTheDocument()
    expect(screen.queryByTestId('live-badge')).not.toBeInTheDocument()
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

  it('keeps Recent collapsed until asked for, then shows the result and Result pending', async () => {
    renderMatches({ 'GET /me/players/k1/matches': matchList({ upcoming: [summary()], recent: [RECENT, PENDING] }) })

    const toggle = await screen.findByRole('button', { name: 'Recent Matches' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getAllByTestId('hub-match-row')).toHaveLength(1)

    await userEvent.setup().click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    const rows = screen.getAllByTestId('hub-match-row')
    expect(rows).toHaveLength(3)
    expect(rows[1]).toHaveTextContent('142/6')
    expect(within(rows[1]).getByTestId('match-result-line')).toHaveTextContent('Riverside U15 A won by 4 runs')
    expect(within(rows[2]).getByTestId('match-result-line')).toHaveTextContent('Result pending')
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
