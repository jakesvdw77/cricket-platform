import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LeagueFormPage from './LeagueFormPage'
import type { League } from '../../api/leagueApi'
import type { Season } from '../../api/seasonApi'
import type { Team } from '../../api/teamApi'
import type { Match } from '../../api/matchApi'
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
const listMatches = vi.fn()
const getPlayingConditions = vi.fn()
const uploadPlayingConditions = vi.fn()
const updatePlayingConditions = vi.fn()

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

// docs/specs/050-league-schedule-and-fixtures.md: the new Schedule tab's own data — matches
// (listMatches, reused unmodified from the existing matchApi) and Playing Conditions (the new
// leaguePlayingConditionsApi module).
vi.mock('../../api/matchApi', () => ({
  listMatches: (clubId: string, params: unknown) => listMatches(clubId, params),
}))

vi.mock('../../api/leaguePlayingConditionsApi', () => ({
  getPlayingConditions: (clubId: string, leagueId: string, seasonId: string) =>
    getPlayingConditions(clubId, leagueId, seasonId),
  uploadPlayingConditions: (clubId: string, leagueId: string, seasonId: string, file: File) =>
    uploadPlayingConditions(clubId, leagueId, seasonId, file),
  updatePlayingConditions: (clubId: string, leagueId: string, seasonId: string, payload: unknown) =>
    updatePlayingConditions(clubId, leagueId, seasonId, payload),
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
    currentSeasonTeamCount: 1,
    currentSeasonLabel: '2026',
    currentSeasonPlayingConditionsUrl: null,
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

function makeMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: 'match-1',
    clubId: 'test-club-id',
    homeTeamId: 'team-1',
    homeTeamName: null,
    awayTeamId: null,
    awayTeamName: 'Riverside Occasionals',
    leagueId: 'league-1',
    seasonId: 'season-1',
    matchDate: '2026-06-01T14:30:00Z',
    venue: 'Riverside Oval',
    active: true,
    homeSideAnnounced: false,
    awaySideAnnounced: false,
    homeTeamLogoUrl: null,
    awayTeamLogoUrl: null,
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
  listMatches.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
  getPlayingConditions.mockResolvedValue(null)
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
  it('create mode: does not render tabs or the Teams tab content', async () => {
    renderPage('/manage/fixtures/leagues/new', 'test-club-id')

    expect(await screen.findByText('Add League')).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Teams' })).not.toBeInTheDocument()
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

  it('edit mode: renders Details/Teams tabs, listing affiliated teams for the selected season', async () => {
    const user = userEvent.setup()
    listLeagues.mockResolvedValue([makeLeague({ id: 'league-1' })])
    listSeasons.mockResolvedValue([makeSeason({ id: 'season-1', label: '2026', startDate: '2020-01-01', endDate: '2020-12-31' })])
    listTeamsForClub.mockResolvedValue([makeTeam({ id: 'team-1', name: '1st XI' })])
    listLeagueAffiliations.mockResolvedValue([
      { id: 'aff-1', leagueId: 'league-1', teamId: 'team-1', seasonId: 'season-1', createdAt: '2026-01-01T00:00:00Z', createdBy: null } as LeagueAffiliation,
    ])

    renderPage('/manage/fixtures/leagues/league-1/edit', 'test-club-id')

    await screen.findByText('Edit League')
    await user.click(screen.getByRole('tab', { name: 'Teams' }))

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
    await user.click(screen.getByRole('tab', { name: 'Teams' }))
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
    await user.click(screen.getByRole('tab', { name: 'Teams' }))
    await user.click(await screen.findByRole('button', { name: 'Unaffiliate' }))

    expect(unaffiliateLeagueTeam).toHaveBeenCalledWith('test-club-id', 'league-1', 'aff-1')
  })

  // docs/specs/050-league-schedule-and-fixtures.md item 4/28: the new Schedule tab — a season-
  // scoped fixture list (via LeagueFixtures), an "Add Match" shortcut pre-filling League/Season,
  // and the Playing Conditions DocumentUpload control.
  describe('Schedule tab', () => {
    function renderScheduleTab() {
      const routerRender = render(
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <MemoryRouter initialEntries={['/manage/fixtures/leagues/league-1/edit']}>
            <Routes>
              <Route path="/manage/fixtures" element={<OutletContextWrapper clubId="test-club-id" />}>
                <Route path="leagues/:leagueId/edit" element={<LeagueFormPage />} />
              </Route>
              <Route
                path="/manage/fixtures/matches/new"
                element={<AddMatchPageStub />}
              />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>,
      )
      return routerRender
    }

    function AddMatchPageStub() {
      // Renders the route's own current location search so the test can assert the exact
      // ?leagueId=&seasonId= query string the "Add Match" shortcut navigates with.
      const location = useLocation()
      return <div>Add Match Page: {location.search}</div>
    }

    beforeEach(() => {
      listLeagues.mockResolvedValue([makeLeague({ id: 'league-1' })])
      listSeasons.mockResolvedValue([makeSeason({ id: 'season-1', label: '2026' })])
      listTeamsForClub.mockResolvedValue([makeTeam({ id: 'team-1', name: '1st XI' })])
    })

    it('renders the league+season\'s matches via LeagueFixtures', async () => {
      const user = userEvent.setup()
      listMatches.mockResolvedValue({
        content: [makeMatch({ homeTeamId: 'team-1', awayTeamName: 'Riverside Occasionals' })],
        totalElements: 1,
        totalPages: 1,
        number: 0,
        size: 20,
      })

      renderScheduleTab()

      await screen.findByText('Edit League')
      await user.click(screen.getByRole('tab', { name: 'Schedule' }))

      expect(await screen.findByText('1st XI')).toBeInTheDocument()
      expect(screen.getByText('Riverside Occasionals')).toBeInTheDocument()
      expect(listMatches).toHaveBeenCalledWith(
        'test-club-id',
        expect.objectContaining({ leagueId: 'league-1', seasonId: 'season-1' }),
      )
    })

    it('renders the League Fixtures empty state when the selected season has no matches yet', async () => {
      const user = userEvent.setup()

      renderScheduleTab()

      await screen.findByText('Edit League')
      await user.click(screen.getByRole('tab', { name: 'Schedule' }))

      expect(await screen.findByText('No fixtures yet')).toBeInTheDocument()
    })

    it('"Add Match" navigates to the create route pre-filling the selected League and Season as query params', async () => {
      const user = userEvent.setup()

      renderScheduleTab()

      await screen.findByText('Edit League')
      await user.click(screen.getByRole('tab', { name: 'Schedule' }))
      await user.click(await screen.findByRole('button', { name: 'Add Match' }))

      expect(await screen.findByText('Add Match Page: ?leagueId=league-1&seasonId=season-1')).toBeInTheDocument()
    })

    // docs/specs/051-league-schedule-sharing.md item 8: the Share button, rendered alongside "Add
    // Match" in the same row, opens the same ShareScheduleDialog used on LeagueDetailPage.tsx.
    it('"Share" button, alongside "Add Match", opens ShareScheduleDialog', async () => {
      const user = userEvent.setup()

      renderScheduleTab()

      await screen.findByText('Edit League')
      await user.click(screen.getByRole('tab', { name: 'Schedule' }))

      expect(screen.getByRole('button', { name: 'Add Match' })).toBeInTheDocument()
      expect(screen.queryByText('Share Schedule')).not.toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Share' }))

      expect(await screen.findByText('Share Schedule')).toBeInTheDocument()
    })

  })

  // docs/specs/052-league-playing-conditions.md: promotes Playing Conditions out of the Schedule
  // tab into its own 4th tab — the "Full Document" DocumentUpload control (relocated, unchanged
  // capability) plus the new structured PlayingConditionsForm.
  describe('Playing Conditions tab', () => {
    function renderPlayingConditionsTab() {
      return render(
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <MemoryRouter initialEntries={['/manage/fixtures/leagues/league-1/edit']}>
            <Routes>
              <Route path="/manage/fixtures" element={<OutletContextWrapper clubId="test-club-id" />}>
                <Route path="leagues/:leagueId/edit" element={<LeagueFormPage />} />
              </Route>
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>,
      )
    }

    beforeEach(() => {
      listLeagues.mockResolvedValue([makeLeague({ id: 'league-1' })])
      listSeasons.mockResolvedValue([makeSeason({ id: 'season-1', label: '2026' })])
      listTeamsForClub.mockResolvedValue([makeTeam({ id: 'team-1', name: '1st XI' })])
    })

    it('renders the Playing Conditions DocumentUpload control under a "Full Document" heading, empty by default', async () => {
      const user = userEvent.setup()
      getPlayingConditions.mockResolvedValue(null)

      renderPlayingConditionsTab()

      await screen.findByText('Edit League')
      await user.click(screen.getByRole('tab', { name: 'Playing Conditions' }))

      expect(await screen.findByText('Full Document')).toBeInTheDocument()
      expect(await screen.findByText('No document uploaded yet')).toBeInTheDocument()
    })

    it('does not render the DocumentUpload control under the Schedule tab any more', async () => {
      const user = userEvent.setup()
      getPlayingConditions.mockResolvedValue(null)

      renderPlayingConditionsTab()

      await screen.findByText('Edit League')
      await user.click(screen.getByRole('tab', { name: 'Schedule' }))

      expect(screen.queryByText('No document uploaded yet')).not.toBeInTheDocument()
    })

    it('renders the uploaded Playing Conditions document with a View action once one exists', async () => {
      const user = userEvent.setup()
      getPlayingConditions.mockResolvedValue({
        id: 'pc-1',
        leagueId: 'league-1',
        seasonId: 'season-1',
        documentUrl: '/media/2f6a1c9e-playing-conditions.pdf',
        uploadedAt: '2026-02-01T09:00:00Z',
        uploadedBy: null,
        maxOversPerInnings: null,
        powerplayOvers: null,
        maxOversPerBowler: null,
        fieldingRestrictionsNotes: null,
        pointsForWin: null,
        pointsForLoss: null,
        pointsForDraw: null,
        pointsForNoResult: null,
        pointsForForfeitWin: null,
        bonusPointsEnabled: false,
        bonusBattingOversThreshold: null,
        bonusBowlingRestrictionPercentage: null,
        additionalNotes: null,
      })

      renderPlayingConditionsTab()

      await screen.findByText('Edit League')
      await user.click(screen.getByRole('tab', { name: 'Playing Conditions' }))

      expect(await screen.findByText('2f6a1c9e-playing-conditions.pdf')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'View' })).toBeInTheDocument()
    })

    it('uploading a Playing Conditions PDF calls uploadPlayingConditions for the selected league+season', async () => {
      const user = userEvent.setup()
      getPlayingConditions.mockResolvedValue(null)
      uploadPlayingConditions.mockResolvedValueOnce({
        id: 'pc-1',
        leagueId: 'league-1',
        seasonId: 'season-1',
        documentUrl: '/media/playing-conditions.pdf',
        uploadedAt: '2026-02-01T09:00:00Z',
        uploadedBy: null,
      })

      renderPlayingConditionsTab()

      await screen.findByText('Edit League')
      await user.click(screen.getByRole('tab', { name: 'Playing Conditions' }))
      await screen.findByText('No document uploaded yet')

      const file = new File(['%PDF-1.4'], 'playing-conditions.pdf', { type: 'application/pdf' })
      await user.upload(screen.getByLabelText('Playing Conditions file'), file)

      await waitFor(() =>
        expect(uploadPlayingConditions).toHaveBeenCalledWith('test-club-id', 'league-1', 'season-1', file),
      )
    })

    it('renders PlayingConditionsForm under a "Match Format & Points" heading and saves via updatePlayingConditions', async () => {
      const user = userEvent.setup()
      getPlayingConditions.mockResolvedValue(null)
      updatePlayingConditions.mockResolvedValueOnce({
        id: 'pc-1',
        leagueId: 'league-1',
        seasonId: 'season-1',
        documentUrl: null,
        uploadedAt: null,
        uploadedBy: null,
        maxOversPerInnings: 20,
        powerplayOvers: 6,
        maxOversPerBowler: null,
        fieldingRestrictionsNotes: null,
        pointsForWin: 2,
        pointsForLoss: 0,
        pointsForDraw: 1,
        pointsForNoResult: 1,
        pointsForForfeitWin: 2,
        bonusPointsEnabled: false,
        bonusBattingOversThreshold: null,
        bonusBowlingRestrictionPercentage: null,
        additionalNotes: null,
      })

      renderPlayingConditionsTab()

      await screen.findByText('Edit League')
      await user.click(screen.getByRole('tab', { name: 'Playing Conditions' }))

      expect(await screen.findByText('Match Format & Points')).toBeInTheDocument()

      await user.type(screen.getByLabelText('Max overs per innings'), '20')
      await user.type(screen.getByLabelText('Powerplay overs'), '6')
      await user.click(screen.getByRole('button', { name: 'Save Playing Conditions' }))

      await waitFor(() =>
        expect(updatePlayingConditions).toHaveBeenCalledWith(
          'test-club-id',
          'league-1',
          'season-1',
          expect.objectContaining({ maxOversPerInnings: 20, powerplayOvers: 6 }),
        ),
      )
    })

    // docs/specs/052-league-playing-conditions.md: a second, independent Share flow — never
    // touches the Schedule tab's own ShareScheduleDialog/shareOpen state.
    it('"Share" button on the Playing Conditions tab opens PlayingConditionsShareDialog, independent of the Schedule tab\'s own Share', async () => {
      const user = userEvent.setup()
      getPlayingConditions.mockResolvedValue(null)

      renderPlayingConditionsTab()

      await screen.findByText('Edit League')
      await user.click(screen.getByRole('tab', { name: 'Playing Conditions' }))

      expect(screen.queryByText('Share Schedule')).not.toBeInTheDocument()
      expect(screen.queryByText('Share Playing Conditions')).not.toBeInTheDocument()

      await user.click(await screen.findByRole('button', { name: 'Share' }))

      expect(await screen.findByText('Share Playing Conditions')).toBeInTheDocument()
      expect(screen.queryByText('Share Schedule')).not.toBeInTheDocument()
    })
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

    it('still renders on the Teams tab, while Save is hidden there', async () => {
      const user = userEvent.setup()
      listLeagues.mockResolvedValue([makeLeague({ id: 'league-1', active: true })])

      renderPage('/manage/fixtures/leagues/league-1/edit', 'test-club-id')

      await screen.findByText('Edit League')
      await user.click(screen.getByRole('tab', { name: 'Teams' }))

      expect(await screen.findByRole('button', { name: 'Deactivate' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument()
    })
  })
})
