import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LeagueFormPage from './LeagueFormPage'
import type { League } from '../../api/leagueApi'
import type { Season } from '../../api/seasonApi'
import type { Team } from '../../api/teamApi'
import type { LeagueAffiliation } from '../../api/leagueAffiliationApi'

const listLeagues = vi.fn()
const createLeague = vi.fn()
const updateLeague = vi.fn()
const deactivateLeague = vi.fn()
const reactivateLeague = vi.fn()
const listSeasons = vi.fn()
const listTeamsForClub = vi.fn()
const listLeagueAffiliations = vi.fn()
const createLeagueAffiliation = vi.fn()
const unaffiliateLeagueTeam = vi.fn()

vi.mock('../../api/leagueApi', () => ({
  listLeagues: (clubId: string) => listLeagues(clubId),
  createLeague: (clubId: string, payload: unknown) => createLeague(clubId, payload),
  updateLeague: (clubId: string, leagueId: string, payload: unknown) => updateLeague(clubId, leagueId, payload),
  deactivateLeague: (clubId: string, leagueId: string) => deactivateLeague(clubId, leagueId),
  reactivateLeague: (clubId: string, leagueId: string) => reactivateLeague(clubId, leagueId),
}))

vi.mock('../../api/seasonApi', () => ({
  listSeasons: (clubId: string) => listSeasons(clubId),
}))

vi.mock('../../api/teamApi', () => ({
  listTeamsForClub: (clubId: string) => listTeamsForClub(clubId),
}))

vi.mock('../../api/leagueAffiliationApi', () => ({
  listLeagueAffiliations: (clubId: string, leagueId: string) => listLeagueAffiliations(clubId, leagueId),
  createLeagueAffiliation: (clubId: string, leagueId: string, teamId: string, seasonId: string) =>
    createLeagueAffiliation(clubId, leagueId, teamId, seasonId),
  unaffiliateLeagueTeam: (clubId: string, leagueId: string, affiliationId: string) =>
    unaffiliateLeagueTeam(clubId, leagueId, affiliationId),
}))

function makeLeague(overrides: Partial<League> = {}): League {
  return {
    id: 'league-1',
    clubId: 'test-club-id',
    name: 'Internal League',
    source: 'INTERNAL',
    maxPlayingXiSize: 11,
    allowSubstitutions: false,
    minAge: null,
    maxAge: null,
    ageCutoffDate: null,
    active: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: null,
    ...overrides,
  }
}

function makeSeason(overrides: Partial<Season> = {}): Season {
  return {
    id: 'season-1',
    clubId: 'test-club-id',
    label: '2026',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    active: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: null,
    ...overrides,
  }
}

function makeTeam(overrides: Partial<Team> = {}): Team {
  return {
    id: 'team-1',
    clubId: 'test-club-id',
    sectionId: 'section-1',
    name: '1st XI',
    logoUrl: null,
    active: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: null,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  listSeasons.mockResolvedValue([])
  listTeamsForClub.mockResolvedValue([])
  listLeagueAffiliations.mockResolvedValue([])
})

function OutletContextWrapper({ clubId }: { clubId?: string }) {
  return <Outlet context={{ clubId }} />
}

