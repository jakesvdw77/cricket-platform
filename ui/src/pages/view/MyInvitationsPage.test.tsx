import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from '../../api/axiosConfig'
import type { MyInvitation } from '../../api/meApi'
import MyInvitationsPage from './MyInvitationsPage'
import { calls, httpError, renderRoutes, routeApi } from '../../test/accountTestUtils'
import type { ApiMock } from '../../test/accountTestUtils'

vi.mock('../../auth/keycloak', () => ({ keycloak: { tokenParsed: { name: 'Priya Naidoo' }, logout: vi.fn() } }))
vi.mock('../../api/axiosConfig', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }))

// docs/specs/119 slice 4: accepting an invitation that makes you the main agent asks for a confirm first, inside the tile.
const http = api as unknown as ApiMock
const invitation = (overrides: Partial<MyInvitation> = {}): MyInvitation => ({
  linkId: 'l1',
  playerName: 'Zane Botha',
  clubName: 'Riverside CC',
  invitedByName: 'Sam Smith',
  makeMain: false,
  expiresAt: '2026-11-06T10:00:00Z',
  ...overrides,
})

function setup(invitations: MyInvitation[], extra: Record<string, unknown> = {}) {
  routeApi(http, {
    'GET /me/invitations': invitations,
    'POST /me/links/l1/accept': {},
    'POST /me/links/l1/decline': {},
    'POST /me/activate': { personId: 'p1', personStatus: 'ACTIVE', platformAdmin: false, clubAdminClubIds: [] },
    'GET /me/profiles': [],
    ...extra,
  })
  return renderRoutes('/account/invitations', <Route path="/account/invitations" element={<MyInvitationsPage />} />)
}

beforeEach(() => vi.clearAllMocks())

describe('MyInvitationsPage', () => {
  it('shows who invited you to manage which player, and when it expires', async () => {
    setup([invitation()])

    const tile = await screen.findByTestId('invitation-tile')
    expect(within(tile).getByText('Zane Botha')).toBeInTheDocument()
    expect(within(tile).getByText('Riverside CC · Invited by Sam Smith')).toBeInTheDocument()
    expect(within(tile).getByText(/Expires/)).toBeInTheDocument()
    expect(within(tile).queryByText('This will make you the main agent')).not.toBeInTheDocument()
  })

  it('accepts an ordinary invitation straight away', async () => {
    setup([invitation()])

    await userEvent.click(await screen.findByRole('button', { name: 'Accept' }))

    await waitFor(() => expect(calls(http.post, '/me/links/l1/accept')).toHaveLength(1))
  })

  it('declines an invitation', async () => {
    setup([invitation()])

    await userEvent.click(await screen.findByRole('button', { name: 'Decline' }))

    await waitFor(() => expect(calls(http.post, '/me/links/l1/decline')).toHaveLength(1))
    expect(calls(http.post, '/me/links/l1/accept')).toHaveLength(0)
  })

  it('a hand over says it will make you main agent and asks for a confirm before accepting', async () => {
    const user = userEvent.setup()
    setup([invitation({ makeMain: true })])

    expect(await screen.findByText('This will make you the main agent')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Accept' }))

    const confirm = screen.getByRole('alert')
    expect(confirm).toHaveTextContent('Accept and become the main agent for Zane Botha?')
    expect(calls(http.post, '/me/links/l1/accept')).toHaveLength(0)

    await user.click(within(confirm).getByRole('button', { name: 'Not now' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(calls(http.post, '/me/links/l1/accept')).toHaveLength(0)

    await user.click(screen.getByRole('button', { name: 'Accept' }))
    await user.click(within(screen.getByRole('alert')).getByRole('button', { name: 'Yes, accept' }))
    await waitFor(() => expect(calls(http.post, '/me/links/l1/accept')).toHaveLength(1))
  })

  it('explains a failure such as an expired invitation', async () => {
    setup([invitation()], { 'POST /me/links/l1/accept': httpError(410) })

    await userEvent.click(await screen.findByRole('button', { name: 'Accept' }))

    expect(await screen.findByText('We could not do that. The invitation may have expired or been cancelled.')).toBeInTheDocument()
  })

  it('shows the empty state and Back to players', async () => {
    setup([])

    expect(await screen.findByText('No invitations waiting.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Back to players' }))
    expect(await screen.findByTestId('location')).toHaveTextContent('/account')
  })

  it('shows an error when the invitations cannot be loaded', async () => {
    setup([], { 'GET /me/invitations': httpError(500) })

    expect(await screen.findByText('We could not load your invitations. Please try again later.')).toBeInTheDocument()
  })
})
