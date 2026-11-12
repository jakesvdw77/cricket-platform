import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from '../../../api/axiosConfig'
import { HubResult } from './HubResult'
import { calls, httpError } from '../../../test/accountTestUtils'
import type { ApiMock } from '../../../test/accountTestUtils'
import { KEY, bowlingRow, makeInnings, makeResultDetail } from '../../../test/hubResultFixtures'
import { renderStatsPage } from '../../../test/statsPageTestUtils'

vi.mock('../../../api/axiosConfig', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }))

// docs/specs/145 Test Plan, Frontend: the Hub Result page. The header, the player's own card first, then the full scorecard of each innings
// with names (the player's own row marked), the awards; a result that is not shown is a 404 and reads "This result is not available".
// The footer's Back is owned by hubBack (hubBack.test.ts pins "Back to Results" with the same scope, and the stats origins).
const http = api as unknown as ApiMock
const URL = `GET /me/players/${KEY}/results/m1`
const render = (routes: Record<string, unknown>) => renderStatsPage(http, <HubResult playerKey={KEY} matchId="m1" />, routes)

beforeEach(() => vi.clearAllMocks())

describe('HubResult', () => {
  it('shows skeletons while the result loads', () => {
    render({ [URL]: () => new Promise(() => undefined) })
    expect(screen.getByTestId('hub-result-loading')).toHaveAttribute('aria-busy', 'true')
  })

  it('draws the header: both teams, the date, the league, the venue, the result line and both scores', async () => {
    render({ [URL]: makeResultDetail() })
    const page = await screen.findByTestId('hub-result')
    expect(within(page).getByRole('heading', { level: 2 })).toHaveTextContent('Villagers versus Rovers')
    expect(page).toHaveTextContent(/2026 · Over 40 · Main Oval/)
    expect(screen.getByTestId('hub-result-line')).toHaveTextContent('Villagers beat Rovers by 24 runs')
    const figures = screen.getByTestId('hub-result-figures')
    expect(figures).toHaveTextContent('Villagers')
    expect(figures).toHaveTextContent('180/4')
    expect(figures).toHaveTextContent('Rovers')
    expect(figures).toHaveTextContent('156/9')
    expect(calls(http.get, `/me/players/${KEY}/results/m1`)).toHaveLength(1)
  })

  it('puts the player\'s own game first, titled with the first name, before any innings', async () => {
    render({ [URL]: makeResultDetail() })
    const page = await screen.findByTestId('hub-result')
    expect(within(page).getByRole('heading', { name: "Aman's Game" })).toBeInTheDocument()
    const game = screen.getByTestId('hub-game-card')
    const firstInnings = screen.getAllByTestId('hub-result-innings')[0]
    expect(game.compareDocumentPosition(firstInnings) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(game).toHaveTextContent('Aman')
    expect(screen.getByTestId('result-figure')).toHaveTextContent('46')
  })

  it('shows the bowling card when the player\'s own game was a spell', async () => {
    render({ [URL]: makeResultDetail({ mine: bowlingRow() }) })
    await screen.findByTestId('hub-result')
    expect(screen.getByTestId('hub-game-card')).toHaveAttribute('data-kind', 'bowling')
    expect(screen.getByTestId('over-blocks')).toBeInTheDocument()
  })

  it('draws the full scorecard of each innings with names, how out, extras and did not bat', async () => {
    render({ [URL]: makeResultDetail() })
    await screen.findByTestId('hub-result')
    const innings = screen.getAllByTestId('hub-result-innings')
    expect(innings).toHaveLength(2)
    expect(innings[0]).toHaveTextContent('Villagers · 180/4 (40.0 ov)')
    const batting = within(within(innings[0]).getByRole('table', { name: 'Villagers Batting' }))
    expect(batting.getByText('Aman Naidoo')).toBeInTheDocument()
    expect(batting.getByText('c Jo Rover b Sam Rover')).toBeInTheDocument()
    expect(batting.getByText('Teammate Two')).toBeInTheDocument()
    expect(batting.getByText('not out')).toBeInTheDocument()
    expect(innings[0]).toHaveTextContent('Did not bat: Late Order')
    expect(innings[0]).toHaveTextContent('Extras 8 (w 3, nb 1, b 2, lb 2)')
    const bowling = within(within(innings[0]).getByRole('table', { name: 'Villagers Bowling' }))
    expect(bowling.getByText('Sam Rover')).toBeInTheDocument()
    expect(bowling.getByText('5.0')).toBeInTheDocument()
    expect(innings[1]).toHaveTextContent('Rovers · 156/9 (40.0 ov)')
  })

  it('marks only the player\'s own rows and leaves out a bowling table with no bowlers', async () => {
    render({ [URL]: makeResultDetail({ innings: [makeInnings({ bowling: [] }), makeInnings({ sequence: 2, battingTeamName: 'Rovers', bowling: [{ name: 'Aman Naidoo', mine: true, overs: '4.0', maidens: 0, runs: 20, wickets: 1, wides: 0, noBalls: 0, dots: 0 }] })] }) })
    await screen.findByTestId('hub-result')
    const rows = screen.getAllByRole('row')
    expect(rows.filter((row) => row.getAttribute('data-mine') === 'true').map((row) => row.textContent)).toEqual([expect.stringContaining('Aman Naidoo'), expect.stringContaining('Aman Naidoo'), expect.stringContaining('Aman Naidoo')])
    expect(screen.queryByRole('table', { name: 'Villagers Bowling' })).not.toBeInTheDocument()
    expect(screen.getByRole('table', { name: 'Rovers Bowling' })).toBeInTheDocument()
  })

  it('lists the awards by name, naming the side of a team award', async () => {
    render({ [URL]: makeResultDetail() })
    const awards = await screen.findByTestId('hub-result-awards')
    expect(awards).toHaveTextContent('Player Of The Match: Aman Naidoo')
    expect(awards).toHaveTextContent('Team Player Of The Match, Rovers: Sam Rover')
  })

  it('has no awards section without awards', async () => {
    render({ [URL]: makeResultDetail({ awards: [] }) })
    await screen.findByTestId('hub-result')
    expect(screen.queryByTestId('hub-result-awards')).not.toBeInTheDocument()
  })

  it('says "This result is not available" for a 404 (a result that is not shown in the Player Hub)', async () => {
    render({ [URL]: httpError(404) })
    expect(await screen.findByTestId('hub-result-missing')).toHaveTextContent('This result is not available')
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument()
  })

  it('shows an error with Retry for any other failure, and Retry asks again', async () => {
    const user = userEvent.setup()
    let fail = true
    render({ [URL]: () => (fail ? httpError(500) : makeResultDetail()) })
    expect(await screen.findByText('We could not load this result. Please try again.')).toBeInTheDocument()
    fail = false
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByTestId('hub-result')).toBeInTheDocument()
  })

  it('names no "you" anywhere on the page', async () => {
    render({ [URL]: makeResultDetail() })
    const page = await screen.findByTestId('hub-result')
    expect(page.textContent).not.toMatch(/\byou(r)?\b/i)
  })
})
