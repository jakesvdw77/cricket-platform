import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Outlet, Route } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from '../../../api/axiosConfig'
import type { LinkRequest, PlayerAccount, PlayerLink } from '../../../api/playerAccountsApi'
import PlayerAccountsTab from './PlayerAccountsTab'
import { calls, renderRoutes, routeApi } from '../../../test/accountTestUtils'
import type { ApiMock } from '../../../test/accountTestUtils'

vi.mock('../../../api/axiosConfig', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }))

const http = api as unknown as ApiMock
const BASE = '/manage/clubs/c1'

function request(overrides: Partial<LinkRequest> = {}): LinkRequest {
  return {
    id: 'r1',
    requesterName: 'Priya Naidoo',
    requesterEmail: 'priya@example.com',
    contactNumber: '082 555 0100',
    typedFirstName: 'Aman',
    typedLastName: 'Naidoo',
    typedDateOfBirth: '2012-03-04',
    typedAge: 14,
    message: 'He plays for the Under 14s',
    createdAt: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
    suggestedPlayer: { playerId: 'p1', firstName: 'Aman', lastName: 'Naidoo', sectionName: 'Under 14', dateOfBirth: '2012-03-04', exactMatch: true, hasMainAgent: false },
    ...overrides,
  }
}

const account = (overrides: Partial<PlayerAccount> = {}): PlayerAccount => ({
  playerId: 'p1',
  firstName: 'Aman',
  lastName: 'Naidoo',
  sectionName: 'Under 14',
  mainAgentName: 'Priya Naidoo',
  mainAgentMaskedEmail: 'p***@example.com',
  otherAgentCount: 1,
  ...overrides,
})

const page = (content: PlayerAccount[]) => ({ content, totalElements: content.length, totalPages: 1, number: 0, size: 20 })

function routes(requests: LinkRequest[], extra: Record<string, unknown> = {}, accounts: PlayerAccount[] = []) {
  routeApi(http, {
    [`GET ${BASE}/link-requests`]: requests,
    [`GET ${BASE}/link-requests/summary`]: { waiting: requests.length },
    [`GET ${BASE}/player-accounts`]: page(accounts),
    [`GET ${BASE}/sections`]: [],
    [`GET ${BASE}/players`]: [],
    [`POST ${BASE}/link-requests/r1/approve`]: {},
    [`POST ${BASE}/link-requests/r1/decline`]: {},
    ...extra,
  })
}

const renderTab = () =>
  renderRoutes(
    '/manage/permissions/player-accounts',
    <Route element={<Outlet context={{ clubId: 'c1' }} />}>
      <Route path="/manage/permissions/player-accounts" element={<PlayerAccountsTab />} />
    </Route>,
  )

