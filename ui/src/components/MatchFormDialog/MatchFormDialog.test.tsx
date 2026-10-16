import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '@mui/material/styles'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { baseTheme } from '../../theme'
import { makeMatch } from '../../pages/manage/matches/matchTestUtils'
import { MatchFormDialog } from './MatchFormDialog'
import type { MatchFormDialogProps } from './MatchFormDialog'

const createMatch = vi.fn()
const listTeamsForClub = vi.fn()
const listSeasons = vi.fn()
const listLeagues = vi.fn()
const listLeagueAffiliations = vi.fn()

vi.mock('../../api/matchApi', () => ({ createMatch: (clubId: string, payload: unknown) => createMatch(clubId, payload) }))
vi.mock('../../api/teamApi', () => ({ listTeamsForClub: (clubId: string) => listTeamsForClub(clubId) }))
vi.mock('../../api/seasonApi', () => ({ listSeasons: (clubId: string) => listSeasons(clubId) }))
vi.mock('../../api/leagueApi', () => ({ listLeagues: (clubId: string) => listLeagues(clubId) }))
vi.mock('../../api/leagueAffiliationApi', () => ({ listLeagueAffiliations: () => listLeagueAffiliations() }))
vi.mock('../../api/leagueTeamApi', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../api/leagueTeamApi')>()), listLeagueTeams: () => Promise.resolve([]) }))
vi.mock('../../api/meApi', () => ({ activateSession: () => Promise.resolve({ personId: null, personStatus: null, platformAdmin: false, clubAdminClubIds: [] }) }))

const season = (id: string, label: string, startDate: string, endDate: string) => ({ id, clubId: 'club-1', label, startDate, endDate, active: true, createdAt: '', updatedAt: '', updatedBy: null })

beforeEach(() => {
  vi.clearAllMocks()
  listTeamsForClub.mockResolvedValue([{ id: 'team-1', clubId: 'club-1', sectionId: 's-1', name: '1st XI', logoUrl: null, active: true, createdAt: '', updatedAt: '', updatedBy: null }])
  listSeasons.mockResolvedValue([season('season-1', '2026/27', '2026-09-01', '2027-04-30')])
  listLeagues.mockResolvedValue([])
  listLeagueAffiliations.mockResolvedValue([])
})

function renderDialog(props: Partial<MatchFormDialogProps> = {}) {
  const onCreated = vi.fn()
  const onClose = vi.fn()
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <ThemeProvider theme={baseTheme}>
      <QueryClientProvider client={queryClient}>
        <MatchFormDialog open onClose={onClose} clubId="club-1" onCreated={onCreated} {...props} />
      </QueryClientProvider>
    </ThemeProvider>,
  )
  return { onCreated, onClose }
}

