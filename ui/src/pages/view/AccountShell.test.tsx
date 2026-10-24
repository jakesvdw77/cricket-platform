import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import api from '../../api/axiosConfig'
import type { MeAccess, Profile } from '../../api/meApi'
import { AccountShell } from './AccountShell'
import { clearViewport, renderRoutes, routeApi, setPhone } from '../../test/accountTestUtils'
import type { ApiMock } from '../../test/accountTestUtils'

const logout = vi.hoisted(() => vi.fn())
vi.mock('../../auth/keycloak', () => ({ keycloak: { tokenParsed: { name: 'Sam Smith', email: 'sam@example.com' }, logout } }))
vi.mock('../../api/axiosConfig', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }))

// docs/specs/119: the frame of the signed-in account pages. Back to club only for a manager or admin, Switch profile only
// with more than one card, Sign out always; a phone folds the three into the Account menu.
const http = api as unknown as ApiMock
const access = (overrides: Partial<MeAccess> = {}): MeAccess => ({ personId: 'p1', personStatus: 'ACTIVE', platformAdmin: false, clubAdminClubIds: [], ...overrides })
const players: Profile = { kind: 'MY_PLAYERS', title: 'Player Hub', landing: '/account', pendingCount: 0 }
const riverside: Profile = { kind: 'MANAGER', title: 'Club manager', clubId: 'c1', clubName: 'Riverside CC', clubSlug: 'riverside', landing: '/manage', pendingCount: 0 }

function renderShell(me: MeAccess, profiles: Profile[] = [players]) {
  routeApi(http, { 'POST /me/activate': me, 'GET /me/profiles': profiles })
  return renderRoutes('/account', <Route path="/account" element={<AccountShell>Page body</AccountShell>} />)
}

beforeEach(() => vi.clearAllMocks())
afterEach(clearViewport)

describe('AccountShell on a desktop', () => {
  it('shows the body in the framed column and Sign out, which signs out', async () => {
    renderShell(access())

    expect(screen.getByTestId('welcome-page')).toHaveTextContent('Page body')
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(logout).toHaveBeenCalledOnce()
  })

  it('offers Back to club to a manager and not to anyone else', async () => {
    const manager = renderShell(access({ clubAdminClubIds: ['c1'] }))
    await userEvent.click(await screen.findByRole('button', { name: 'Back to club' }))
    expect(await screen.findByTestId('location')).toHaveTextContent('/manage')
    manager.unmount()

    renderShell(access())
    await vi.waitFor(() => expect(http.post).toHaveBeenCalledWith('/me/activate'))
    expect(screen.queryByRole('button', { name: 'Back to club' })).not.toBeInTheDocument()
  })

  it('offers Back to club to a platform admin, going to /admin', async () => {
    renderShell(access({ platformAdmin: true }))

    await userEvent.click(await screen.findByRole('button', { name: 'Back to club' }))
    expect(await screen.findByTestId('location')).toHaveTextContent('/admin')
  })

  it('shows Switch profile only with more than one profile card', async () => {
    const several = renderShell(access(), [players, riverside])
    await userEvent.click(await screen.findByRole('button', { name: 'Switch profile' }))
    expect(await screen.findByRole('menuitem', { name: /Club manager.*Riverside CC/ })).toBeInTheDocument()
    several.unmount()

    renderShell(access(), [players])
    await vi.waitFor(() => expect(http.get).toHaveBeenCalledWith('/me/profiles'))
    expect(screen.queryByRole('button', { name: 'Switch profile' })).not.toBeInTheDocument()
  })
})

describe('AccountShell on a phone', () => {
  it('folds Back to club, Switch profile and Sign out into the Account menu with initials', async () => {
    setPhone(true)
    renderShell(access({ clubAdminClubIds: ['c1'] }), [players, riverside])

    expect(screen.queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument()
    const trigger = screen.getByRole('button', { name: 'Account menu' })
    expect(trigger).toHaveTextContent('SS')
    await vi.waitFor(() => expect(http.get).toHaveBeenCalledWith('/me/profiles'))
    await userEvent.click(trigger)

    expect(await screen.findByRole('menuitem', { name: 'Back to club' })).toBeInTheDocument()
    expect(await screen.findByRole('menuitem', { name: 'Switch profile' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }))
    expect(logout).toHaveBeenCalledOnce()
  })

  it('leaves out Back to club and Switch profile when they do not apply', async () => {
    setPhone(true)
    renderShell(access())
    await vi.waitFor(() => expect(http.post).toHaveBeenCalledWith('/me/activate'))

    await userEvent.click(screen.getByRole('button', { name: 'Account menu' }))

    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['Sign out'])
  })
})
