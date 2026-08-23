import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ManageClubProfilePage from './ManageClubProfilePage'
import type { ClubProfile } from '../../api/clubApi'

const getManagedClubProfile = vi.fn()
const updateManagedClubProfile = vi.fn()

// Mirrors ClubFormPage.test.tsx's mock-every-export-individually pattern.
vi.mock('../../api/clubApi', () => ({
  getManagedClubProfile: (id: string) => getManagedClubProfile(id),
  updateManagedClubProfile: (id: string, payload: unknown) => updateManagedClubProfile(id, payload),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

function managedProfile(overrides: Partial<ClubProfile> = {}): ClubProfile {
  return {
    clubId: 'test-club-id',
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

// ManageClubProfilePage reads clubId via useOutletContext, not useParams (it's normally
// threaded through by ManagerHome's own <Outlet context={{ clubId }} />) — this wrapper route
// reproduces that shape without pulling ManagerHome (and its own activateSession dependency)
// into this page's tests.
function OutletContextWrapper({ clubId }: { clubId?: string }) {
  return <Outlet context={{ clubId }} />
}

function renderPage(clubId?: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/manage/club-profile']}>
        <Routes>
          <Route path="/manage" element={<OutletContextWrapper clubId={clubId} />}>
            <Route path="club-profile" element={<ManageClubProfilePage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('ManageClubProfilePage', () => {
  it('renders "Not authorized" and does not fetch a profile when no clubId is in the Outlet context', () => {
    renderPage(undefined)

    expect(screen.getByText('Not authorized')).toBeInTheDocument()
    expect(screen.getByText('No club is associated with your account.')).toBeInTheDocument()
    expect(getManagedClubProfile).not.toHaveBeenCalled()
  })

  it('renders nothing while the profile is loading', () => {
    getManagedClubProfile.mockReturnValueOnce(new Promise(() => {}))

    renderPage('test-club-id')

    expect(screen.queryByText('Club Profile')).not.toBeInTheDocument()
    expect(screen.queryByText('Not authorized')).not.toBeInTheDocument()
  })

  it("renders an error state when the profile fails to load", async () => {
    getManagedClubProfile.mockRejectedValueOnce(new Error('network error'))

    renderPage('test-club-id')

    expect(await screen.findByText("Couldn't load your club")).toBeInTheDocument()
    expect(
      screen.getByText("Something went wrong loading your club's profile. Please try again."),
    ).toBeInTheDocument()
  })

  it('fetches by the outlet-provided clubId and renders ClubForm in profileOnly mode, prefilled, with no Basic Info tab', async () => {
    getManagedClubProfile.mockResolvedValueOnce(
      managedProfile({ email: 'club@riverside.example.com', phone: '+27 21 555 0100' }),
    )

    renderPage('test-club-id')

    expect(await screen.findByText('Club Profile')).toBeInTheDocument()
    expect(getManagedClubProfile).toHaveBeenCalledWith('test-club-id')
    expect(screen.queryByRole('tab', { name: 'Basic Info' })).not.toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Contact' })).toBeInTheDocument()

    expect(screen.getByLabelText('Email')).toHaveValue('club@riverside.example.com')
  })

  it('submitting the form calls updateManagedClubProfile with the outlet clubId and the profile payload', async () => {
    const user = userEvent.setup()
    // mockResolvedValue (not Once): saveMutation.onSuccess invalidates this query key, triggering
    // a refetch after submit, which needs a value to resolve to as well.
    getManagedClubProfile.mockResolvedValue(managedProfile({ email: 'club@riverside.example.com' }))
    updateManagedClubProfile.mockResolvedValueOnce(managedProfile({ email: 'club@riverside.example.com' }))

    renderPage('test-club-id')

    await screen.findByText('Club Profile')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(updateManagedClubProfile).toHaveBeenCalledTimes(1)
    const [id, payload] = updateManagedClubProfile.mock.calls[0]
    expect(id).toBe('test-club-id')
    expect(payload).toMatchObject({ email: 'club@riverside.example.com' })
  })
})
