import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError } from 'axios'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ClubOverviewPage from './ClubOverviewPage'

// docs/specs/122-league-sharing.md (Share formats): the card is for club administrators only; a section manager never sees it.
const activateSession = vi.fn()
const getShareSettings = vi.fn()
const updateShareSettings = vi.fn()

vi.mock('../../api/meApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/meApi')>()),
  activateSession: () => activateSession(),
}))
vi.mock('../../api/shareSettingsApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/shareSettingsApi')>()),
  getShareSettings: (clubId: string) => getShareSettings(clubId),
  updateShareSettings: (clubId: string, body: unknown) => updateShareSettings(clubId, body),
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
  getShareSettings.mockResolvedValue({ initialsOnlyDefault: false, disabledFormats: {} })
  updateShareSettings.mockImplementation((_club: string, body: unknown) => Promise.resolve(body))
})

describe('ClubOverviewPage share formats card', () => {
  it('is hidden from a manager who is not an administrator of this club and reads no settings', async () => {
    activateSession.mockResolvedValue({ clubAdminClubIds: ['other-club'] })
    renderPage()

    await screen.findByText('Riverside Cricket Club')
    await waitFor(() => expect(activateSession).toHaveBeenCalled())
    expect(screen.queryByTestId('share-formats-card')).not.toBeInTheDocument()
    expect(getShareSettings).not.toHaveBeenCalled()
  })

  it('shows for a club administrator, and saving a switch keeps the initials default', async () => {
    activateSession.mockResolvedValue({ clubAdminClubIds: ['c1'] })
    getShareSettings.mockResolvedValue({ initialsOnlyDefault: true, disabledFormats: {} })
    renderPage()

    const card = await screen.findByTestId('share-formats-card')
    await waitFor(() => expect(getShareSettings).toHaveBeenCalledWith('c1'))
    const poster = await waitFor(() => {
      const input = Array.from(card.querySelectorAll('input')).find((el) => el.closest('label')?.textContent === 'Poster')
      expect(input).toBeDefined()
      return input as HTMLInputElement
    })
    await userEvent.click(poster)

    await waitFor(() => expect(updateShareSettings).toHaveBeenCalledWith('c1', { initialsOnlyDefault: true, disabledFormats: { LEAGUE: ['POSTER'] } }))
  })

  it('shows the server 400 message when the save is refused', async () => {
    activateSession.mockResolvedValue({ clubAdminClubIds: ['c1'] })
    updateShareSettings.mockRejectedValue(new AxiosError('bad', '400', undefined, undefined, { status: 400, data: { detail: 'Leagues need at least one share format.' } } as never))
    renderPage()

    const card = await screen.findByTestId('share-formats-card')
    const calendar = await waitFor(() => {
      const input = Array.from(card.querySelectorAll('input')).find((el) => el.closest('label')?.textContent === 'Calendar')
      expect(input).toBeDefined()
      return input as HTMLInputElement
    })
    await userEvent.click(calendar)

    expect(await screen.findByRole('alert')).toHaveTextContent('Leagues need at least one share format.')
  })
})
