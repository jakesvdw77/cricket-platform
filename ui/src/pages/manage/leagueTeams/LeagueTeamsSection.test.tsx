import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError } from 'axios'
import type { AxiosResponse } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LeagueTeamsSection } from './LeagueTeamsSection'
import { makeLeagueTeam } from './testUtils'

const listLeagueTeams = vi.fn()
const createLeagueTeam = vi.fn()
const removeLeagueTeam = vi.fn()
const copyLeagueTeams = vi.fn()
const listLeagues = vi.fn()
const listSeasons = vi.fn()

vi.mock('../../../api/leagueTeamApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/leagueTeamApi')>()
  return {
    ...actual,
    listLeagueTeams: (...args: unknown[]) => listLeagueTeams(...args),
    createLeagueTeam: (...args: unknown[]) => createLeagueTeam(...args),
    removeLeagueTeam: (...args: unknown[]) => removeLeagueTeam(...args),
    copyLeagueTeams: (...args: unknown[]) => copyLeagueTeams(...args),
  }
})
vi.mock('../../../api/leagueApi', () => ({ listLeagues: (...args: unknown[]) => listLeagues(...args) }))
vi.mock('../../../api/seasonApi', () => ({ listSeasons: (...args: unknown[]) => listSeasons(...args) }))
vi.mock('../../../api/mediaApi', () => ({ uploadMedia: vi.fn(), uploadManagedMedia: vi.fn() }))

function renderSection() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <LeagueTeamsSection clubId="club-1" leagueId="league-1" seasonId="season-2" contextLabel="TVL Division 1 · 2026/27" />
    </QueryClientProvider>,
  )
}

const SEASON = (id: string, label: string, startDate: string) => ({
  id, clubId: 'club-1', label, startDate, endDate: startDate, active: true, createdAt: '', updatedAt: '', updatedBy: null,
})

beforeEach(() => {
  vi.clearAllMocks()
  listLeagues.mockResolvedValue([{ id: 'league-1', name: 'TVL Division 1' }])
  listSeasons.mockResolvedValue([
    SEASON('season-2', '2026/27', '2026-09-01'),
    SEASON('season-1', '2025/26', '2025-09-01'),
    SEASON('season-0', '2024/25', '2024-09-01'),
  ])
})

