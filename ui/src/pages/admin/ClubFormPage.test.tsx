import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ClubFormPage from './ClubFormPage'
import type { Club, ClubProfile } from '../../api/clubApi'

const getClub = vi.fn()
const createClub = vi.fn()
const updateClub = vi.fn()
const suspendClub = vi.fn()
const reactivateClub = vi.fn()
const getClubProfile = vi.fn()
const updateClubProfile = vi.fn()

vi.mock('../../api/clubApi', () => ({
  getClub: (id: string) => getClub(id),
  createClub: (payload: unknown) => createClub(payload),
  updateClub: (id: string, payload: unknown) => updateClub(id, payload),
  suspendClub: (id: string) => suspendClub(id),
  reactivateClub: (id: string) => reactivateClub(id),
  getClubProfile: (id: string) => getClubProfile(id),
  updateClubProfile: (id: string, payload: unknown) => updateClubProfile(id, payload),
}))

beforeEach(() => {
  vi.clearAllMocks()
  // Every edit-mode test fetches this alongside the club itself — default to the
  // default-shaped, all-null profile a club with no saved profile data returns.
  getClubProfile.mockResolvedValue(emptyProfile())
})

function activeClub(overrides: Partial<Club> = {}): Club {
  return {
    id: 'c-1',
    name: 'Riverside Cricket Club',
    slug: 'riverside-cc',
    status: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: null,
    ...overrides,
  }
}