function renderPage(initialPath: string, clubId?: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/manage/fixtures" element={<OutletContextWrapper clubId={clubId} />}>
            <Route path="leagues" element={<div>League List Page</div>} />
            <Route path="leagues/new" element={<LeagueFormPage />} />
            <Route path="leagues/:leagueId/edit" element={<LeagueFormPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('LeagueFormPage', () => {
  it('create mode: does not render tabs or the Affiliations tab content', async () => {
    renderPage('/manage/fixtures/leagues/new', 'test-club-id')

    expect(await screen.findByText('Add League')).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Affiliations' })).not.toBeInTheDocument()
    expect(listLeagueAffiliations).not.toHaveBeenCalled()
    // docs/specs/038-move-deactivate-to-edit-screen.md: never rendered on a brand-new, not-yet-
    // saved record.
    expect(screen.queryByRole('button', { name: 'Deactivate' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reactivate' })).not.toBeInTheDocument()
  })

  it('create mode: submits and navigates to the league list', async () => {
    const user = userEvent.setup()
    createLeague.mockResolvedValueOnce(makeLeague())

    renderPage('/manage/fixtures/leagues/new', 'test-club-id')

    await user.type(screen.getByLabelText('Name'), 'Internal League')
    await user.click(screen.getByRole('button', { name: 'Create league' }))

    expect(createLeague).toHaveBeenCalledWith(
      'test-club-id',
      expect.objectContaining({ name: 'Internal League' }),
    )
    expect(await screen.findByText('League List Page')).toBeInTheDocument()
  })

  it('edit mode: renders Details/Affiliations tabs, listing affiliated teams for the selected season', async () => {
    const user = userEvent.setup()
    listLeagues.mockResolvedValue([makeLeague({ id: 'league-1' })])
    listSeasons.mockResolvedValue([makeSeason({ id: 'season-1', label: '2026', startDate: '2020-01-01', endDate: '2020-12-31' })])
    listTeamsForClub.mockResolvedValue([makeTeam({ id: 'team-1', name: '1st XI' })])
    listLeagueAffiliations.mockResolvedValue([
      { id: 'aff-1', leagueId: 'league-1', teamId: 'team-1', seasonId: 'season-1', createdAt: '2026-01-01T00:00:00Z', createdBy: null } as LeagueAffiliation,
    ])

    renderPage('/manage/fixtures/leagues/league-1/edit', 'test-club-id')

    await screen.findByText('Edit League')
    await user.click(screen.getByRole('tab', { name: 'Affiliations' }))

    expect(await screen.findByText('1st XI')).toBeInTheDocument()
  })

  it('edit mode: affiliates a team for the selected season via "Add team"', async () => {
    const user = userEvent.setup()
    listLeagues.mockResolvedValue([makeLeague({ id: 'league-1' })])
    listSeasons.mockResolvedValue([makeSeason({ id: 'season-1' })])
    listTeamsForClub.mockResolvedValue([makeTeam({ id: 'team-2', name: '2nd XI' })])
    listLeagueAffiliations.mockResolvedValue([])

    renderPage('/manage/fixtures/leagues/league-1/edit', 'test-club-id')

    await screen.findByText('Edit League')
    await user.click(screen.getByRole('tab', { name: 'Affiliations' }))
    await user.click(await screen.findByRole('button', { name: 'Add team' }))

    const combobox = await screen.findByRole('combobox', { name: 'Search teams' })
    await user.click(combobox)
    await user.click(await screen.findByRole('option', { name: '2nd XI' }))

    expect(createLeagueAffiliation).toHaveBeenCalledWith('test-club-id', 'league-1', 'team-2', 'season-1')
  })

  it('edit mode: unaffiliates a team via the card action', async () => {
    const user = userEvent.setup()
    listLeagues.mockResolvedValue([makeLeague({ id: 'league-1' })])
    listSeasons.mockResolvedValue([makeSeason({ id: 'season-1' })])
    listTeamsForClub.mockResolvedValue([makeTeam({ id: 'team-1', name: '1st XI' })])
    listLeagueAffiliations.mockResolvedValue([
      { id: 'aff-1', leagueId: 'league-1', teamId: 'team-1', seasonId: 'season-1', createdAt: '2026-01-01T00:00:00Z', createdBy: null } as LeagueAffiliation,
    ])

    renderPage('/manage/fixtures/leagues/league-1/edit', 'test-club-id')

    await screen.findByText('Edit League')
    await user.click(screen.getByRole('tab', { name: 'Affiliations' }))
    await user.click(await screen.findByRole('button', { name: 'Unaffiliate' }))

    expect(unaffiliateLeagueTeam).toHaveBeenCalledWith('test-club-id', 'league-1', 'aff-1')
  })

  // docs/specs/038-move-deactivate-to-edit-screen.md: relocated from LeagueList's own card, plus
  // the tab-gating restructure — the button must render on both tabs, not just Details.
  describe('Deactivate/Reactivate', () => {
    it('edit mode: renders Deactivate for an active league on the Details tab, clicking it calls deactivateLeague', async () => {
      const user = userEvent.setup()
      listLeagues.mockResolvedValueOnce([makeLeague({ id: 'league-1', active: true })])
      // onSuccess invalidates the list query while this page's own useQuery is still mounted,
      // triggering a refetch that must resolve to the now-inactive record for the button to
      // relabel.
      listLeagues.mockResolvedValueOnce([makeLeague({ id: 'league-1', active: false })])
      let resolveDeactivate: (value: League) => void = () => {}
      deactivateLeague.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveDeactivate = resolve
        }),
      )

      renderPage('/manage/fixtures/leagues/league-1/edit', 'test-club-id')

      await screen.findByText('Edit League')
      await user.click(screen.getByRole('button', { name: 'Deactivate' }))

      expect(deactivateLeague).toHaveBeenCalledWith('test-club-id', 'league-1')
      expect(await screen.findByRole('button', { name: 'Deactivating…' })).toBeInTheDocument()

      resolveDeactivate(makeLeague({ id: 'league-1', active: false }))

      expect(await screen.findByRole('button', { name: 'Reactivate' })).toBeInTheDocument()
    })

    it('edit mode: renders Reactivate for an inactive league, clicking it calls reactivateLeague', async () => {
      const user = userEvent.setup()
      listLeagues.mockResolvedValue([makeLeague({ id: 'league-1', active: false })])
      reactivateLeague.mockResolvedValueOnce(makeLeague({ id: 'league-1', active: true }))

      renderPage('/manage/fixtures/leagues/league-1/edit', 'test-club-id')

      await screen.findByText('Edit League')
      await user.click(screen.getByRole('button', { name: 'Reactivate' }))

      expect(reactivateLeague).toHaveBeenCalledWith('test-club-id', 'league-1')
    })

    it('still renders on the Affiliations tab, while Save is hidden there', async () => {
      const user = userEvent.setup()
      listLeagues.mockResolvedValue([makeLeague({ id: 'league-1', active: true })])

      renderPage('/manage/fixtures/leagues/league-1/edit', 'test-club-id')

      await screen.findByText('Edit League')
      await user.click(screen.getByRole('tab', { name: 'Affiliations' }))

      expect(await screen.findByRole('button', { name: 'Deactivate' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument()
    })
  })
})
