import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '@mui/material'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ShareResultDialog } from './ShareResultDialog'
import { baseTheme } from '../../theme'
import { makeMatch, makeResult } from '../../pages/manage/results/resultTestUtils'

const getShareSettings = vi.fn()
const updateShareSettings = vi.fn()
const listLeagues = vi.fn()
const listSections = vi.fn()

vi.mock('../../api/shareSettingsApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/shareSettingsApi')>()),
  getShareSettings: (clubId: string) => getShareSettings(clubId),
  updateShareSettings: (clubId: string, settings: unknown) => updateShareSettings(clubId, settings),
}))
vi.mock('../../api/leagueApi', () => ({ listLeagues: (clubId: string) => listLeagues(clubId) }))
vi.mock('../../api/sectionApi', () => ({ listSections: (clubId: string) => listSections(clubId) }))
vi.mock('../../api/clubApi', () => ({ getManagedClubProfile: () => Promise.resolve({ name: 'Riverside', logoUrl: null, website: null }) }))
vi.mock('../../api/sponsorApi', () => ({ listSponsors: () => Promise.resolve([]) }))
vi.mock('../../api/teamSponsorApi', () => ({ listTeamSponsors: () => Promise.resolve([]) }))

const team = { id: 'team-1', sectionId: 'sec-1', name: '1st XI', logoUrl: null }

function renderDialog(matchOverrides = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <ThemeProvider theme={baseTheme}>
      <QueryClientProvider client={queryClient}>
        <ShareResultDialog
          open
          onClose={() => {}}
          clubId="club-1"
          match={makeMatch({ id: 'match-1', homeTeamId: 'team-1', leagueId: null, ...matchOverrides })}
          result={makeResult()}
          teamsById={new Map([['team-1', team as never]])}
        />
      </QueryClientProvider>
    </ThemeProvider>,
  )
}

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  getShareSettings.mockResolvedValue({ initialsOnlyDefault: false })
  updateShareSettings.mockImplementation((_club: string, settings: unknown) => Promise.resolve(settings))
  listLeagues.mockResolvedValue([])
  listSections.mockResolvedValue([{ id: 'sec-1', parentSectionId: null, name: 'Seniors', maxAge: null }])
})

describe('ShareResultDialog', () => {
  it('shows the five tiles, with PDF, Image and TV marked as coming next', () => {
    renderDialog()

    expect(screen.getByRole('dialog', { name: 'Share result' })).toBeInTheDocument()
    expect(screen.getAllByRole('radio')).toHaveLength(5)
    expect(screen.getAllByText('Coming next')).toHaveLength(3)
    expect(screen.getByRole('radio', { name: /PDF scorecard/ })).toBeDisabled()
    expect(screen.getByRole('radio', { name: /WhatsApp/ })).toBeEnabled()
  })

  it('opens the WhatsApp screen and Back returns to the tiles', async () => {
    renderDialog()

    await userEvent.click(screen.getByRole('radio', { name: /WhatsApp/ }))
    expect(((await screen.findByRole('textbox', { name: 'Message text' })) as HTMLTextAreaElement).value).toContain('Riverside Occasionals')

    await userEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getAllByRole('radio')).toHaveLength(5)
  })

  it('locks Initials only on, with the visible reason, for a junior league match', async () => {
    listLeagues.mockResolvedValue([{ id: 'league-1', name: 'U13 League', maxAge: 13 }])
    renderDialog({ leagueId: 'league-1' })

    await userEvent.click(screen.getByRole('radio', { name: /Facebook/ }))
    const toggle = await screen.findByRole('checkbox', { name: 'Initials only' })

    expect(toggle).toBeChecked()
    expect(toggle).toBeDisabled()
    expect(screen.getByText('Always on for junior leagues')).toBeInTheDocument()
  })

  it('asks before replacing typed edits when the style changes', async () => {
    renderDialog()
    await userEvent.click(screen.getByRole('radio', { name: /WhatsApp/ }))
    const box = await screen.findByRole('textbox', { name: 'Message text' })

    await userEvent.type(box, ' hello')
    await userEvent.click(screen.getByRole('button', { name: 'Scorecard text' }))
    expect(screen.getByText('Replace your edits?')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Replace' }))
    await waitFor(() => expect((screen.getByRole('textbox', { name: 'Message text' }) as HTMLTextAreaElement).value).not.toContain('hello'))
  })

  it('writes the club default through the share-settings endpoint', async () => {
    renderDialog()
    await userEvent.click(screen.getByRole('radio', { name: /WhatsApp/ }))

    await userEvent.click(await screen.findByRole('checkbox', { name: 'Make this the club default' }))

    await waitFor(() => expect(updateShareSettings).toHaveBeenCalledWith('club-1', { initialsOnlyDefault: true }))
  })
})
