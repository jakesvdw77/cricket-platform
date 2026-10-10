import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminHome from './AdminHome'
import AdminDashboard from './AdminDashboard'
import { EmptyState } from '../../components/EmptyState'

const getAdminIdentity = vi.fn()

vi.mock('../../api/adminApi', () => ({
  getAdminIdentity: () => getAdminIdentity(),
}))

const keycloakMock = vi.hoisted(() => ({
  authenticated: true,
  initPromise: Promise.resolve() as Promise<unknown>,
}))

vi.mock('../../auth/keycloak', () => ({
  AUTH_AWARE_PATH_PREFIXES: ['/admin', '/manage'],
  keycloak: {
    logout: vi.fn(),
    get authenticated() {
      return keycloakMock.authenticated
    },
  },
  get keycloakInitPromise() {
    return keycloakMock.initPromise
  },
}))

function renderAdminHome(initialPath = '/admin') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/admin" element={<AdminHome />}>
            <Route index element={<AdminDashboard />} />
            <Route path="onboarding" element={<EmptyState title="Club Onboarding" description="Coming soon." />} />
          </Route>
          <Route path="/" element={<div>Landing page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('AdminHome', () => {
  beforeEach(() => {
    keycloakMock.authenticated = true
    keycloakMock.initPromise = Promise.resolve()
  })

  it('navigates to the landing page when init resolved with no Keycloak session', async () => {
    keycloakMock.authenticated = false
    getAdminIdentity.mockRejectedValue(new Error('401'))

    renderAdminHome()

    expect(await screen.findByText('Landing page')).toBeInTheDocument()
    expect(screen.queryByText('Not authorized')).not.toBeInTheDocument()
  })

  it('renders nothing (no Not authorized, no redirect) while Keycloak init is pending', async () => {
    keycloakMock.initPromise = new Promise(() => undefined)
    getAdminIdentity.mockRejectedValue(new Error('403'))

    renderAdminHome()
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(screen.queryByText('Not authorized')).not.toBeInTheDocument()
    expect(screen.queryByText('Landing page')).not.toBeInTheDocument()
  })

  it('renders the sidebar shell with the identity dashboard once GET /platform/me resolves', async () => {
    getAdminIdentity.mockResolvedValueOnce({
      keycloakUserId: 'a1b2c3d4',
      username: 'ada.lovelace',
      email: 'ada@example.com',
    })

    renderAdminHome()

    expect(await screen.findByText('ada.lovelace')).toBeInTheDocument()
    expect(screen.getByText('ada@example.com')).toBeInTheDocument()
    expect(screen.getByText('You are logged in as an admin')).toBeInTheDocument()
    expect(screen.getAllByText('Club Onboarding').length).toBeGreaterThan(0)
  })

  it('renders the "not authorized" empty state with no sidebar chrome when GET /platform/me rejects', async () => {
    getAdminIdentity.mockRejectedValueOnce(new Error('403 Forbidden'))

    renderAdminHome()

    expect(await screen.findByText('Not authorized')).toBeInTheDocument()
    expect(screen.queryByText('Club Onboarding')).not.toBeInTheDocument()
  })

  it('navigates to a placeholder section and renders its EmptyState', async () => {
    getAdminIdentity.mockResolvedValueOnce({
      keycloakUserId: 'a1b2c3d4',
      username: 'ada.lovelace',
      email: 'ada@example.com',
    })

    renderAdminHome()
    await screen.findByText('You are logged in as an admin')

    await userEvent.click(screen.getAllByText('Club Onboarding')[0])

    expect(await screen.findByText('Coming soon.')).toBeInTheDocument()
  })
})
