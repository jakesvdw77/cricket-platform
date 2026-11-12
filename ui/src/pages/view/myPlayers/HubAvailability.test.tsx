import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from '../../../api/axiosConfig'
import type { MyClosedPolls, MyPollHistoryRow, MyPollResponses } from '../../../api/meAvailabilityApi'
import { HubAvailability } from './HubAvailability'
import { calls, httpError, newQueryClient, routeApi } from '../../../test/accountTestUtils'
import type { ApiMock } from '../../../test/accountTestUtils'
import { LocationProbe } from '../../../test/LocationProbe'

vi.mock('../../../api/axiosConfig', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }))

// Player Hub Availability: Open / Closed / My Responses pills, status chips, season dropdown, summary tiles. All figures come from the server.
const http = api as unknown as ApiMock

const row = (overrides: Partial<MyPollHistoryRow> = {}): MyPollHistoryRow => ({
  pollId: 'p1', kind: 'SQUAD', title: 'Squad poll', teamName: 'Riverside U15 A', matchDate: null, homeName: 'Riverside U15 A', awayName: 'Coastal U15',
  venue: 'Riverside Oval', windowDate: null, open: false, closedAt: null, answers: [{ windowId: null, label: null, status: 'AVAILABLE' }], answered: true, selected: null, ...overrides,
})
const closed = (rows: MyPollHistoryRow[] = [row()], total = rows.length): MyClosedPolls => ({ sinceDays: 30, total, rows })
const responses = (rows: MyPollHistoryRow[] = [row()], overrides: Partial<MyPollResponses> = {}): MyPollResponses => ({
  scope: { seasonId: 's1' },
  seasons: [{ id: 's1', label: '2026/27' }, { id: 's0', label: '2025/26' }],
  currentSeasonId: 's1',
  summary: { polls: 5, answered: 3, available: 2, unavailable: 1, notSure: 0, notAnswered: 2 },
  rows,
  ...overrides,
})

