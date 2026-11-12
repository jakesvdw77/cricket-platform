import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from '../../../api/axiosConfig'
import type { MyMatchSummaryDto } from '../../../api/myPlayersApi'
import { HubMatchRow } from './HubMatchRow'
import { newQueryClient, routeApi } from '../../../test/accountTestUtils'
import type { ApiMock } from '../../../test/accountTestUtils'
import { LIVE_SCORE, matchDto, summary } from '../../../test/hubMatchFixtures'

vi.mock('../../../api/axiosConfig', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }))

// Owner, 2026-11-12: availability tag on upcoming rows, live actions row, W/L/T chip on recent rows, `from` on the match link.
const http = api as unknown as ApiMock
const NOW = new Date('2026-11-01T10:00:00')

function renderRow(row: MyMatchSummaryDto, from?: string) {
  routeApi(http, { [`GET /me/players/k1/matches/${row.matchId}`]: matchDto({ matchId: row.matchId, liveScore: LIVE_SCORE }) })
  return render(
    <QueryClientProvider client={newQueryClient()}>
      <MemoryRouter>
        <HubMatchRow playerKey="k1" row={row} now={NOW} from={from} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => vi.clearAllMocks())

describe('HubMatchRow availability tag', () => {
  it('shows the answer label for an answered poll', () => {
    renderRow(summary({ availability: { answer: 'AVAILABLE', pollId: 'p1', pollOpen: false } }))

    expect(screen.getByTestId('availability-tag')).toHaveTextContent('Available')
  })

  it('links an open poll with no answer to the availability page', () => {
    renderRow(summary({ availability: { answer: null, pollId: 'p1', pollOpen: true } }))

    const tag = screen.getByRole('link', { name: 'Availability: Answer Availability' })
    expect(tag).toHaveTextContent('Answer Availability')
    expect(tag).toHaveAttribute('href', '/account/players/k1/availability')
  })

  it('shows No Answer, not a link, for a closed poll without an answer', () => {
    renderRow(summary({ availability: { answer: null, pollId: 'p1', pollOpen: false } }))

    expect(screen.getByTestId('availability-tag')).toHaveTextContent('No Answer')
    expect(screen.queryByRole('link', { name: /Availability/ })).not.toBeInTheDocument()
  })

  it('shows no tag without availability, and none on a recent row', () => {
    const { unmount } = renderRow(summary({ availability: null }))
    expect(screen.queryByTestId('availability-tag')).not.toBeInTheDocument()
    unmount()

    renderRow(summary({ phase: 'RECENT', availability: { answer: 'AVAILABLE', pollId: 'p1', pollOpen: false } }))
    expect(screen.queryByTestId('availability-tag')).not.toBeInTheDocument()
  })
})

describe('HubMatchRow live actions', () => {
  const liveRow = (overrides: Partial<MyMatchSummaryDto> = {}) => summary({ phase: 'LIVE', startedAt: '2026-11-01T09:00:00', ...overrides })

  it('shows Watch Live only with a stream, and Live Score only with a live score', async () => {
    const { unmount } = renderRow(liveRow({ hasStream: true, hasLiveScore: false }))
    expect(screen.getByRole('link', { name: 'Watch Live' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Live Score/ })).not.toBeInTheDocument()
    unmount()

    renderRow(liveRow({ hasStream: false, hasLiveScore: true }))
    expect(await screen.findByRole('link', { name: 'Live Score, opens in a new tab' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Watch Live' })).not.toBeInTheDocument()
  })

  it('has no actions row with neither', () => {
    renderRow(liveRow())

    expect(screen.queryByTestId('live-actions')).not.toBeInTheDocument()
  })
})

describe('HubMatchRow recent outcome', () => {
  const recent = (overrides: Partial<MyMatchSummaryDto>) => summary({ phase: 'RECENT', result: { homeScore: '1', awayScore: '2', resultLine: 'Riverside U15 A won by 4 runs' }, ...overrides })

  it.each([['WON', 'W'], ['LOST', 'L'], ['TIED', 'T']] as const)('shows %s as the letter %s', (outcome, letter) => {
    renderRow(recent({ outcome }))

    expect(screen.getByTestId('match-outcome-chip')).toHaveTextContent(letter)
  })

  it('shows a T from a tied result line without a server outcome, and no chip when it cannot be told', () => {
    const { unmount } = renderRow(recent({ result: { homeScore: '1', awayScore: '1', resultLine: 'Match tied' } }))
    expect(screen.getByTestId('match-outcome-chip')).toHaveTextContent('T')
    unmount()

    renderRow(recent({}))
    expect(screen.queryByTestId('match-outcome-chip')).not.toBeInTheDocument()
  })

  it('does not show a chip on an upcoming row', () => {
    renderRow(summary({ outcome: 'WON' }))

    expect(screen.queryByTestId('match-outcome-chip')).not.toBeInTheDocument()
  })
})

describe('HubMatchRow link', () => {
  it('carries the from value to the match page, and omits it when none is given', () => {
    const { unmount } = renderRow(summary(), 'matches:upcoming')
    const row = screen.getByTestId('hub-match-row')
    expect(within(row).getByRole('link', { name: 'Riverside U15 A versus Coastal U15' })).toHaveAttribute('href', '/account/players/k1/schedule/matches/m1?from=matches%3Aupcoming')
    unmount()

    renderRow(summary())
    expect(screen.getByRole('link', { name: 'Riverside U15 A versus Coastal U15' })).toHaveAttribute('href', '/account/players/k1/schedule/matches/m1')
  })
})