describe('LeagueTeamsSection', () => {
  it('shows an empty state with Add and Copy actions', async () => {
    listLeagueTeams.mockResolvedValue([])
    renderSection()
    expect(await screen.findByText('No league teams yet')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add league team' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Copy teams from/ })).toBeInTheDocument()
  })

  it('renders active and inactive cards', async () => {
    listLeagueTeams.mockResolvedValue([makeLeagueTeam(), makeLeagueTeam({ id: 'lt-2', name: 'Ladium', active: false })])
    renderSection()
    expect(await screen.findByRole('heading', { name: 'Centurion Brits CC' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Ladium' })).toBeInTheDocument()
    expect(screen.getByText('Inactive')).toBeInTheDocument()
  })

  it('adds a league team for the selected league and season', async () => {
    const user = userEvent.setup()
    listLeagueTeams.mockResolvedValue([])
    createLeagueTeam.mockResolvedValue(makeLeagueTeam())
    renderSection()
    await user.click(await screen.findByRole('button', { name: 'Add league team' }))
    await user.type(screen.getByLabelText(/Team name/), 'Police')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(createLeagueTeam).toHaveBeenCalledWith('club-1', 'league-1', 'season-2', { name: 'Police', abbreviation: null, logoUrl: null }),
    )
  })

  function axiosFailure(status: number, detail: string) {
    return new AxiosError('failed', undefined, undefined, undefined, {
      status,
      data: { detail },
    } as AxiosResponse)
  }

  it('shows a 409 duplicate against the Name field', async () => {
    const user = userEvent.setup()
    listLeagueTeams.mockResolvedValue([])
    createLeagueTeam.mockRejectedValue(axiosFailure(409, 'Police is already registered for this season.'))
    renderSection()
    await user.click(await screen.findByRole('button', { name: 'Add league team' }))
    await user.type(screen.getByLabelText(/Team name/), 'Police')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Police is already registered for this season.')).toBeInTheDocument()
    expect(screen.getByLabelText(/Team name/)).toHaveAttribute('aria-invalid', 'true')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows any other save error as a dialog-level alert', async () => {
    const user = userEvent.setup()
    listLeagueTeams.mockResolvedValue([])
    createLeagueTeam.mockRejectedValue(axiosFailure(400, 'Abbreviation too long.'))
    renderSection()
    await user.click(await screen.findByRole('button', { name: 'Add league team' }))
    await user.type(screen.getByLabelText(/Team name/), 'Police')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Abbreviation too long.')
    expect(screen.getByLabelText(/Team name/)).not.toHaveAttribute('aria-invalid', 'true')
  })

  it('confirms an unreferenced remove as a delete and reports the outcome', async () => {
    const user = userEvent.setup()
    listLeagueTeams.mockResolvedValue([makeLeagueTeam()])
    removeLeagueTeam.mockResolvedValue({ outcome: 'DELETED', leagueTeam: null })
    renderSection()
    await user.click(await screen.findByRole('button', { name: 'Remove Centurion Brits CC' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Delete Centurion Brits CC?')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))
    expect(await screen.findByText('Centurion Brits CC was deleted.')).toBeInTheDocument()
    expect(removeLeagueTeam).toHaveBeenCalledWith('club-1', 'league-1', 'season-2', 'lt-1')
  })

  it('says a referenced team will be deactivated, and reports the actual outcome', async () => {
    const user = userEvent.setup()
    listLeagueTeams.mockResolvedValue([makeLeagueTeam({ referencedByMatchCount: 4 })])
    removeLeagueTeam.mockResolvedValue({ outcome: 'DEACTIVATED', leagueTeam: makeLeagueTeam({ active: false }) })
    renderSection()
    await user.click(await screen.findByRole('button', { name: 'Remove Centurion Brits CC' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/is used in 4 matches, so it will be deactivated instead/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Deactivate' }))
    expect(await screen.findByText(/so it was deactivated instead/)).toBeInTheDocument()
  })

  describe('copy dialog', () => {
    const SOURCE = [
      makeLeagueTeam({ id: 's-1', seasonId: 'season-1', name: 'Centurion Brits CC' }),
      makeLeagueTeam({ id: 's-2', seasonId: 'season-1', name: 'Laudium Cricket Club', abbreviation: 'LCC' }),
      makeLeagueTeam({ id: 's-3', seasonId: 'season-1', name: 'Police', abbreviation: 'POL' }),
    ]

    beforeEach(() => {
      listLeagueTeams.mockImplementation((_club: string, _league: string, season: string) =>
        Promise.resolve(season === 'season-1' ? SOURCE : [makeLeagueTeam({ id: 't-1', name: 'police', abbreviation: null })]),
      )
    })

    it('defaults to the most recent other season, ticks all, disables duplicates and sends nothing until confirmed', async () => {
      const user = userEvent.setup()
      renderSection()
      await user.click(await screen.findByRole('button', { name: /Copy teams from/ }))
      const dialog = await screen.findByRole('dialog', { name: 'Copy league teams' })
      expect(await within(dialog).findByLabelText('Centurion Brits CC')).toBeChecked()
      expect(within(dialog).getByLabelText('Laudium Cricket Club')).toBeChecked()
      expect(within(dialog).getByLabelText('Police')).toBeDisabled()
      expect(within(dialog).getByText('Already in this season')).toBeInTheDocument()
      expect(within(dialog).getByRole('button', { name: 'Copy 2 teams' })).toBeEnabled()
      expect(copyLeagueTeams).not.toHaveBeenCalled()
    })

    it('disables confirm at zero ticked and sends only ticked ids on confirm, then reports the result', async () => {
      const user = userEvent.setup()
      copyLeagueTeams.mockResolvedValue({
        created: [makeLeagueTeam({ id: 'new-1' })],
        skipped: [{ name: 'Police', reason: 'DUPLICATE_NAME' }],
      })
      renderSection()
      await user.click(await screen.findByRole('button', { name: /Copy teams from/ }))
      const dialog = await screen.findByRole('dialog', { name: 'Copy league teams' })
      await user.click(await within(dialog).findByRole('button', { name: 'Select none' }))
      expect(within(dialog).getByRole('button', { name: 'Copy 0 teams' })).toBeDisabled()

      await user.click(within(dialog).getByLabelText('Laudium Cricket Club'))
      await user.click(within(dialog).getByRole('button', { name: 'Copy 1 team' }))

      await waitFor(() =>
        expect(copyLeagueTeams).toHaveBeenCalledWith('club-1', 'league-1', 'season-2', {
          sourceLeagueId: 'league-1',
          sourceSeasonId: 'season-1',
          leagueTeamIds: ['s-2'],
        }),
      )
      expect(await screen.findByText('Copied 1, skipped 1 (already here).')).toBeInTheDocument()
    })
  })
})
