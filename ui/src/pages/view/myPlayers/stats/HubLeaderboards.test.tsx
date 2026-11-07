import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from '../../../../api/axiosConfig'
import { HubLeaderboards } from './HubLeaderboards'
import { calls, httpError } from '../../../../test/accountTestUtils'
import type { ApiMock } from '../../../../test/accountTestUtils'
import { KEY, boardRow, makeBoardTable, makeBoardsFilters, makeMyAwards, makeResultFilters, makeStanding } from '../../../../test/statsFixtures'
import { filtersWithOneChoice, renderStatsPage } from '../../../../test/statsPageTestUtils'

vi.mock('../../../../api/axiosConfig', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }))

// docs/specs/147 Test Plan, Component: Leaderboards. The "Where Sam stands" card first, then the Batting, Bowling, Fielding tables and Awards.
// Sort by, heading taps and reverse, More Columns, the viewer's own row, Jump to, Show More, the minimum note, and Awards before the season ends.
vi.setConfig({ testTimeout: 20000 })
const http = api as unknown as ApiMock
const base = `/me/players/${KEY}/leaderboards`
const ROUTES = {
  [`GET /me/players/${KEY}/leaderboards/filters`]: makeBoardsFilters(),
  [`GET /me/players/${KEY}/results/filters`]: filtersWithOneChoice(),
  [`GET ${base}/standing`]: makeStanding(),
  [`GET ${base}/batting`]: makeBoardTable(),
  [`GET ${base}/awards`]: makeMyAwards(),
}
const render = (routes: Record<string, unknown> = {}, entry = '/stats') => renderStatsPage(http, <HubLeaderboards playerKey={KEY} />, { ...ROUTES, ...routes }, entry)
const batting = () => calls(http.get, `${base}/batting`)
const table = () => screen.findByRole('table', { name: 'batting leaderboard' })

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  Element.prototype.scrollIntoView = vi.fn()
})

describe('HubLeaderboards states', () => {
  it('shows skeletons while the reach loads', () => {
    render({ [`GET /me/players/${KEY}/leaderboards/filters`]: () => new Promise(() => undefined) })
    expect(screen.getByTestId('hub-boards-loading')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Leaderboards' })).toBeInTheDocument()
  })

  it('shows an error with Retry, and the cards after it', async () => {
    const user = userEvent.setup()
    let fail = true
    render({ [`GET /me/players/${KEY}/leaderboards/filters`]: () => (fail ? httpError(500) : makeBoardsFilters()) })
    expect(await screen.findByText('We could not load the leaderboards. Please try again.')).toBeInTheDocument()
    fail = false
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByTestId('hub-boards-standing')).toBeInTheDocument()
  })

  it('shows "No stats yet" in place of the table when nothing is counted and no season is chosen', async () => {
    const none = makeBoardTable({ basis: { ...makeBoardTable().basis, resultsCounted: 0 }, rows: [], me: null })
    render({ [`GET ${base}/batting`]: none, [`GET ${base}/standing`]: makeStanding({ resultsCounted: 0 }) }, '/stats?season=all&team=t1')
    expect(await screen.findByTestId('hub-boards-filtered-empty')).toHaveTextContent('No matches for this filter')
    expect(screen.queryByTestId('hub-boards-standing')).not.toBeInTheDocument()
  })

  it('shows plain "No stats yet" with nothing narrowed at all', async () => {
    const none = makeBoardTable({ basis: { ...makeBoardTable().basis, resultsCounted: 0 }, rows: [], me: null })
    render({ [`GET ${base}/batting`]: none, [`GET ${base}/standing`]: makeStanding({ resultsCounted: 0 }), [`GET /me/players/${KEY}/results/filters`]: makeResultFilters({ combos: [], teams: [] }) }, '/stats?season=all')
    expect(await screen.findByTestId('hub-boards-empty')).toBeInTheDocument()
  })
})

