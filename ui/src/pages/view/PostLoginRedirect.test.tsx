import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PostLoginRedirect from './PostLoginRedirect'
import type { MeAccess, Profile } from '../../api/meApi'

const activateSession = vi.fn()
const useMyPlayers = vi.fn()

vi.mock('../../api/myPlayersApi', () => ({
  useMyPlayers: (enabled: boolean) => useMyPlayers(enabled),
}))

vi.mock('../../api/meApi', () => ({
  activateSession: () => activateSession(),
}))

const profile = (overrides: Partial<Profile>): Profile => ({
  kind: 'MY_PLAYERS',
  title: 'Player Hub',
  landing: '/account',
  pendingCount: 0,
  ...overrides,
})

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
          <Route path="/account" element={<div>Account Page</div>} />
          <Route path="/choose-profile" element={<div>Chooser Page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('PostLoginRedirect', () => {
  beforeEach(() => {
    activateSession.mockReset()
    useMyPlayers.mockReset()
    useMyPlayers.mockReturnValue({ isLoading: false, data: [] })
    window.localStorage.clear()
  })

  it('renders the "Signing you in" loader while activation is pending', () => {
    activateSession.mockReturnValue(new Promise(() => {}))

    renderPage()

    expect(screen.getByRole('status', { name: 'Signing you in' })).toBeInTheDocument()
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

  it('goes to /account for a person with no manager access but with players (no profiles field)', async () => {
    useMyPlayers.mockReturnValue({ isLoading: false, data: [{ key: 'k' }] })
    activateSession.mockResolvedValueOnce(meAccess({ personId: 'p-1', personStatus: 'ACTIVE' }))

    renderPage()

    expect(await screen.findByText('Account Page')).toBeInTheDocument()
    expect(useMyPlayers).toHaveBeenCalledWith(true)
  })

  it('only asks for the players check when the caller has no profiles, admin or manager access', async () => {
    activateSession.mockResolvedValueOnce(meAccess({ clubAdminClubIds: ['club-1'], personId: 'p-1' }))

    renderPage()

    expect(await screen.findByText('Manager Home Page')).toBeInTheDocument()
    expect(useMyPlayers).not.toHaveBeenCalledWith(true)
  })

  describe('profiles (slice 4)', () => {
    it('goes straight to the landing of a single profile', async () => {
      activateSession.mockResolvedValueOnce(meAccess({ personId: 'p-1', profiles: [profile({})] }))

      renderPage()

      expect(await screen.findByText('Account Page')).toBeInTheDocument()
    })

    it('goes to the manager landing for a single manager profile', async () => {
      activateSession.mockResolvedValueOnce(
        meAccess({ personId: 'p-1', profiles: [profile({ kind: 'MANAGER', clubId: 'c1', clubSlug: 'riverside', landing: '/manage' })] }),
      )

      renderPage()

      expect(await screen.findByText('Manager Home Page')).toBeInTheDocument()
    })

    it('goes to the chooser when there are several profiles and nothing is remembered', async () => {
      activateSession.mockResolvedValueOnce(
        meAccess({ personId: 'p-1', profiles: [profile({}), profile({ kind: 'MANAGER', clubId: 'c1', landing: '/manage' })] }),
      )

      renderPage()

      expect(await screen.findByText('Chooser Page')).toBeInTheDocument()
    })

    it('opens the remembered profile when it is still one of the cards', async () => {
      window.localStorage.setItem('profile:remembered', 'MANAGER:c1')
      activateSession.mockResolvedValueOnce(
        meAccess({ personId: 'p-1', profiles: [profile({}), profile({ kind: 'MANAGER', clubId: 'c1', landing: '/manage' })] }),
      )

      renderPage()

      expect(await screen.findByText('Manager Home Page')).toBeInTheDocument()
    })

    it('ignores a remembered choice that no longer exists', async () => {
      window.localStorage.setItem('profile:remembered', 'MANAGER:gone')
      activateSession.mockResolvedValueOnce(
        meAccess({ personId: 'p-1', profiles: [profile({}), profile({ kind: 'MANAGER', clubId: 'c1', landing: '/manage' })] }),
      )

      renderPage()

      expect(await screen.findByText('Chooser Page')).toBeInTheDocument()
    })

    it('treats an empty profiles list as the old routing', async () => {
      activateSession.mockResolvedValueOnce(meAccess({ personId: null, profiles: [] }))

      renderPage()

      expect(await screen.findByText('Welcome Page')).toBeInTheDocument()
    })
  })
})
