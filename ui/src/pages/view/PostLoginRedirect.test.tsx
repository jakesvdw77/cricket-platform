import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import PostLoginRedirect from './PostLoginRedirect'
import type { MeAccess } from '../../api/meApi'

const activateSession = vi.fn()

vi.mock('../../api/meApi', () => ({
  activateSession: () => activateSession(),
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

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/post-login']}>
        <Routes>
          <Route path="/post-login" element={<PostLoginRedirect />} />
          <Route path="/admin" element={<div>Admin Home Page</div>} />
          <Route path="/manage" element={<div>Manager Home Page</div>} />
          <Route path="/welcome" element={<div>Welcome Page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('PostLoginRedirect', () => {
  it('renders "Signing you in…" while activation is pending', () => {
    activateSession.mockReturnValue(new Promise(() => {}))

    renderPage()

    expect(screen.getByText('Signing you in…')).toBeInTheDocument()
  })

  it('navigates to /admin when the caller is a platform admin', async () => {
    activateSession.mockResolvedValueOnce(meAccess({ platformAdmin: true, clubAdminClubIds: ['club-1'] }))

    renderPage()

    expect(await screen.findByText('Admin Home Page')).toBeInTheDocument()
  })

  it('navigates to /manage when the caller has at least one CLUB_ADMIN grant and is not a platform admin', async () => {
    activateSession.mockResolvedValueOnce(
      meAccess({ platformAdmin: false, clubAdminClubIds: ['club-1'] }),
    )

    renderPage()

    expect(await screen.findByText('Manager Home Page')).toBeInTheDocument()
  })

  it('navigates to /welcome when there is no Person and no grant', async () => {
    activateSession.mockResolvedValueOnce(meAccess())

    renderPage()

    expect(await screen.findByText('Welcome Page')).toBeInTheDocument()
  })

  it('navigates to /admin when a Person exists but has no platform admin or CLUB_ADMIN grant', async () => {
    activateSession.mockResolvedValueOnce(meAccess({ personId: 'p-1', personStatus: 'ACTIVE' }))

    renderPage()

    expect(await screen.findByText('Admin Home Page')).toBeInTheDocument()
  })

  it('navigates to /admin when activateSession() rejects', async () => {
    activateSession.mockRejectedValueOnce(new Error('network error'))

    renderPage()

    expect(await screen.findByText('Admin Home Page')).toBeInTheDocument()
  })
})
