import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useOutletContext } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ManagerHome from './ManagerHome'
import type { MeAccess } from '../../api/meApi'
import type { ClubProfile } from '../../api/clubApi'

const activateSession = vi.fn()
const getManagedClubProfile = vi.fn()

// Per docs/specs/020-club-manager-access.md, ManagerHome calls activateSession (not
// adminApi.getAdminIdentity, unlike AdminHome.test.tsx) — mirrors PostLoginRedirect.test.tsx's
// mocking approach exactly, including its meAccess(overrides) factory.
vi.mock('../../api/meApi', () => ({
  activateSession: () => activateSession(),
}))

vi.mock('../../api/clubApi', () => ({
  getManagedClubProfile: (id: string) => getManagedClubProfile(id),
}))

function clubProfile(overrides: Partial<ClubProfile> = {}): ClubProfile {
  return {
    clubId: 'club-1',
    name: 'Riverside CC',
    type: null,
    logoUrl: null,
    bannerUrl: null,
    address: null,
    email: null,
    phone: null,
    website: null,
    createdAt: null,
    updatedAt: null,
    updatedBy: null,
    ...overrides,
  }
}

const keycloakMock = vi.hoisted(() => ({
  authenticated: true,
  initPromise: Promise.resolve() as Promise<unknown>,
}))

vi.mock('../../auth/keycloak', () => ({
  AUTH_AWARE_PATH_PREFIXES: ['/admin', '/manage'],
  keycloak: {
    logout: vi.fn(),
    tokenParsed: { name: 'Riya Naidu', email: 'riya@riverside.example.com' },
    get authenticated() {
      return keycloakMock.authenticated
    },
  },
  get keycloakInitPromise() {
    return keycloakMock.initPromise
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
          <Route path="/" element={<div>Landing page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('ManagerHome', () => {
  beforeEach(() => {
    // Low-priority default so a background refetch beyond a test's own queued
    // mockResolvedValueOnce calls resolves to something rather than undefined — same convention
    // TeamFormPage.test.tsx already uses for this same call.
    getManagedClubProfile.mockResolvedValue(clubProfile())
    keycloakMock.authenticated = true
    keycloakMock.initPromise = Promise.resolve()
  })

  it('navigates to the landing page when init resolved with no Keycloak session', async () => {
    keycloakMock.authenticated = false
    activateSession.mockRejectedValue(new Error('401'))

    renderManagerHome()

    expect(await screen.findByText('Landing page')).toBeInTheDocument()
    expect(screen.queryByText('Not authorized')).not.toBeInTheDocument()
  })

  it('navigates to the landing page when init rejected and there is no session', async () => {
    keycloakMock.authenticated = false
    keycloakMock.initPromise = Promise.reject(new Error('init failed'))
    keycloakMock.initPromise.catch(() => undefined)
    activateSession.mockRejectedValue(new Error('401'))

    renderManagerHome()

    expect(await screen.findByText('Landing page')).toBeInTheDocument()
  })

  it('renders nothing (no Not authorized, no redirect) while Keycloak init is pending', async () => {
    keycloakMock.initPromise = new Promise(() => undefined)
    activateSession.mockRejectedValue(new Error('403'))

    renderManagerHome()
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(screen.queryByText('Not authorized')).not.toBeInTheDocument()
    expect(screen.queryByText('Landing page')).not.toBeInTheDocument()
  })

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

  it('renders ManagerShell driven by the real activateSession result, not a hardcoded mock user, and threads clubAdminClubIds[0] through the Outlet context', async () => {
    const user = userEvent.setup()
    activateSession.mockResolvedValueOnce(meAccess({ platformAdmin: false, clubAdminClubIds: ['club-1'] }))

    renderManagerHome()

    expect(await screen.findByText('Club context: club-1')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Account menu' }))

    expect(screen.getByText('Riya Naidu')).toBeInTheDocument()
    expect(screen.getByText('riya@riverside.example.com')).toBeInTheDocument()
    expect(screen.queryByText('Sam Manager')).not.toBeInTheDocument()
  })

  it('renders the real club name and logo in the header once the club profile loads, replacing the generic brand', async () => {
    activateSession.mockResolvedValueOnce(meAccess({ platformAdmin: false, clubAdminClubIds: ['club-1'] }))
    getManagedClubProfile.mockResolvedValueOnce(
      clubProfile({ name: 'Riverside Cricket Club', logoUrl: '/media/logo.png' }),
    )

    renderManagerHome()

    expect(await screen.findByText('Riverside Cricket Club')).toBeInTheDocument()
    expect(screen.queryByText('Cricket Legend Platform')).not.toBeInTheDocument()
    const avatars = document.querySelectorAll('.MuiAvatar-root')
    expect(avatars).toHaveLength(2)
    expect(avatars[0].querySelector('img')).toHaveAttribute('src', '/media/logo.png')
  })

  it('falls back to the club-name initials when the club has no logo uploaded yet', async () => {
    activateSession.mockResolvedValueOnce(meAccess({ platformAdmin: false, clubAdminClubIds: ['club-1'] }))
    getManagedClubProfile.mockResolvedValueOnce(clubProfile({ name: 'Riverside Cricket Club', logoUrl: null }))

    renderManagerHome()

    expect(await screen.findByText('Riverside Cricket Club')).toBeInTheDocument()
    expect(screen.getByText('RC')).toBeInTheDocument()
  })
})