describe('MatchFormDialog', () => {
  it('opens prefilled from the document: both team names, the date, the hint, and the season that contains the date', async () => {
    renderDialog({
      hint: 'Filled in from the file.',
      inferSeason: true,
      initialValues: { homeTeamName: 'Northgate Strollers', awayTeamName: 'Riverside Occasionals', matchDate: new Date(2026, 9, 11, 13, 0).toISOString() },
    })

    expect(await screen.findByText('Filled in from the file.')).toBeInTheDocument()
    expect(await screen.findByLabelText('Home opponent name')).toHaveValue('Northgate Strollers')
    expect(screen.getByLabelText('Away opponent name')).toHaveValue('Riverside Occasionals')
    expect(screen.getByLabelText('Match date & time')).toHaveValue('2026-10-11T13:00')
    await waitFor(() => expect(screen.getByLabelText('Season')).toHaveTextContent('2026/27'))
  })

  it('opens a side whose name is exactly one of the club teams as My team, not as typed text', async () => {
    listTeamsForClub.mockResolvedValue([
      { id: 'team-u15', clubId: 'club-1', sectionId: 's-1', name: 'Northgate U15', logoUrl: null, active: true, createdAt: '', updatedAt: '', updatedBy: null },
      { id: 'team-1', clubId: 'club-1', sectionId: 's-1', name: '1st XI', logoUrl: null, active: true, createdAt: '', updatedAt: '', updatedBy: null },
    ])
    renderDialog({ initialValues: { homeTeamName: 'NORTHGATE UNDER 15', awayTeamName: 'Riverside Occasionals', matchDate: new Date(2026, 9, 11, 13, 0).toISOString() } })

    // The home side shows the club team (no free-text box); the other side stays typed text.
    expect(await screen.findByLabelText('Away opponent name')).toHaveValue('Riverside Occasionals')
    expect(screen.queryByLabelText('Home opponent name')).not.toBeInTheDocument()
    expect(screen.getByText('Northgate U15')).toBeInTheDocument()
  })

  it('leaves a name typed when two club teams share it or none does', async () => {
    listTeamsForClub.mockResolvedValue([
      { id: 'team-a', clubId: 'club-1', sectionId: 's-1', name: 'Northgate U15', logoUrl: null, active: true, createdAt: '', updatedAt: '', updatedBy: null },
      { id: 'team-b', clubId: 'club-1', sectionId: 's-2', name: 'northgate under 15', logoUrl: null, active: true, createdAt: '', updatedAt: '', updatedBy: null },
    ])
    renderDialog({ initialValues: { homeTeamName: 'Northgate U15', awayTeamName: 'Somewhere Else', matchDate: new Date(2026, 9, 11, 13, 0).toISOString() } })

    expect(await screen.findByLabelText('Home opponent name')).toHaveValue('Northgate U15')
    expect(screen.getByLabelText('Away opponent name')).toHaveValue('Somewhere Else')
  })

  it('never guesses between seasons: with two that contain the date none is chosen', async () => {
    listSeasons.mockResolvedValue([season('season-1', '2026/27', '2026-09-01', '2027-04-30'), season('season-2', 'Summer 2026', '2026-10-01', '2026-12-31')])
    renderDialog({ inferSeason: true, initialValues: { matchDate: new Date(2026, 9, 11, 13, 0).toISOString() } })

    await screen.findByLabelText('Match date & time')
    expect(screen.getByLabelText('Season')).not.toHaveTextContent('2026')
  })

  it('creates the match once a side is the club team, hands it to the caller and closes', async () => {
    const user = userEvent.setup()
    const created = makeMatch({ id: 'match-new', homeTeamId: 'team-1', awayTeamName: 'Riverside Occasionals' })
    createMatch.mockResolvedValue(created)
    const { onCreated, onClose } = renderDialog({
      inferSeason: true,
      initialValues: { homeTeamName: 'Northgate Strollers', awayTeamName: 'Riverside Occasionals', matchDate: new Date(2026, 9, 11, 13, 0).toISOString() },
    })

    await screen.findByLabelText('Home opponent name')
    await user.click(within(screen.getByTestId('match-side-home')).getByRole('button', { name: 'My team' }))
    await user.click(await screen.findByLabelText('Home team'))
    await user.click(await screen.findByRole('option', { name: '1st XI' }))
    await waitFor(() => expect(screen.getByLabelText('Season')).toHaveTextContent('2026/27'))
    await user.click(screen.getByRole('button', { name: 'Create match' }))

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(created))
    expect(createMatch).toHaveBeenCalledWith('club-1', expect.objectContaining({ homeTeamId: 'team-1', awayTeamName: 'Riverside Occasionals', seasonId: 'season-1' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('shows the server problem and stays open when the create fails', async () => {
    const user = userEvent.setup()
    createMatch.mockRejectedValue(new Error('boom'))
    const { onCreated, onClose } = renderDialog({ inferSeason: true, initialValues: { homeTeamName: 'A', awayTeamName: 'B', matchDate: new Date(2026, 9, 11, 13, 0).toISOString() } })

    await screen.findByLabelText('Home opponent name')
    await waitFor(() => expect(screen.getByLabelText('Season')).toHaveTextContent('2026/27'))
    await user.click(screen.getByRole('button', { name: 'Create match' }))

    expect(await screen.findByText(/Something went wrong saving this match/)).toBeInTheDocument()
    expect(onCreated).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('Cancel closes without creating', async () => {
    const user = userEvent.setup()
    const { onClose } = renderDialog()
    await user.click(await screen.findByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalled()
    expect(createMatch).not.toHaveBeenCalled()
  })
})
