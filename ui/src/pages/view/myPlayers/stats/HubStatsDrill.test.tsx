import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from '../../../../api/axiosConfig'
import { HubStatsDrill } from './HubStatsDrill'
import { calls, httpError } from '../../../../test/accountTestUtils'
import type { ApiMock } from '../../../../test/accountTestUtils'
import { KEY, drillPage, drillRow } from '../../../../test/statsFixtures'
import { renderStatsPage } from '../../../../test/statsPageTestUtils'

vi.mock('../../../../api/axiosConfig', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }))

// docs/specs/147 Test Plan: the drill sub-view. The kind and filter are the server's tokens from the address; Show More asks the server for the next
// page; a row opens the Hub Result page with the stats origin and the scope, so the footer Back returns to the same stats page.
vi.setConfig({ testTimeout: 20000 })
const http = api as unknown as ApiMock
const INNINGS = `GET /me/players/${KEY}/stats/innings`
const ENTRY = '/stats?kind=BATTING&filter=BAND_50&season=s1&team=t1'
const render = (routes: Record<string, unknown>, entry = ENTRY) => renderStatsPage(http, <HubStatsDrill playerKey={KEY} />, routes, entry)
const drillCalls = () => calls(http.get, `/me/players/${KEY}/stats/innings`)

beforeEach(() => vi.clearAllMocks())

describe('HubStatsDrill', () => {
  it('shows skeletons while loading', () => {
    render({ [INNINGS]: () => new Promise(() => undefined) })
    expect(screen.getByTestId('hub-stats-drill-loading')).toBeInTheDocument()
  })

  it('shows an error with Retry that asks again', async () => {
    const user = userEvent.setup()
    let fail = true
    render({ [INNINGS]: () => (fail ? httpError(500) : drillPage([drillRow(1)], 0, false)) })
    expect(await screen.findByText('We could not load these innings. Please try again.')).toBeInTheDocument()
    fail = false
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByTestId('hub-stats-drill-list')).toBeInTheDocument()
  })

  it('shows a quiet empty state when no row matches the figure', async () => {
    render({ [INNINGS]: drillPage([], 0, false) })
    expect(await screen.findByTestId('hub-stats-drill-empty')).toHaveTextContent('Nothing here yet')
  })

  it('asks the server for the kind, filter and scope from the address and shows the heading, the filter and the count', async () => {
    render({ [INNINGS]: drillPage([drillRow(1), drillRow(2)], 0, false, 2) })
    expect(await screen.findByRole('heading', { name: 'Batting Innings' })).toBeInTheDocument()
    expect(await screen.findByText('Scores of 50 or more')).toBeInTheDocument()
    expect(await screen.findByTestId('hub-stats-drill-count')).toHaveTextContent('2 rows. Tap a row to open that match.')
    expect(drillCalls()[0][1]).toEqual({ params: { kind: 'BATTING', filter: 'BAND_50', seasonId: 's1', teamId: 't1', page: 0, size: 20 } })
  })

  it('writes each row\'s figures as words and links it to the Hub Result page with the stats origin and the scope', async () => {
    render({ [INNINGS]: drillPage([drillRow(1)], 0, false, 1) })
    const link = await screen.findByRole('link', { name: /Open the match/ })
    expect(link.getAttribute('href')).toBe(`/account/players/${KEY}/results/m1?season=s1&team=t1&origin=stats`)
    const row = link.closest('li') as HTMLElement
    expect(row).toHaveTextContent('U14 A')
    expect(row).toHaveTextContent('41 off 50 balls')
    expect(row).toHaveTextContent('4 fours, 1 sixes')
    expect(row).toHaveTextContent('SR 82.0')
  })

  it('says when the history is cut to the newest matches', async () => {
    render({ [INNINGS]: drillPage([drillRow(1)], 0, false, 1, { truncated: true }) })
    expect(await screen.findByTestId('hub-stats-drill-count')).toHaveTextContent('from the newest matches only')
  })

  it('asks the server for the next page on Show More and appends its rows; the button goes when there are no more', async () => {
    const user = userEvent.setup()
    const first = drillPage([drillRow(1), drillRow(2)], 0, true, 3)
    const second = drillPage([drillRow(3)], 1, false, 3)
    render({ [INNINGS]: (request: { config?: { params?: Record<string, unknown> } }) => (request.config?.params?.page === 1 ? second : first) })
    const list = await screen.findByTestId('hub-stats-drill-list')
    expect(within(list).getAllByRole('listitem')).toHaveLength(2)
    await user.click(screen.getByRole('button', { name: 'Show More' }))
    expect(await within(screen.getByTestId('hub-stats-drill-list')).findAllByRole('listitem')).toHaveLength(3)
    expect(drillCalls().at(-1)?.[1].params).toMatchObject({ page: 1, size: 20, kind: 'BATTING', filter: 'BAND_50' })
    expect(screen.queryByRole('button', { name: 'Show More' })).not.toBeInTheDocument()
  })

  it('draws a bowling spell and a fielding row from their own blocks, and an unknown kind falls back to batting', async () => {
    const spell = drillRow(1, { batting: null, bowling: { balls: 30, ballsPerOver: 6, maidens: 1, runs: 21, wickets: 2, economy: 4.2, wides: 3, noBalls: null, dots: null }, fielding: { catches: 2, stumpings: 0, runOuts: 1 } })
    render({ [INNINGS]: drillPage([spell], 0, false, 1, { kind: 'BOWLING' }) }, '/stats?kind=BOWLING&season=all')
    const row = (await screen.findByRole('link', { name: /Open the match/ })).closest('li') as HTMLElement
    expect(row).toHaveTextContent('2/21 in 5 overs')
    expect(row).toHaveTextContent('economy 4.20')
    expect(row).toHaveTextContent('3 wides')
    expect(row).toHaveTextContent('2 catches, 1 run-out, 0 stumpings')
    expect(screen.getByRole('heading', { name: 'Bowling Spells' })).toBeInTheDocument()
  })
})
