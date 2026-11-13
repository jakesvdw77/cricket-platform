import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ClubOverviewPage from './ClubOverviewPage'
import { makeHubSettings } from '../../test/clubInfoFixtures'

// docs/specs/148 (Manager side): the Player Hub card is for club administrators only; each chip saves the whole set.
const activateSession = vi.fn()
const getHubSettings = vi.fn()
const updateHubSettings = vi.fn()

vi.mock('../../api/meApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/meApi')>()),
  activateSession: () => activateSession(),
}))
vi.mock('../../api/hubSettingsApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/hubSettingsApi')>()),
  getHubSettings: (clubId: string) => getHubSettings(clubId),
  updateHubSettings: (clubId: string, body: unknown) => updateHubSettings(clubId, body),
}))
vi.mock('../../api/shareSettingsApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/shareSettingsApi')>()),
  getShareSettings: () => Promise.resolve({ initialsOnlyDefault: false, disabledFormats: {} }),
}))
vi.mock('../../api/clubApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/clubApi')>()),
  getManagedClubProfile: () =>
    Promise.resolve({ clubId: 'c1', name: 'Riverside Cricket Club', type: 'CLUB', logoUrl: null, bannerUrl: null, address: null, email: null, phone: null, website: null, socialLinks: [], createdAt: '', updatedAt: '', updatedBy: null }),
}))
vi.mock('../../api/clubContactApi', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../api/clubContactApi')>()), listClubContacts: () => Promise.resolve([]) }))
vi.mock('../../api/sponsorApi', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../api/sponsorApi')>()), listSponsors: () => Promise.resolve([]) }))
vi.mock('../../api/seasonApi', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../api/seasonApi')>()), listSeasons: () => Promise.resolve([]) }))
vi.mock('../../api/teamApi', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../api/teamApi')>()), listTeamsForSection: () => Promise.resolve([]) }))
vi.mock('../../api/sectionApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/sectionApi')>()),
  listSections: () => Promise.resolve([]),
  getSectionsSummary: () => Promise.resolve({ totals: { sections: 0, teams: 0, players: 0 }, sections: [] }),
  listSectionContacts: () => Promise.resolve([]),
}))

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/manage/club-profile']}>
        <Routes>
          <Route path="/manage" element={<Outlet context={{ clubId: 'c1' }} />}>
            <Route path="club-profile" element={<ClubOverviewPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  getHubSettings.mockResolvedValue(makeHubSettings())
  updateHubSettings.mockImplementation((_club: string, body: unknown) => Promise.resolve(body))
})

describe('ClubOverviewPage Player Hub card', () => {
  it('is hidden from a manager who is not an administrator of this club and reads no switches', async () => {
    activateSession.mockResolvedValue({ clubAdminClubIds: ['other-club'] })
    renderPage()

    await screen.findByText('Riverside Cricket Club')
    await waitFor(() => expect(activateSession).toHaveBeenCalled())
    expect(screen.queryByTestId('hub-settings-card')).not.toBeInTheDocument()
    expect(getHubSettings).not.toHaveBeenCalled()
  })

  it('shows for a club administrator with the stored switches', async () => {
    activateSession.mockResolvedValue({ clubAdminClubIds: ['c1'] })
    renderPage()

    expect(await screen.findByTestId('hub-settings-card')).toHaveTextContent('Player Hub')
    await waitFor(() => expect(getHubSettings).toHaveBeenCalledWith('c1'))
    expect(await screen.findByRole('button', { name: 'Show Contact Directory' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Allow Logo Download' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('saves the whole set when a chip is tapped', async () => {
    activateSession.mockResolvedValue({ clubAdminClubIds: ['c1'] })
    renderPage()

    const chip = await screen.findByRole('button', { name: 'Allow Logo Download' })
    await waitFor(() => expect(chip).toBeEnabled())
    await userEvent.click(chip)

    await waitFor(() => expect(updateHubSettings).toHaveBeenCalledWith('c1', makeHubSettings({ logoDownloadAllowed: true })))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Allow Logo Download' })).toHaveAttribute('aria-pressed', 'true'))
  })
})
