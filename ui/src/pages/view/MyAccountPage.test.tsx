import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import api from '../../api/axiosConfig'
import MyAccountPage from './MyAccountPage'
import { renderRoutes, routeApi } from '../../test/accountTestUtils'
import type { ApiMock } from '../../test/accountTestUtils'

vi.mock('../../auth/keycloak', () => ({ keycloak: { tokenParsed: { name: 'Priya Naidoo' }, logout: vi.fn() } }))
vi.mock('../../api/axiosConfig', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }))

// The person-level Account page (owner, 2026-11-06): each option explained, Invitations and Link Requests carry pending counts.
const http = api as unknown as ApiMock

function setup() {
  routeApi(http, {
    'GET /me/profiles': [],
    'GET /me/invitations': [{ linkId: 'l1' }, { linkId: 'l2' }],
    'GET /me/link-requests': [{ id: 'r1', status: 'PENDING' }, { id: 'r2', status: 'APPROVED' }],
    'POST /me/activate': { personId: 'p1', personStatus: 'ACTIVE', platformAdmin: false, clubAdminClubIds: [] },
  })
  return renderRoutes('/account/options', <Route path="/account/options" element={<MyAccountPage />} />)
}

beforeEach(() => vi.clearAllMocks())
afterEach(() => vi.restoreAllMocks())

describe('MyAccountPage', () => {
  it('explains the options and shows the pending counts on Invitations and Link Requests', async () => {
    setup()

    const list = await screen.findByRole('list', { name: 'Account' })
    const cards = () => within(list).getAllByRole('button')
    await waitFor(() => expect(cards()[0]).toHaveTextContent('Invitations2 pending'))
    await waitFor(() => expect(cards()[1]).toHaveTextContent('Link Requests1 pending'))
    expect(cards()[2]).toHaveTextContent('Link More Players')
  })

  it('opens the Invitations page from its card', async () => {
    const user = userEvent.setup()
    setup()

    await user.click(await screen.findByRole('button', { name: /^Invitations/ }))
    expect(await screen.findByTestId('location')).toHaveTextContent('/account/invitations')
  })

  it('goes Back to players from the footer', async () => {
    const user = userEvent.setup()
    setup()

    await user.click(await screen.findByRole('button', { name: 'Back to players' }))
    expect(await screen.findByTestId('location')).toHaveTextContent('/account')
  })
})
