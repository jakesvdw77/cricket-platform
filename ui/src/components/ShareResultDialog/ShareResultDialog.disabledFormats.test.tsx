import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { ThemeProvider } from '@mui/material'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ShareResultDialog } from './ShareResultDialog'
import { baseTheme } from '../../theme'
import { makeMatch, makeResult } from '../../test/resultFixtures'
import { mockCanvas } from './shareScreenTestUtils'

// docs/specs/122-league-sharing.md (Share formats): a result format the club switched off is not shown at all; a LEAGUE switch-off
// has no effect on results.
const getShareSettings = vi.fn()

vi.mock('../../api/shareSettingsApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/shareSettingsApi')>()),
  getShareSettings: (clubId: string) => getShareSettings(clubId),
  updateShareSettings: vi.fn(),
}))
vi.mock('../../api/leagueApi', () => ({ listLeagues: () => Promise.resolve([]) }))
vi.mock('../../api/sectionApi', () => ({ listSections: () => Promise.resolve([{ id: 'sec-1', parentSectionId: null, name: 'Seniors', maxAge: null }]) }))
vi.mock('../../api/clubApi', () => ({ getManagedClubProfile: () => Promise.resolve({ name: 'Riverside', logoUrl: null, website: null }) }))
vi.mock('../../api/sponsorApi', () => ({ listSponsors: () => Promise.resolve([]) }))
vi.mock('../../api/teamSponsorApi', () => ({ listTeamSponsors: () => Promise.resolve([]) }))

const team = { id: 'team-1', sectionId: 'sec-1', name: '1st XI', logoUrl: null }

function renderDialog() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <ThemeProvider theme={baseTheme}>
      <QueryClientProvider client={queryClient}>
        <ShareResultDialog open onClose={() => {}} clubId="club-1" match={makeMatch({ id: 'match-1', homeTeamId: 'team-1', leagueId: null })} result={makeResult()} teamsById={new Map([['team-1', team as never]])} />
      </QueryClientProvider>
    </ThemeProvider>,
  )
}

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  mockCanvas()
})

describe('ShareResultDialog disabled formats', () => {
  it('hides a format the club switched off once the settings arrive, keeping the others choosable', async () => {
    getShareSettings.mockResolvedValue({ initialsOnlyDefault: false, disabledFormats: { RESULT: ['TV', 'FACEBOOK'] } })
    renderDialog()

    await vi.waitFor(() => expect(screen.queryByRole('radio', { name: /TV summary/ })).not.toBeInTheDocument())
    expect(screen.queryByRole('radio', { name: /Facebook/ })).not.toBeInTheDocument()
    expect(screen.getAllByRole('radio')).toHaveLength(3)
    expect(screen.getByRole('radio', { name: /PDF scorecard/ })).toBeEnabled()
    expect(screen.getByRole('radio', { name: /WhatsApp/ })).toBeEnabled()
  })

  it('ignores the league switches when sharing a result', async () => {
    getShareSettings.mockResolvedValue({ initialsOnlyDefault: false, disabledFormats: { LEAGUE: ['PDF', 'WHATSAPP'] } })
    renderDialog()

    await vi.waitFor(() => expect(getShareSettings).toHaveBeenCalled())
    expect(screen.getAllByRole('radio')).toHaveLength(5)
  })

  it('offers every format when the settings could not be read', async () => {
    getShareSettings.mockRejectedValue(new Error('403'))
    renderDialog()

    await vi.waitFor(() => expect(getShareSettings).toHaveBeenCalled())
    expect(screen.getAllByRole('radio')).toHaveLength(5)
  })
})
