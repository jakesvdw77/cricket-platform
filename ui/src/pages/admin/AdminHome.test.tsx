import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import AdminHome from './AdminHome'
import AdminDashboard from './AdminDashboard'
import { EmptyState } from '../../components/EmptyState'

const getAdminIdentity = vi.fn()

vi.mock('../../api/adminApi', () => ({
  getAdminIdentity: () => getAdminIdentity(),
}))

vi.mock('../../auth/keycloak', () => ({
  keycloak: { logout: vi.fn() },
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
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('AdminHome', () => {
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