describe('PlayerAccountsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  describe('request cards', () => {
    it('shows the counter line from the summary, singular and plural', async () => {
      routes([request()])
      const first = renderTab()
      expect(await screen.findByTestId('link-requests-counter')).toHaveTextContent('1 link request waiting')
      first.unmount()

      routes([request(), request({ id: 'r2' })])
      renderTab()
      await waitFor(() => expect(screen.getByTestId('link-requests-counter')).toHaveTextContent('2 link requests waiting'))
    })

    it('makes the asked-about player the card title, with a Requested by block and the suggested match', async () => {
      routes([request()])
      renderTab()

      expect(await screen.findByRole('heading', { name: 'Aman Naidoo' })).toBeInTheDocument()
      expect(screen.getByText(/Born .*2012/)).toBeInTheDocument()
      const requester = within(screen.getByTestId('link-request-requester'))
      expect(requester.getByText('Requested by')).toBeInTheDocument()
      expect(requester.getByText('Priya Naidoo')).toBeInTheDocument()
      expect(requester.getByText('priya@example.com (verified)')).toBeInTheDocument()
      expect(requester.getByRole('link', { name: '082 555 0100' })).toHaveAttribute('href', 'tel:0825550100')
      expect(requester.getByText(/Waiting 3 days/)).toBeInTheDocument()
      const suggestion = within(screen.getByTestId('link-request-suggestion'))
      expect(suggestion.getByText('Suggested match')).toBeInTheDocument()
      expect(suggestion.getByText('Aman Naidoo, Under 14')).toBeInTheDocument()
      expect(suggestion.getByText('No main agent yet')).toBeInTheDocument()
      expect(suggestion.queryByRole('alert')).not.toBeInTheDocument()
      expect(screen.getByText('He plays for the Under 14s')).toBeInTheDocument()
    })

    it('warns on a name-only match whose stored date of birth differs from the one typed', async () => {
      routes([
        request({
          suggestedPlayer: { playerId: 'p1', firstName: 'Aman', lastName: 'Naidoo', sectionName: 'Under 14', dateOfBirth: '2011-03-04', exactMatch: false, hasMainAgent: true, mainAgentName: 'Someone Else' },
        }),
      ])
      renderTab()

      const suggestion = within(await screen.findByTestId('link-request-suggestion'))
      expect(suggestion.getByText(/Possible match: Aman Naidoo, Under 14, born/)).toBeInTheDocument()
      expect(suggestion.getByRole('alert')).toHaveTextContent('Date of birth differs from the request')
      expect(suggestion.getByText('Already has a main agent (Someone Else)')).toBeInTheDocument()
    })

    it('says so when there is no suggested player', async () => {
      routes([request({ suggestedPlayer: null })])
      renderTab()

      expect(await screen.findByText(/No matching player at your club/)).toBeInTheDocument()
    })

    it('shows the empty state with no waiting requests', async () => {
      routes([])
      renderTab()

      expect(await screen.findByText('No link requests waiting')).toBeInTheDocument()
    })
  })

  describe('approve', () => {
    it('needs an explicit confirm step and then sends confirm: true with the suggested player', async () => {
      const user = userEvent.setup()
      routes([request()])
      renderTab()

      await user.click(await screen.findByRole('button', { name: 'Approve' }))
      const dialog = await screen.findByRole('dialog', { name: 'Approve link request' })
      expect(within(dialog).getByRole('combobox', { name: 'Player' })).toHaveValue('Aman Naidoo')
      expect(calls(http.post, `${BASE}/link-requests/r1/approve`)).toHaveLength(0)

      await user.click(within(dialog).getByRole('button', { name: 'Next' }))
      const confirm = within(dialog).getByRole('group', { name: 'Confirm approval' })
      expect(confirm).toHaveTextContent('Link Priya Naidoo (priya@example.com) to Aman Naidoo.')
      expect(confirm).toHaveTextContent('They become the main agent.')
      expect(calls(http.post, `${BASE}/link-requests/r1/approve`)).toHaveLength(0)

      await user.click(within(dialog).getByRole('button', { name: 'Confirm and approve' }))

      await waitFor(() => expect(calls(http.post, `${BASE}/link-requests/r1/approve`)).toHaveLength(1))
      expect(calls(http.post, `${BASE}/link-requests/r1/approve`)[0][1]).toEqual({ playerId: 'p1', mainAgentMode: 'MAKE_MAIN', confirm: true })
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    })

    it('asks replace or add when the player already has a main agent, and sends the choice', async () => {
      const user = userEvent.setup()
      const links: PlayerLink[] = [{ linkId: 'l1', agentName: 'Sam Old', maskedEmail: 's***@example.com', main: true, status: 'ACTIVE', grantedVia: 'EMAIL_MATCH', since: '2026-01-01' }]
      routes(
        [request({ suggestedPlayer: { playerId: 'p1', firstName: 'Aman', lastName: 'Naidoo', exactMatch: true, hasMainAgent: true, mainAgentName: 'Sam Old' } })],
        { [`GET ${BASE}/players/p1/links`]: links },
      )
      renderTab()

      await user.click(await screen.findByRole('button', { name: 'Approve' }))
      const dialog = await screen.findByRole('dialog', { name: 'Approve link request' })
      expect(await within(dialog).findByText('Sam Old is already the main agent. What should happen?')).toBeInTheDocument()
      expect(within(dialog).getByRole('button', { name: 'Next' })).toBeDisabled()

      await user.click(within(dialog).getByRole('radio', { name: 'Add as another agent' }))
      await user.click(within(dialog).getByRole('button', { name: 'Next' }))
      expect(within(dialog).getByRole('group', { name: 'Confirm approval' })).toHaveTextContent('They are added as another agent. The current main agent stays.')
      await user.click(within(dialog).getByRole('button', { name: 'Confirm and approve' }))

      await waitFor(() => expect(calls(http.post, `${BASE}/link-requests/r1/approve`)).toHaveLength(1))
      expect(calls(http.post, `${BASE}/link-requests/r1/approve`)[0][1]).toEqual({ playerId: 'p1', mainAgentMode: 'ADD', confirm: true })
    })

    it('repeats the date of birth warning on the confirm step for a name-only match', async () => {
      const user = userEvent.setup()
      routes([request({ suggestedPlayer: { playerId: 'p1', firstName: 'Aman', lastName: 'Naidoo', dateOfBirth: '2011-03-04', exactMatch: false, hasMainAgent: false } })])
      renderTab()

      await user.click(await screen.findByRole('button', { name: 'Approve' }))
      const dialog = await screen.findByRole('dialog', { name: 'Approve link request' })
      await user.click(within(dialog).getByRole('button', { name: 'Next' }))

      expect(within(dialog).getByRole('alert')).toHaveTextContent('Date of birth differs from the request')
    })

    it('Back from the confirm step and Cancel send nothing', async () => {
      const user = userEvent.setup()
      routes([request()])
      renderTab()

      await user.click(await screen.findByRole('button', { name: 'Approve' }))
      const dialog = await screen.findByRole('dialog', { name: 'Approve link request' })
      await user.click(within(dialog).getByRole('button', { name: 'Next' }))
      await user.click(within(dialog).getByRole('button', { name: 'Back' }))
      expect(within(dialog).getByRole('combobox', { name: 'Player' })).toBeInTheDocument()
      await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
      expect(calls(http.post, `${BASE}/link-requests/r1/approve`)).toHaveLength(0)
    })

    it('New player and approve sends the typed details as a new player and makes the requester main agent', async () => {
      const user = userEvent.setup()
      routes([request({ suggestedPlayer: null })])
      renderTab()

      await user.click(await screen.findByRole('button', { name: 'New player and approve' }))
      const dialog = await screen.findByRole('dialog', { name: 'New player and approve' })
      const first = within(dialog).getByLabelText('First name')
      expect(first).toHaveValue('Aman')
      expect(within(dialog).getByLabelText('Date of birth')).toHaveValue('2012-03-04')
      await user.clear(first)
      await user.type(first, 'Amanpreet')
      await user.click(within(dialog).getByRole('button', { name: 'Next' }))
      expect(within(dialog).getByRole('group', { name: 'Confirm approval' })).toHaveTextContent('Create the player Amanpreet Naidoo')
      await user.click(within(dialog).getByRole('button', { name: 'Confirm and approve' }))

      await waitFor(() => expect(calls(http.post, `${BASE}/link-requests/r1/approve`)).toHaveLength(1))
      expect(calls(http.post, `${BASE}/link-requests/r1/approve`)[0][1]).toEqual({
        newPlayer: { firstName: 'Amanpreet', lastName: 'Naidoo', dateOfBirth: '2012-03-04' },
        mainAgentMode: 'MAKE_MAIN',
        confirm: true,
      })
    })

    it('shows an error and keeps the dialog open when the approval fails', async () => {
      const user = userEvent.setup()
      routes([request()], { [`POST ${BASE}/link-requests/r1/approve`]: new Error('409') })
      renderTab()

      await user.click(await screen.findByRole('button', { name: 'Approve' }))
      const dialog = await screen.findByRole('dialog', { name: 'Approve link request' })
      await user.click(within(dialog).getByRole('button', { name: 'Next' }))
      await user.click(within(dialog).getByRole('button', { name: 'Confirm and approve' }))

      expect(await within(dialog).findByText(/We could not approve this request/)).toBeInTheDocument()
    })
  })

  describe('decline', () => {
    it('sends the note the manager typed', async () => {
      const user = userEvent.setup()
      routes([request()])
      renderTab()

      await user.click(await screen.findByRole('button', { name: 'Decline' }))
      const dialog = await screen.findByRole('dialog', { name: 'Decline this request?' })
      await user.type(within(dialog).getByLabelText('Note (optional)'), 'We could not verify this')
      await user.click(within(dialog).getByRole('button', { name: 'Decline request' }))

      await waitFor(() => expect(calls(http.post, `${BASE}/link-requests/r1/decline`)).toHaveLength(1))
      expect(calls(http.post, `${BASE}/link-requests/r1/decline`)[0][1]).toEqual({ note: 'We could not verify this' })
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    })

    it('sends no note when none is typed, and Cancel declines nothing', async () => {
      const user = userEvent.setup()
      routes([request()])
      renderTab()

      await user.click(await screen.findByRole('button', { name: 'Decline' }))
      let dialog = await screen.findByRole('dialog', { name: 'Decline this request?' })
      await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
      expect(calls(http.post, `${BASE}/link-requests/r1/decline`)).toHaveLength(0)

      await user.click(screen.getByRole('button', { name: 'Decline' }))
      dialog = await screen.findByRole('dialog', { name: 'Decline this request?' })
      await user.click(within(dialog).getByRole('button', { name: 'Decline request' }))
      await waitFor(() => expect(calls(http.post, `${BASE}/link-requests/r1/decline`)).toHaveLength(1))
      expect(calls(http.post, `${BASE}/link-requests/r1/decline`)[0][1]).toEqual({})
    })
  })

  describe('Players and their main agent', () => {
    it('lists each player with the masked main agent email, and flags No main agent', async () => {
      routes([], {}, [account(), account({ playerId: 'p2', firstName: 'Zane', lastName: 'Botha', mainAgentName: null, mainAgentMaskedEmail: null, otherAgentCount: 0 })])
      renderTab()

      expect(await screen.findByText('Showing 2 players')).toBeInTheDocument()
      expect(screen.getByText('Priya Naidoo (p***@example.com)')).toBeInTheDocument()
      expect(screen.getAllByText('No main agent').length).toBeGreaterThan(0)
      expect(screen.getAllByRole('button', { name: 'Manage agents' })).toHaveLength(2)
    })

    it('asks the backend for only players without a main agent when the filter is on, and saves it per club', async () => {
      const user = userEvent.setup()
      routes([], {}, [account()])
      renderTab()
      await screen.findByText('Showing 1 player')

      await user.click(screen.getAllByRole('checkbox', { name: 'No main agent' })[0])

      await waitFor(() => expect(http.get).toHaveBeenCalledWith(`${BASE}/player-accounts`, { params: { page: 0, noMainAgent: true } }))
      await waitFor(() => expect(screen.getAllByRole('checkbox', { name: 'No main agent' })[0]).toBeChecked())
      expect(localStorage.getItem('playerAccounts:filters:c1')).toContain('"noMainAgent":true')
    })

    it('sends the search as a backend parameter', async () => {
      const user = userEvent.setup()
      routes([], {}, [account()])
      renderTab()
      await screen.findByText('Showing 1 player')

      await user.type(screen.getByLabelText('Search'), 'Naid')

      await waitFor(() => expect(http.get).toHaveBeenCalledWith(`${BASE}/player-accounts`, { params: { page: 0, search: 'Naid' } }))
    })

    it('Manage agents opens the shared agent actions for that player', async () => {
      const user = userEvent.setup()
      routes([], { [`GET ${BASE}/players/p1/links`]: [] }, [account()])
      renderTab()

      await user.click(await screen.findByRole('button', { name: 'Manage agents' }))

      const dialog = await screen.findByRole('dialog', { name: 'Agents for Aman Naidoo' })
      expect(await within(dialog).findByText('No agents are linked to Aman Naidoo.')).toBeInTheDocument()
    })
  })
})