describe('HubLeaderboards standing and tabs', () => {
  it('puts the Where the player stands card first with eight tiles, then the Batting table', async () => {
    render()
    const standing = await screen.findByTestId('hub-boards-standing')
    expect(within(standing).getByRole('heading', { name: 'Where Aman stands' })).toBeInTheDocument()
    expect(within(standing).getAllByRole('listitem')).toHaveLength(8)
    await table()
    expect(standing.compareDocumentPosition(screen.getByTestId('hub-boards-table')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('defaults to the player\'s current team in the address and asks for it', async () => {
    render()
    await table()
    // The very first table and standing requests already carry the team: nothing unfiltered is asked for and then replaced.
    expect(batting()).toHaveLength(1)
    expect(batting()[0][1].params).toMatchObject({ seasonId: 's1', teamId: 't1', page: 0 })
    expect(calls(http.get, `${base}/standing`)).toHaveLength(1)
    expect(calls(http.get, `${base}/standing`)[0][1].params).toEqual({ seasonId: 's1', teamId: 't1' })
  })

  it('switches tab through the pills and writes it to the address, dropping a sort', async () => {
    const user = userEvent.setup()
    const bowling = makeBoardTable({ group: 'BOWLING' })
    render({ [`GET ${base}/bowling`]: bowling }, '/stats?sort=runs&dir=asc')
    await table()
    await user.click(screen.getByRole('button', { name: 'Bowling' }))
    expect(await screen.findByRole('table', { name: 'bowling leaderboard' })).toBeInTheDocument()
    expect(calls(http.get, `${base}/bowling`)[0][1].params).not.toHaveProperty('sort')
  })

  it('shows the server\'s sentence on Awards while the season runs', async () => {
    const user = userEvent.setup()
    render({ [`GET ${base}/awards`]: makeMyAwards({ revealed: false, reason: 'SEASON_NOT_ENDED', message: 'Awards are revealed when the season ends.', seasonEndDate: '2026-04-30', categories: [] }) })
    await screen.findByTestId('hub-boards-standing')
    await user.click(screen.getByRole('button', { name: 'Awards' }))
    const held = await screen.findByTestId('hub-boards-awards-held')
    expect(held).toHaveTextContent('Awards are revealed when the season ends.')
    expect(held).toHaveTextContent('The season ends on 30 April 2026.')
  })

  it('shows the category leaders once the season has ended, with the viewer marked', async () => {
    const user = userEvent.setup()
    render()
    await screen.findByTestId('hub-boards-standing')
    await user.click(screen.getByRole('button', { name: 'Awards' }))
    const award = await screen.findByTestId('hub-award-MOST_RUNS')
    expect(within(award).getByText(/Sam Naidoo/)).toBeInTheDocument()
    expect(award.querySelector('[aria-current="true"]')).not.toBeNull()
  })
})

describe('BoardTable', () => {
  it('draws a real table with the rank, the player and the columns, and marks the viewer\'s row', async () => {
    render()
    const grid = await table()
    expect(within(grid).getAllByRole('columnheader').map((head) => head.textContent)).toEqual(['#', 'Player', 'Runs', 'Avg'])
    const mine = screen.getByTestId('hub-boards-mine')
    expect(mine).toHaveAttribute('aria-current', 'true')
    expect(mine).toHaveTextContent('Sam Naidoo')
    expect(within(mine).getByText('(This player)')).toBeInTheDocument()
    expect(screen.getAllByTestId('hub-boards-row')).toHaveLength(3)
  })

  it('sets aria-sort on the sorted column only, and shows the divider and the small-sample mark before the unranked group', async () => {
    render()
    await table()
    expect(screen.getByRole('columnheader', { name: /Runs/ })).toHaveAttribute('aria-sort', 'descending')
    expect(screen.getByRole('columnheader', { name: /Avg/ })).toHaveAttribute('aria-sort', 'none')
    expect(screen.getByText('Not ranked: below the minimum, or no figure for this sort yet')).toBeInTheDocument()
    expect(screen.getByText('Small sample')).toBeInTheDocument()
  })

  it('sorts by another column on a heading tap, then reverses on a second tap', async () => {
    const user = userEvent.setup()
    render({}, '/stats?team=t1')
    await table()
    await user.click(screen.getByRole('button', { name: 'Sort by Batting average' }))
    await waitFor(() => expect(batting().at(-1)?.[1].params).toMatchObject({ sort: 'average' }))
    expect(batting().at(-1)?.[1].params).not.toHaveProperty('direction')
  })

  it('asks for the opposite order when the sorted column is tapped again', async () => {
    const user = userEvent.setup()
    render({}, '/stats?team=t1')
    await table()
    await user.click(screen.getByRole('button', { name: 'Sort by Runs scored' }))
    await waitFor(() => expect(batting().at(-1)?.[1].params).toMatchObject({ sort: 'runs', direction: 'asc' }))
  })

  it('sorts from the Sort by select', async () => {
    const user = userEvent.setup()
    render({}, '/stats?team=t1')
    await table()
    await user.click(screen.getByRole('combobox', { name: 'Sort by' }))
    await user.click(screen.getByRole('option', { name: 'Batting average' }))
    await waitFor(() => expect(batting().at(-1)?.[1].params).toMatchObject({ sort: 'average' }))
  })

  it('folds the More Columns behind a toggle', async () => {
    const user = userEvent.setup()
    render()
    await table()
    expect(screen.queryByRole('columnheader', { name: /4s/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'More Columns' }))
    expect(screen.getByRole('columnheader', { name: /4s/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'More Columns' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('jumps to the viewer\'s own row and focuses it', async () => {
    const user = userEvent.setup()
    render()
    await table()
    await user.click(screen.getByRole('button', { name: 'Jump to Aman' }))
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled()
    expect(screen.getByTestId('hub-boards-mine')).toHaveFocus()
  })

  it('asks the server for the next page on Show More and appends the rows', async () => {
    const user = userEvent.setup()
    const first = makeBoardTable({ page: { number: 0, size: 25, totalElements: 5, hasMore: true } })
    const second = makeBoardTable({ rows: [boardRow(4, 'Cat'), boardRow(5, 'Dan')], me: null, page: { number: 1, size: 25, totalElements: 5, hasMore: false } })
    render({ [`GET ${base}/batting`]: (request: { config?: { params?: Record<string, unknown> } }) => (request.config?.params?.page === 1 ? second : first) })
    await table()
    await user.click(screen.getByRole('button', { name: 'Show More' }))
    expect(await screen.findByText(/Cat Player/)).toBeInTheDocument()
    expect(screen.getByText(/Ann Player/)).toBeInTheDocument()
    expect(batting().at(-1)?.[1].params).toMatchObject({ page: 1 })
    expect(screen.queryByRole('button', { name: 'Show More' })).not.toBeInTheDocument()
  })

  it('writes the basis and, for a rate sort, the minimum note and a minimum field with the suggested default', async () => {
    render({ [`GET ${base}/batting`]: makeBoardTable({ sort: { code: 'average', direction: 'HIGHEST' } }) })
    await table()
    const notes = screen.getByTestId('hub-boards-notes')
    expect(notes).toHaveTextContent('Based on 12 results.')
    expect(notes).toHaveTextContent('Players below the minimum are listed after the ranked players.')
    expect(screen.getByLabelText('Minimum innings (optional)')).toBeInTheDocument()
    expect(screen.getByText('Suggested for this scope: 3.')).toBeInTheDocument()
  })

  it('names nobody when the table is empty for the scope, and offers no row link, share or download', async () => {
    render({ [`GET ${base}/batting`]: makeBoardTable({ rows: [], me: null }) })
    expect(await screen.findByTestId('hub-boards-nobody')).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /share|copy|download|export/i })).not.toBeInTheDocument()
  })

  it('shows an error with Retry for a table that fails', async () => {
    const user = userEvent.setup()
    let fail = true
    render({ [`GET ${base}/batting`]: () => (fail ? httpError(500) : makeBoardTable()) })
    expect(await screen.findByText('We could not load this table. Please try again.')).toBeInTheDocument()
    fail = false
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await table()).toBeInTheDocument()
  })
})

describe('HubLeaderboards scope controls', () => {
  it('always shows Filters and the Season dropdown', async () => {
    render()
    await table()
    expect(screen.getByRole('button', { name: /^Filters/ })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Season' })).toBeInTheDocument()
  })
})
