import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import api from '../../api/axiosConfig'
import MyPreferencesPage from './MyPreferencesPage'
import { renderRoutes, routeApi } from '../../test/accountTestUtils'
import type { ApiMock } from '../../test/accountTestUtils'

vi.mock('../../auth/keycloak', () => ({ keycloak: { tokenParsed: { name: 'Priya Naidoo' }, logout: vi.fn() } }))
vi.mock('../../api/axiosConfig', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }))

const http = api as unknown as ApiMock

function setup() {
  routeApi(http, {
    'GET /me/invitations': [],
    'GET /me/link-requests': [],
    'POST /me/activate': { personId: 'p1', personStatus: 'ACTIVE', platformAdmin: false, clubAdminClubIds: [] },
  })
  return renderRoutes('/account/preferences', <Route path="/account/preferences" element={<MyPreferencesPage />} />)
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})
afterEach(() => vi.restoreAllMocks())

describe('MyPreferencesPage', () => {
  it('shows the ticker on and the menu collapse off by default, each with its explanation', async () => {
    setup()

    expect(await screen.findByRole('checkbox', { name: 'Scoreboard ticker' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Collapse the menu automatically' })).not.toBeChecked()
    expect(screen.getByText(/rolling news line along the bottom/)).toBeInTheDocument()
  })

  it('turns the ticker off and back on, keeping the choice on this device', async () => {
    const user = userEvent.setup()
    setup()

    await user.click(await screen.findByRole('checkbox', { name: 'Scoreboard ticker' }))
    expect(screen.getByRole('checkbox', { name: 'Scoreboard ticker' })).not.toBeChecked()
    expect(localStorage.getItem('hub:ticker')).toBe('off')

    await user.click(screen.getByRole('checkbox', { name: 'Scoreboard ticker' }))
    expect(screen.getByRole('checkbox', { name: 'Scoreboard ticker' })).toBeChecked()
    expect(localStorage.getItem('hub:ticker')).toBeNull()
  })

  it('writes the menu auto-collapse preference with the key the Hub menu reads', async () => {
    const user = userEvent.setup()
    setup()

    await user.click(await screen.findByRole('checkbox', { name: 'Collapse the menu automatically' }))
    expect(localStorage.getItem('hub:menuAutoCollapse')).toBe('on')
  })

  it('goes Back to account from the footer', async () => {
    const user = userEvent.setup()
    setup()

    await user.click(await screen.findByRole('button', { name: 'Back to account' }))
    expect(await screen.findByTestId('location')).toHaveTextContent('/account/options')
  })
})
