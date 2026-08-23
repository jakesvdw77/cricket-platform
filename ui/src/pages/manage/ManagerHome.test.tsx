import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useOutletContext } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import ManagerHome from './ManagerHome'
import type { MeAccess } from '../../api/meApi'

const activateSession = vi.fn()

// Per docs/specs/020-club-manager-access.md, ManagerHome calls activateSession (not
// adminApi.getAdminIdentity, unlike AdminHome.test.tsx) — mirrors PostLoginRedirect.test.tsx's
// mocking approach exactly, including its meAccess(overrides) factory.
vi.mock('../../api/meApi', () => ({
  activateSession: () => activateSession(),
}))

vi.mock('../../auth/keycloak', () => ({
  keycloak: {
    logout: vi.fn(),
    tokenParsed: { name: 'Riya Naidu', email: 'riya@riverside.example.com' },
  },
}))

function meAccess(overrides: Partial<MeAccess> = {}): MeAccess {
  return {
    personId: null,
    personStatus: null,
    platformAdmin: false,
    clubAdminClubIds: [],
    ...overrides,
  }
}

// Renders the clubId threaded through <Outlet context={...} /> so it can be asserted on
// directly, the same nested-route precedent AdminHome.test.tsx uses for its own index route.
function OutletContextProbe() {
  const { clubId } = useOutletContext<{ clubId?: string }>()
  return <div>Club context: {clubId ?? 'none'}</div>
}

function renderManagerHome(initialPath = '/manage') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/manage" element={<ManagerHome />}>
            <Route index element={<OutletContextProbe />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('ManagerHome', () => {
  it('renders "Not authorized" when activateSession() rejects', async () => {
    activateSession.mockRejectedValueOnce(new Error('network error'))

    renderManagerHome()

    expect(await screen.findByText('Not authorized')).toBeInTheDocument()
    expect(screen.getByText('You are not recognized as a club manager.')).toBeInTheDocument()
    expect(screen.queryByText(/Club context/)).not.toBeInTheDocument()
  })

  it('renders "Not authorized" when the caller is neither a platform admin nor holds any CLUB_ADMIN grant', async () => {
    activateSession.mockResolvedValueOnce(meAccess({ platformAdmin: false, clubAdminClubIds: [] }))

    renderManagerHome()

    expect(await screen.findByText('Not authorized')).toBeInTheDocument()
    expect(screen.queryByText(/Club context/)).not.toBeInTheDocument()
  })

  it('renders GridNavShell driven by the real activateSession result, not a hardcoded mock user, and threads clubAdminClubIds[0] through the Outlet context', async () => {
    const user = userEvent.setup()
    activateSession.mockResolvedValueOnce(meAccess({ platformAdmin: false, clubAdminClubIds: ['club-1'] }))

    renderManagerHome()

    expect(await screen.findByText('Club context: club-1')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Account menu' }))

    expect(screen.getByText('Riya Naidu')).toBeInTheDocument()
    expect(screen.getByText('riya@riverside.example.com')).toBeInTheDocument()
    expect(screen.queryByText('Sam Manager')).not.toBeInTheDocument()
  })
})
