import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import AdminHome from './AdminHome'

const getAdminIdentity = vi.fn()

vi.mock('../../api/adminApi', () => ({
  getAdminIdentity: () => getAdminIdentity(),
}))

function renderAdminHome() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <AdminHome />
    </QueryClientProvider>,
  )
}

describe('AdminHome', () => {
  it('renders the identity card once GET /platform/me resolves', async () => {
    getAdminIdentity.mockResolvedValueOnce({
      keycloakUserId: 'a1b2c3d4',
      username: 'ada.lovelace',
      email: 'ada@example.com',
    })

    renderAdminHome()

    expect(await screen.findByText('ada.lovelace')).toBeInTheDocument()
    expect(screen.getByText('ada@example.com')).toBeInTheDocument()
    expect(screen.getByText('You are logged in as an admin')).toBeInTheDocument()
    expect(screen.queryByText('Not authorized')).not.toBeInTheDocument()
  })

  it('renders the "not authorized" empty state when GET /platform/me rejects, never the identity card', async () => {
    getAdminIdentity.mockRejectedValueOnce(new Error('403 Forbidden'))

    renderAdminHome()

    expect(await screen.findByText('Not authorized')).toBeInTheDocument()
    expect(screen.queryByText('You are logged in as an admin')).not.toBeInTheDocument()
  })
})
