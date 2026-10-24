import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import api from '../../api/axiosConfig'
import type { Profile } from '../../api/meApi'
import ProfileChooserPage from './ProfileChooserPage'
import { httpError, renderRoutes, routeApi } from '../../test/accountTestUtils'
import type { ApiMock } from '../../test/accountTestUtils'

vi.mock('../../auth/keycloak', () => ({ keycloak: { tokenParsed: { name: 'Priya Naidoo' }, logout: vi.fn() } }))
vi.mock('../../api/axiosConfig', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }))

// docs/specs/119 slice 4: the chooser is shown only for more than one card; Remember my choice is off by default.
const http = api as unknown as ApiMock
const players: Profile = { kind: 'MY_PLAYERS', title: 'Player Hub', subtitle: 'Aman and 1 more', landing: '/account', pendingCount: 0 }
const manager = (clubId: string, clubName: string, overrides: Partial<Profile> = {}): Profile => ({
  kind: 'MANAGER',
  title: 'Club manager',
  clubId,
  clubName,
  clubSlug: clubId,
  landing: '/manage',
  pendingCount: 0,
  ...overrides,
})
const admin: Profile = { kind: 'PLATFORM_ADMIN', title: 'Platform admin', landing: '/admin', pendingCount: 0 }

function setup(profiles: Profile[] | Error) {
  routeApi(http, { 'GET /me/profiles': profiles, 'POST /me/activate': { personId: 'p1', personStatus: 'ACTIVE', platformAdmin: false, clubAdminClubIds: [] } })
  return renderRoutes('/choose-profile', <Route path="/choose-profile" element={<ProfileChooserPage />} />)
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})
afterEach(() => vi.restoreAllMocks())

describe('ProfileChooserPage', () => {
  it('shows scenario 1 as two cards, one Manager card per club and a single Player Hub card with its line', async () => {
    setup([manager('c1', 'Hillcrest CC'), players])

    const list = await screen.findByRole('list', { name: 'Profiles' })
    const cards = within(list).getAllByRole('button')
    expect(cards.map((card) => card.textContent)).toEqual(['Club managerHillcrest CC', 'Player HubAman and 1 more'])
  })

  it('gives each club its own manager card, and a platform admin their own card', async () => {
    setup([manager('c1', 'Hillcrest CC'), manager('c2', 'Riverside CC'), players, admin])

    expect(await screen.findByRole('button', { name: /Club manager.*Hillcrest CC/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Club manager.*Riverside CC/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Platform admin/ })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Player Hub/ })).toHaveLength(1)
  })

  it('shows a pending chip on a card with pending items', async () => {
    setup([manager('c1', 'Hillcrest CC', { pendingCount: 2 }), players])

    expect(await screen.findByText('2 pending')).toBeInTheDocument()
  })

  it('has Remember my choice off by default and does not store a choice when it is off', async () => {
    const user = userEvent.setup()
    setup([manager('c1', 'Hillcrest CC'), players])

    expect(await screen.findByRole('checkbox', { name: 'Remember my choice on this device' })).not.toBeChecked()
    await user.click(screen.getByRole('button', { name: /Player Hub/ }))

    expect(await screen.findByTestId('location')).toHaveTextContent('/account')
    expect(localStorage.getItem('profile:remembered')).toBeNull()
  })

  it('stores the choice on this device only when the box is ticked', async () => {
    const user = userEvent.setup()
    setup([manager('c1', 'Hillcrest CC'), players])

    await user.click(await screen.findByRole('checkbox', { name: 'Remember my choice on this device' }))
    await user.click(screen.getByRole('button', { name: /Club manager.*Hillcrest CC/ }))

    expect(await screen.findByTestId('location')).toHaveTextContent('/manage')
    expect(localStorage.getItem('profile:remembered')).toBe('MANAGER:c1')
  })

  it('still opens the card when storage is unavailable', async () => {
    const user = userEvent.setup()
    setup([manager('c1', 'Hillcrest CC'), players])
    await user.click(await screen.findByRole('checkbox', { name: 'Remember my choice on this device' }))
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied')
    })

    await user.click(screen.getByRole('button', { name: /Player Hub/ }))

    expect(await screen.findByTestId('location')).toHaveTextContent('/account')
  })

  it('is never shown for one card: it goes straight to that card', async () => {
    setup([players])

    expect(await screen.findByTestId('location')).toHaveTextContent('/account')
    expect(screen.queryByRole('list', { name: 'Profiles' })).not.toBeInTheDocument()
  })

  it('sends a person with no profiles to /welcome', async () => {
    setup([])

    expect(await screen.findByTestId('location')).toHaveTextContent('/welcome')
  })

  it('shows an error when the profiles cannot be loaded', async () => {
    setup(httpError(500))

    expect(await screen.findByText('We could not load your profiles. Please try again later.')).toBeInTheDocument()
  })
})