function emptyProfile(overrides: Partial<ClubProfile> = {}): ClubProfile {
  return {
    clubId: 'c-1',
    name: 'Riverside Cricket Club',
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

function renderPage(initialPath: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/admin/onboarding" element={<div>Club List Page</div>} />
          <Route path="/admin/onboarding/new" element={<ClubFormPage />} />
          <Route path="/admin/onboarding/:id/edit" element={<ClubFormPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('ClubFormPage', () => {
  it('create mode: does not fetch a club or profile, and submit calls createClub then navigates to the new club\'s edit route (not the list)', async () => {
    const user = userEvent.setup()
    createClub.mockResolvedValueOnce(activeClub())
    // The redirect below lands back on ClubFormPage in edit mode, which fetches both.
    getClub.mockResolvedValueOnce(activeClub())

    renderPage('/admin/onboarding/new')

    expect(screen.getByText('Add Club')).toBeInTheDocument()
    expect(getClub).not.toHaveBeenCalled()
    expect(getClubProfile).not.toHaveBeenCalled()

    await user.type(screen.getByLabelText('Name'), 'Riverside Cricket Club')
    // Slug auto-fills from Name — clear it first so the explicit entry below isn't appended
    // to the derived value (see ClubForm.test.tsx's dedicated auto-derive coverage).
    await user.clear(screen.getByLabelText('Slug'))
    await user.type(screen.getByLabelText('Slug'), 'riverside-cc')
    await user.click(screen.getByRole('button', { name: 'Create club' }))

    expect(createClub).toHaveBeenCalledTimes(1)
    expect(createClub).toHaveBeenCalledWith({ name: 'Riverside Cricket Club', slug: 'riverside-cc' })
    // Create mode never threads a `profile` key through — profileInitialValues is undefined
    // until a club exists, per docs/specs/012-club-profile.md.
    expect(updateClubProfile).not.toHaveBeenCalled()

    expect(await screen.findByText('Edit Club')).toBeInTheDocument()
    expect(screen.queryByText('Club List Page')).not.toBeInTheDocument()
  })

  it('edit mode: fetches and pre-fills the club and profile, and submit calls updateClub then updateClubProfile, then navigates to the list', async () => {
    const user = userEvent.setup()
    getClub.mockResolvedValueOnce(activeClub())
    updateClub.mockResolvedValueOnce(activeClub())
    getClubProfile.mockResolvedValueOnce(
      emptyProfile({ email: 'club@riverside.example.com' }),
    )
    updateClubProfile.mockResolvedValueOnce(emptyProfile({ email: 'club@riverside.example.com' }))

    renderPage('/admin/onboarding/c-1/edit')

    expect(await screen.findByText('Edit Club')).toBeInTheDocument()
    expect(getClub).toHaveBeenCalledWith('c-1')
    expect(getClubProfile).toHaveBeenCalledWith('c-1')
    expect(await screen.findByDisplayValue('Riverside Cricket Club')).toBeInTheDocument()
    expect(screen.getByDisplayValue('riverside-cc')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(updateClub).toHaveBeenCalledTimes(1)
    const [id, payload] = updateClub.mock.calls[0]
    expect(id).toBe('c-1')
    expect(payload).toEqual({ name: 'Riverside Cricket Club', slug: 'riverside-cc' })

    expect(updateClubProfile).toHaveBeenCalledTimes(1)
    const [profileId, profilePayload] = updateClubProfile.mock.calls[0]
    expect(profileId).toBe('c-1')
    expect(profilePayload).toMatchObject({ email: 'club@riverside.example.com' })

    expect(await screen.findByText('Club List Page')).toBeInTheDocument()
  })

  it('shows "Suspend" (not "Reactivate") for an ACTIVE club, requires inline confirm, and calls suspendClub', async () => {
    const user = userEvent.setup()
    getClub.mockResolvedValueOnce(activeClub({ status: 'ACTIVE' }))
    suspendClub.mockResolvedValueOnce(activeClub({ status: 'SUSPENDED' }))

    renderPage('/admin/onboarding/c-1/edit')

    await screen.findByText('Edit Club')
    expect(screen.queryByRole('button', { name: 'Reactivate' })).not.toBeInTheDocument()

    const suspendButton = screen.getByRole('button', { name: 'Suspend' })
    await user.click(suspendButton)

    expect(screen.getByText('Suspend this club?')).toBeInTheDocument()
    expect(suspendClub).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Confirm suspend' }))

    expect(suspendClub).toHaveBeenCalledWith('c-1')
    expect(await screen.findByText('Club List Page')).toBeInTheDocument()
  })

  it('shows "Reactivate" (not "Suspend") for a SUSPENDED club and calls reactivateClub after confirm', async () => {
    const user = userEvent.setup()
    getClub.mockResolvedValueOnce(activeClub({ status: 'SUSPENDED' }))
    reactivateClub.mockResolvedValueOnce(activeClub({ status: 'ACTIVE' }))

    renderPage('/admin/onboarding/c-1/edit')

    await screen.findByText('Edit Club')
    expect(screen.queryByRole('button', { name: 'Suspend' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Reactivate' }))
    expect(screen.getByText('Reactivate this club?')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Confirm reactivate' }))

    expect(reactivateClub).toHaveBeenCalledWith('c-1')
    expect(await screen.findByText('Club List Page')).toBeInTheDocument()
  })

  it('cancelling the inline transition confirm does not call suspendClub', async () => {
    const user = userEvent.setup()
    getClub.mockResolvedValueOnce(activeClub({ status: 'ACTIVE' }))

    renderPage('/admin/onboarding/c-1/edit')

    await user.click(await screen.findByRole('button', { name: 'Suspend' }))
    await user.click(screen.getByRole('button', { name: "Don't suspend" }))

    expect(screen.queryByText('Suspend this club?')).not.toBeInTheDocument()
    expect(suspendClub).not.toHaveBeenCalled()
  })

  it('renders an error state instead of a blank page when fetching the club fails', async () => {
    getClub.mockRejectedValueOnce(new Error('not found'))

    renderPage('/admin/onboarding/c-1/edit')

    expect(await screen.findByText("Couldn't load this club")).toBeInTheDocument()
    expect(
      screen.getByText('Something went wrong loading this club. Please try again.'),
    ).toBeInTheDocument()
  })

  it("surfaces the backend's specific detail message in the save-error banner instead of a generic one", async () => {
    const user = userEvent.setup()
    createClub.mockRejectedValueOnce({
      isAxiosError: true,
      response: { data: { detail: 'Club slug is reserved: admin' } },
    })

    renderPage('/admin/onboarding/new')

    await user.type(screen.getByLabelText('Name'), 'Admin Club')
    await user.clear(screen.getByLabelText('Slug'))
    await user.type(screen.getByLabelText('Slug'), 'admin-club')
    await user.click(screen.getByRole('button', { name: 'Create club' }))

    expect(await screen.findByText('Club slug is reserved: admin')).toBeInTheDocument()
  })

  it('falls back to a generic save-error message when the failure is not a ProblemDetail response', async () => {
    const user = userEvent.setup()
    createClub.mockRejectedValueOnce(new Error('network error'))

    renderPage('/admin/onboarding/new')

    await user.type(screen.getByLabelText('Name'), 'Riverside Cricket Club')
    // Slug auto-fills from Name — clear it first so the explicit entry below isn't appended
    // to the derived value (see ClubForm.test.tsx's dedicated auto-derive coverage).
    await user.clear(screen.getByLabelText('Slug'))
    await user.type(screen.getByLabelText('Slug'), 'riverside-cc')
    await user.click(screen.getByRole('button', { name: 'Create club' }))

    expect(
      await screen.findByText('Something went wrong saving this club. Please try again.'),
    ).toBeInTheDocument()
  })

  it("surfaces the backend's specific detail message in the transition-error banner instead of a generic one", async () => {
    const user = userEvent.setup()
    getClub.mockResolvedValueOnce(activeClub({ status: 'ACTIVE' }))
    suspendClub.mockRejectedValueOnce({
      isAxiosError: true,
      response: { data: { detail: 'Club is already suspended' } },
    })

    renderPage('/admin/onboarding/c-1/edit')

    await screen.findByText('Edit Club')
    await user.click(screen.getByRole('button', { name: 'Suspend' }))
    await user.click(screen.getByRole('button', { name: 'Confirm suspend' }))

    expect(await screen.findByText('Club is already suspended')).toBeInTheDocument()
  })

  it('falls back to a generic transition-error message when the failure is not a ProblemDetail response', async () => {
    const user = userEvent.setup()
    getClub.mockResolvedValueOnce(activeClub({ status: 'ACTIVE' }))
    suspendClub.mockRejectedValueOnce(new Error('network error'))

    renderPage('/admin/onboarding/c-1/edit')

    await screen.findByText('Edit Club')
    await user.click(screen.getByRole('button', { name: 'Suspend' }))
    await user.click(screen.getByRole('button', { name: 'Confirm suspend' }))

    expect(
      await screen.findByText('Something went wrong trying to suspend this club. Please try again.'),
    ).toBeInTheDocument()
  })
})
