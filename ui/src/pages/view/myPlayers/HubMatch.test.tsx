import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from '../../../api/axiosConfig'
import type { MyMatchDto } from '../../../api/myPlayersApi'
import { HubMatch } from './HubMatch'
import { httpError, newQueryClient, routeApi } from '../../../test/accountTestUtils'
import type { ApiMock } from '../../../test/accountTestUtils'
import { LIVE_SCORE, STREAM, matchDto } from '../../../test/hubMatchFixtures'

vi.mock('../../../api/axiosConfig', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }))

// docs/specs/135 (Match page): one status badge, four static figures, live entries, availability, both teams, no Share, Manage or Edit.
const http = api as unknown as ApiMock

function renderMatch(data: MyMatchDto | Error, onAnswer = vi.fn()) {
  routeApi(http, { 'GET /me/players/k1/matches/m1': data })
  return render(
    <QueryClientProvider client={newQueryClient()}>
      <MemoryRouter>
        <HubMatch playerKey="k1" matchId="m1" from="matches" onAnswerAvailability={onAnswer} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const player = (name: string, extra: Record<string, unknown> = {}) => ({ name, role: null, captain: false, keeper: false, twelfth: false, ...extra })

beforeEach(() => vi.clearAllMocks())

describe('HubMatch upcoming', () => {
  it('shows one status badge, the title and four static figures with Not Announced Yet', async () => {
    renderMatch(matchDto())

    expect(await screen.findByRole('heading', { name: 'Riverside U15 A versus Coastal U15' })).toBeInTheDocument()
    expect(screen.getByTestId('match-status-badge')).toHaveTextContent('Upcoming')
    expect(screen.queryByTestId('live-badge')).not.toBeInTheDocument()
    const figures = screen.getByTestId('match-figures')
    expect(within(figures).getByTestId('match-figure-when')).toHaveTextContent(/Sun 8 Nov 09:00/)
    expect(within(figures).getByTestId('match-figure-where')).toHaveTextContent('Riverside Oval')
    expect(within(figures).getByTestId('match-figure-league')).toHaveTextContent('TVL Division 1 · 2099/2100')
    expect(within(figures).getByTestId('match-figure-status')).toHaveTextContent('Not Announced Yet')
    expect(within(figures).queryByRole('button')).not.toBeInTheDocument()
    expect(within(figures).queryByRole('link')).not.toBeInTheDocument()
  })

  it('says Friendly with no league, and a dash with no venue', async () => {
    renderMatch(matchDto({ league: null, season: null, venue: null }))

    await screen.findByTestId('match-figures')
    expect(screen.getByTestId('match-figure-league')).toHaveTextContent('Friendly')
    expect(screen.getByTestId('match-figure-where')).toHaveTextContent('-')
  })

  it('has no Share, Manage, Edit or Back control', async () => {
    renderMatch(matchDto())

    await screen.findByTestId('hub-match')
    expect(screen.queryByRole('button', { name: /share|manage|edit|back/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /share|manage|edit|back/i })).not.toBeInTheDocument()
  })

  it('reads each selection state', async () => {
    for (const [selection, text] of [['SELECTED', 'Selected'], ['NOT_SELECTED', 'Not Selected']] as const) {
      const { unmount } = renderMatch(matchDto({ selection }))
      expect(await screen.findByTestId('match-figure-status')).toHaveTextContent(text)
      unmount()
    }
  })

  it('shows Get Directions from the stored position', async () => {
    renderMatch(matchDto({ playingAreaName: 'Riverside Oval', playingAreaLatitude: -33.7, playingAreaLongitude: 18.96 }))

    expect(await screen.findByRole('button', { name: 'Get Directions' })).toBeInTheDocument()
  })

  it('shows the answer in words with Answer Availability while the poll is open', async () => {
    const onAnswer = vi.fn()
    renderMatch(matchDto({ availability: { answer: 'AVAILABLE', pollId: 'p1', pollOpen: true } }), onAnswer)

    const panel = await screen.findByTestId('match-availability')
    expect(panel).toHaveTextContent('You said Yes. Poll open.')
    await userEvent.setup().click(within(panel).getByRole('button', { name: 'Answer Availability' }))
    expect(onAnswer).toHaveBeenCalledTimes(1)
  })

  it('says Poll closed with no button once the poll is closed, and hides the panel with no availability', async () => {
    const { unmount } = renderMatch(matchDto({ availability: { answer: null, pollId: 'p1', pollOpen: false } }))
    const panel = await screen.findByTestId('match-availability')
    expect(panel).toHaveTextContent('No answer yet. Poll closed.')
    expect(within(panel).queryByRole('button')).not.toBeInTheDocument()
    unmount()

    renderMatch(matchDto({ availability: null }))
    await screen.findByTestId('hub-match')
    expect(screen.queryByTestId('match-availability')).not.toBeInTheDocument()
  })

  it('shows Your team on the player\'s side and Team not announced yet for an unannounced side', async () => {
    renderMatch(matchDto())

    const sides = await screen.findAllByTestId('match-side')
    expect(sides[0]).toHaveAttribute('data-mine', 'true')
    expect(within(sides[0]).getByText('Your team')).toBeInTheDocument()
    expect(within(sides[1]).queryByText('Your team')).not.toBeInTheDocument()
    for (const side of sides) expect(side).toHaveTextContent('Team not announced yet')
    expect(screen.queryAllByTestId('match-player')).toHaveLength(0)
  })

  it('shows the announced XI with initials, captain, keeper and twelfth man', async () => {
    const home = matchDto().home
    renderMatch(
      matchDto({
        selection: 'SELECTED',
        home: { ...home, announced: true, players: [player('A.B.', { captain: true }), player('J.K.', { keeper: true }), player('M.S.', { twelfth: true })] },
      }),
    )

    const [mine] = await screen.findAllByTestId('match-side')
    const rows = within(mine).getAllByTestId('match-player')
    expect(rows).toHaveLength(3)
    expect(rows[0]).toHaveTextContent('1A.B. (C)')
    expect(rows[1]).toHaveTextContent('2J.K. (WK)')
    expect(rows[2]).toHaveTextContent('M.S. (12th)')
    expect(within(mine).queryByText('Team not announced yet')).not.toBeInTheDocument()
  })
})

describe('HubMatch live', () => {
  const live = (overrides: Partial<MyMatchDto> = {}) => matchDto({ phase: 'LIVE', startedAt: new Date(Date.now() - 80 * 60_000).toISOString(), liveScore: LIVE_SCORE, stream: STREAM, selection: 'SELECTED', ...overrides })

  it('shows the LIVE badge instead of a status badge, with elapsed time, the LiveScore card and Watch Live', async () => {
    renderMatch(live())

    expect(await screen.findByTestId('live-badge')).toHaveTextContent('LIVE')
    expect(screen.queryByTestId('match-status-badge')).not.toBeInTheDocument()
    expect(screen.getByTestId('match-figure-when')).toHaveTextContent('Started 1h 20m ago')
    const card = screen.getByTestId('live-score-card')
    expect(within(card).getByText('Scores are kept on scores.example. It opens in a new tab.')).toBeInTheDocument()
    expect(within(card).getByRole('link', { name: 'Follow Live Score' })).toHaveAttribute('href', LIVE_SCORE.url)
    expect(within(screen.getByTestId('match-watch-card')).getByRole('link', { name: 'Watch Live' })).toHaveAttribute('href', '/account/players/k1/schedule/matches/m1/watch?from=matches')
  })

  it('offers no Watch Live without a stream and no Follow Live Score without a source', async () => {
    renderMatch(live({ stream: null, liveScore: null }))

    await screen.findByTestId('live-badge')
    expect(screen.queryByTestId('match-watch-card')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Follow Live Score' })).not.toBeInTheDocument()
  })
})

describe('HubMatch played, missing and failing', () => {
  it('shows Played, the result and no live entries', async () => {
    renderMatch(matchDto({ phase: 'RECENT', status: 'PLAYED', result: { homeScore: '142/6', awayScore: '138/9', resultLine: 'Riverside U15 A won by 4 runs' }, liveScore: LIVE_SCORE }))

    expect(await screen.findByTestId('match-status-badge')).toHaveTextContent('Played')
    expect(screen.getByTestId('match-figure-status')).toHaveTextContent('Played')
    expect(screen.getByTestId('match-result')).toHaveTextContent('Riverside U15 A won by 4 runs')
    expect(screen.queryByTestId('live-score-card')).not.toBeInTheDocument()
  })

  it('says This match is not available for a 404', async () => {
    renderMatch(httpError(404))

    expect(await screen.findByTestId('hub-match-missing')).toHaveTextContent('This match is not available')
  })

  it('shows an error with Retry for another failure, and a busy skeleton while loading', async () => {
    renderMatch(httpError(500))
    expect(await screen.findByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })

  it('shows a busy skeleton while loading', () => {
    http.get.mockImplementation(() => new Promise(() => undefined))
    render(
      <QueryClientProvider client={newQueryClient()}>
        <MemoryRouter>
          <HubMatch playerKey="k1" matchId="m1" onAnswerAvailability={vi.fn()} />
        </MemoryRouter>
      </QueryClientProvider>,
    )
    expect(screen.getByTestId('hub-match-loading')).toHaveAttribute('aria-busy', 'true')
  })
})