function renderAvailability(routes: Record<string, unknown>, entry = '/availability') {
  routeApi(http, { 'GET /me/players/k1/polls': [], ...routes })
  return render(
    <QueryClientProvider client={newQueryClient()}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/availability" element={<><HubAvailability playerKey="k1" playerName="Sam" /><LocationProbe /></>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => vi.clearAllMocks())

describe('HubAvailability', () => {
  it('opens on Open Polls and shows the three pills with the server counts', async () => {
    renderAvailability({ 'GET /me/players/k1/polls/closed': closed([row()], 4), 'GET /me/players/k1/polls/responses': responses() })

    const nav = screen.getByRole('navigation', { name: 'Availability' })
    expect(await within(nav).findByRole('button', { name: /Closed Polls/ })).toHaveTextContent('4')
    expect(within(nav).getByRole('button', { name: /Open Polls/ })).toHaveAttribute('aria-current', 'page')
    expect(within(nav).getByRole('button', { name: /My Responses/ })).toHaveTextContent('5')
    expect(screen.getByText('No open availability polls for Sam right now.')).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Season' })).not.toBeInTheDocument()
  })

  it('keeps the chosen pill in the URL with replace and clears the status when the pill changes', async () => {
    renderAvailability({ 'GET /me/players/k1/polls/closed': closed(), 'GET /me/players/k1/polls/responses': responses() }, '/availability?tab=responses&status=AVAILABLE')

    await userEvent.click(screen.getByRole('button', { name: /Closed Polls/ }))

    expect(screen.getByTestId('location')).toHaveTextContent('/availability?tab=closed')
    expect(screen.getByTestId('location')).not.toHaveTextContent('status=')
  })

  it('treats an unknown tab or status in the URL as the defaults', async () => {
    renderAvailability({ 'GET /me/players/k1/polls/closed': closed(), 'GET /me/players/k1/polls/responses': responses() }, '/availability?tab=nonsense&status=BOGUS')

    expect(screen.getByRole('button', { name: /Open Polls/ })).toHaveAttribute('aria-current', 'page')
    await screen.findByRole('button', { name: /Closed Polls/ })
  })

  describe('Closed Polls', () => {
    it('lists closed polls read only, with the 30 day request and no Selected chip before the club announces', async () => {
      renderAvailability({ 'GET /me/players/k1/polls/closed': closed([row({ closedAt: '2026-11-05T10:00:00Z' })]), 'GET /me/players/k1/polls/responses': responses() }, '/availability?tab=closed')

      const card = await screen.findByTestId('history-card')
      expect(within(card).getByRole('heading', { name: 'Riverside U15 A v Coastal U15' })).toBeInTheDocument()
      expect(within(card).getByTestId('answer-chip')).toHaveTextContent('Available')
      expect(within(card).queryByTestId('outcome-chip')).not.toBeInTheDocument()
      expect(calls(http.get, '/me/players/k1/polls/closed')[0][1].params).toEqual({ sinceDays: 30 })
      expect(screen.queryByRole('combobox', { name: 'Season' })).not.toBeInTheDocument()
    })

    it('shows the empty state, and a different one when a status filter is on', async () => {
      renderAvailability({ 'GET /me/players/k1/polls/closed': closed([]), 'GET /me/players/k1/polls/responses': responses() }, '/availability?tab=closed')

      expect(await screen.findByTestId('closed-none')).toHaveTextContent('None closed in the last 30 days')
      await userEvent.click(screen.getByRole('button', { name: 'Unavailable' }))
      expect(await screen.findByText('No closed polls with this answer in the last 30 days')).toBeInTheDocument()
    })

    it('shows an error with Retry that reads again', async () => {
      let fail = true
      renderAvailability({ 'GET /me/players/k1/polls/closed': () => (fail ? httpError(500) : closed()), 'GET /me/players/k1/polls/responses': responses() }, '/availability?tab=closed')

      expect(await screen.findByText('We could not load the availability polls. Please try again.')).toBeInTheDocument()
      fail = false
      await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
      expect(await screen.findByTestId('history-card')).toBeInTheDocument()
    })
  })

  describe('My Responses', () => {
    const open = (entry = '/availability?tab=responses', rows: MyPollHistoryRow[] = [row()]) =>
      renderAvailability({ 'GET /me/players/k1/polls/closed': closed(), 'GET /me/players/k1/polls/responses': responses(rows) }, entry)

    it('shows the summary tiles and the Season dropdown, only on this pill', async () => {
      open()

      const tiles = await screen.findByTestId('availability-responses')
      const figure = (label: string) => within(tiles).getAllByText(label).find((el) => el.previousSibling?.nodeName === 'B')?.previousSibling?.textContent
      expect(figure('Answered')).toBe('3/5')
      expect(figure('Available')).toBe('2')
      expect(figure('Unavailable')).toBe('1')
      expect(figure('Not answered')).toBe('2')
      expect(screen.getByRole('combobox')).toHaveTextContent('2026/27')
    })

    it('writes the chosen season to ?season= and reads again for it', async () => {
      open()
      await screen.findByTestId('availability-responses')

      await userEvent.click(screen.getByRole('combobox'))
      await userEvent.click(await screen.findByRole('option', { name: '2025/26' }))

      expect(screen.getByTestId('location')).toHaveTextContent('season=s0')
      expect(calls(http.get, '/me/players/k1/polls/responses').some((call) => call[1].params?.seasonId === 's0')).toBe(true)
    })

    it('puts a status chip in the URL, marks it pressed and asks the server for that status', async () => {
      open()
      await screen.findByTestId('availability-responses')

      await userEvent.click(screen.getByRole('button', { name: 'Not Answered' }))

      expect(screen.getByTestId('location')).toHaveTextContent('status=NOT_ANSWERED')
      expect(screen.getByRole('button', { name: 'Not Answered' })).toHaveAttribute('aria-pressed', 'true')
      expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false')
      expect(calls(http.get, '/me/players/k1/polls/responses').some((call) => call[1].params?.status === 'NOT_ANSWERED')).toBe(true)
    })

    it('has the five status chips in order and All clears the status', async () => {
      open('/availability?tab=responses&status=UNSURE')
      await screen.findByTestId('availability-responses')

      const group = screen.getByRole('group', { name: 'Status' })
      expect(within(group).getAllByRole('button').map((b) => b.textContent)).toEqual(['All', 'Available', 'Unavailable', 'Not Sure', 'Not Answered'])
      await userEvent.click(within(group).getByRole('button', { name: 'All' }))
      expect(screen.getByTestId('location')).not.toHaveTextContent('status=')
    })

    it('labels each window of a group poll with its own answer, and shows Not Answered for a poll with none', async () => {
      open('/availability?tab=responses', [
        row({ pollId: 'g1', kind: 'GROUP', title: 'Winter nets', homeName: null, awayName: null, windowDate: ['2026-11-14'], answers: [
          { windowId: 'w1', label: 'Saturday morning', status: 'AVAILABLE' },
          { windowId: 'w2', label: 'Sunday morning', status: 'UNSURE' },
        ] }),
        row({ pollId: 'p2', answers: [], answered: false }),
      ])

      const [group, none] = await screen.findAllByTestId('history-card')
      expect(within(group).getByRole('heading', { name: 'Winter nets' })).toBeInTheDocument()
      expect(within(group).getByText('Saturday morning').nextSibling).toHaveTextContent('Available')
      expect(within(group).getByText('Sunday morning').nextSibling).toHaveTextContent('Not Sure')
      expect(within(none).getByTestId('answer-chip')).toHaveTextContent('Not Answered')
    })

    it('shows Selected and Not Selected only once the club has announced, and Open for a poll still open', async () => {
      open('/availability?tab=responses', [
        row({ pollId: 'a', selected: true }),
        row({ pollId: 'b', selected: false }),
        row({ pollId: 'c', selected: null, open: true }),
        row({ pollId: 'd', selected: null }),
      ])

      const cards = await screen.findAllByTestId('history-card')
      expect(within(cards[0]).getByTestId('outcome-chip')).toHaveTextContent(/^Selected$/)
      expect(within(cards[1]).getByTestId('outcome-chip')).toHaveTextContent(/^Not Selected$/)
      expect(within(cards[2]).getByTestId('outcome-chip')).toHaveTextContent(/^Open$/)
      expect(within(cards[3]).queryByTestId('outcome-chip')).not.toBeInTheDocument()
    })

    it('shows the empty state naming the player, and the filtered one', async () => {
      open('/availability?tab=responses', [])

      expect(await screen.findByTestId('responses-none')).toHaveTextContent('No availability polls this season for Sam')
      await userEvent.click(screen.getByRole('button', { name: 'Available' }))
      expect(await screen.findByText('No polls with this answer this season')).toBeInTheDocument()
    })

    it('shows an error with Retry', async () => {
      renderAvailability({ 'GET /me/players/k1/polls/closed': closed(), 'GET /me/players/k1/polls/responses': httpError(500) }, '/availability?tab=responses')

      expect(await screen.findByText('We could not load the availability polls. Please try again.')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
    })
  })
})
