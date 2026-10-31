import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LeagueFormPage from './LeagueFormPage'
import { LeagueEditRoute } from './LeagueEditRoute'
import type { League } from '../../api/leagueApi'
import type { Season } from '../../api/seasonApi'
import type { Team } from '../../api/teamApi'
import type { LeagueContact } from '../../api/leagueContactApi'

// docs/specs/122-league-sharing.md (Entry points): the dialog has its own test; here it is a stub that shows what the Schedule
// and Playing conditions tabs open it with.
vi.mock('../../components/ShareLeagueDialog', () => ({
  ShareLeagueDialog: (props: { open: boolean; preselected: string[]; league: { name: string }; seasonId?: string | null }) =>
    props.open ? (
      <div role="dialog" aria-label="Share league" data-preselected={props.preselected.join(',')} data-season={props.seasonId ?? ''}>
        <h2>Share league</h2>
      </div>
    ) : null,
}))

const listLeagues = vi.fn()
const createLeague = vi.fn()
const updateLeague = vi.fn()
const deactivateLeague = vi.fn()
const reactivateLeague = vi.fn()
const duplicateLeague = vi.fn()
const listSeasons = vi.fn()
const listTeamsForClub = vi.fn()
const listLeagueAffiliations = vi.fn()
const createLeagueAffiliation = vi.fn()
const unaffiliateLeagueTeam = vi.fn()
const listMatches = vi.fn()
const getPlayingConditions = vi.fn()
const uploadPlayingConditions = vi.fn()
const updatePlayingConditions = vi.fn()
const listLeagueContacts = vi.fn()
const getLeagueAgeReference = vi.fn()
const getLeagueSeasonDates = vi.fn()
const putLeagueSeasonDates = vi.fn()
vi.mock('../../api/leagueSeasonDatesApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/leagueSeasonDatesApi')>()),
  getLeagueSeasonDates: (...args: unknown[]) => getLeagueSeasonDates(...args),
  putLeagueSeasonDates: (...args: unknown[]) => putLeagueSeasonDates(...args),
}))

vi.mock('../../api/leagueApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/leagueApi')>()
  return {
    ...actual,
    listLeagues: (clubId: string) => listLeagues(clubId),
    getLeagueAgeReference: (...args: unknown[]) => getLeagueAgeReference(...args),
    createLeague: (clubId: string, payload: unknown) => createLeague(clubId, payload),
    updateLeague: (clubId: string, leagueId: string, payload: unknown) => updateLeague(clubId, leagueId, payload),
    deactivateLeague: (clubId: string, leagueId: string) => deactivateLeague(clubId, leagueId),
    reactivateLeague: (clubId: string, leagueId: string) => reactivateLeague(clubId, leagueId),
    duplicateLeague: (clubId: string, leagueId: string, request: unknown) => duplicateLeague(clubId, leagueId, request),
  }
})

vi.mock('../../api/seasonApi', () => ({
  listSeasons: (clubId: string) => listSeasons(clubId),
}))

const listLeagueTeams = vi.fn()

vi.mock('../../api/leagueTeamApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/leagueTeamApi')>()
  return {
    ...actual,
    listLeagueTeams: (clubId: string, leagueId: string, seasonId: string) => listLeagueTeams(clubId, leagueId, seasonId),
  }
})

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

// docs/specs/050-league-schedule-and-fixtures.md: the new Schedule tab's own data, matches
// (listMatches, reused unmodified from the existing matchApi) and Playing Conditions (the new
// leaguePlayingConditionsApi module).
// docs/specs/072-league-view-pages.md: matchApi stays real so the Schedule tab's listAllMatches paging
// is genuinely exercised; only the HTTP layer is stubbed, routing each page request to the
// `listMatches(clubId, params)` mock below.
vi.mock('../../api/axiosConfig', () => ({
  default: {
    get: async (url: string, config: { params: unknown }) => ({
      data: url.includes('/imports')
        ? { content: [], totalElements: 0, totalPages: 0, number: 0, size: 1 }
        : await listMatches(url.split('/')[3], config.params),
    }),
  },
}))

vi.mock('../../api/leaguePlayingConditionsApi', async () => ({
  PLAYING_CONDITIONS_PDF_NAME: (
    await vi.importActual<typeof import('../../api/leaguePlayingConditionsApi')>('../../api/leaguePlayingConditionsApi')
  ).PLAYING_CONDITIONS_PDF_NAME,
  getPlayingConditions: (clubId: string, leagueId: string, seasonId: string) =>
    getPlayingConditions(clubId, leagueId, seasonId),
  uploadPlayingConditions: (clubId: string, leagueId: string, seasonId: string, file: File) =>
    uploadPlayingConditions(clubId, leagueId, seasonId, file),
  updatePlayingConditions: (clubId: string, leagueId: string, seasonId: string, payload: unknown) =>
    updatePlayingConditions(clubId, leagueId, seasonId, payload),
}))

// docs/specs/054-league-contacts.md: the new Contacts tab's own contact list.
vi.mock('../../api/leagueContactApi', () => ({
  listLeagueContacts: (clubId: string, leagueId: string) => listLeagueContacts(clubId, leagueId),
}))

function makeLeague(overrides: Partial<League> = {}): League {
  return {
    id: 'league-1',
    clubId: 'test-club-id',
    name: 'Internal League',
    source: 'INTERNAL',
    maxPlayingXiSize: 11,
    minAge: null,
    maxAge: null,
    ageCutoffMonth: null,
    ageCutoffDay: null,
    active: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: null,
    currentSeasonTeamCount: 1,
    currentSeasonLabel: '2026',
    currentSeasonPlayingConditionsUrl: null,
    matchCount: null,
    playedCount: null,
    firstMatchDate: null,
    lastMatchDate: null,
    nextMatchDate: null,
    teams: null,
    format: null,
    logoUrl: null,
    phone: null,
    website: null,
    email: null,
    socialLinks: [],
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
    abbreviation: null,
    groundName: null,
    socialLinks: [],
    active: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: null,
    ...overrides,
  }
}

function makeContact(overrides: Partial<LeagueContact> = {}): LeagueContact {
  return {
    id: 'contact-1',
    leagueId: 'league-1',
    contact: {
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane.smith@example.com',
      phone: '+27 21 555 0100',
    },
    role: 'League Administrator',
    isPrimary: false,
    active: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: null,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  listLeagueTeams.mockResolvedValue([])
  listSeasons.mockResolvedValue([])
  listTeamsForClub.mockResolvedValue([])
  listLeagueAffiliations.mockResolvedValue([])
  listMatches.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
  getPlayingConditions.mockResolvedValue(null)
  listLeagueContacts.mockResolvedValue([])
  getLeagueAgeReference.mockRejectedValue(new Error('no reference'))
  getLeagueSeasonDates.mockResolvedValue({ startDate: '2025-02-01', endDate: '2025-10-31' })
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
            <Route path="leagues/:leagueId/edit" element={<LeagueEditRoute />} />
            <Route path="leagues/:leagueId/schedule" element={<RouterLocationStub label="League Schedule Page" />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function RouterLocationStub({ label }: { label: string }) {
  const location = useLocation()
  return (
    <div>
      {label}
      <span data-testid="stub-at">{location.pathname + location.search}</span>
    </div>
  )
}

describe('LeagueFormPage', () => {
  // docs/specs/127-return-navigation.md: Back, Cancel and Save return to where the page was opened from.
  describe('return navigation (127)', () => {
    const TEAMS_ORIGIN = '/manage/fixtures/leagues/league-1/teams?seasonId=season-1'
    const WITH_ORIGIN = `/manage/fixtures/leagues/league-1/edit?tab=details&seasonId=season-1&returnTo=${encodeURIComponent(TEAMS_ORIGIN)}&returnLabel=${encodeURIComponent('Internal League teams')}`

    it('Back and Cancel go to the origin and Back reads "Back to {label}"', async () => {
      listLeagues.mockResolvedValue([makeLeague({ id: 'league-1' })])
      renderPage(WITH_ORIGIN, 'test-club-id')
      await screen.findByText('Edit League')
      expect(screen.getByRole('link', { name: 'Back to Internal League teams' })).toHaveAttribute('href', TEAMS_ORIGIN)
      expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute('href', TEAMS_ORIGIN)
    })

    it('without a returnTo, Back goes to the Leagues list and Cancel to the league page with the season', async () => {
      listLeagues.mockResolvedValue([makeLeague({ id: 'league-1' })])
      renderPage('/manage/fixtures/leagues/league-1/edit?seasonId=season-1', 'test-club-id')
      await screen.findByText('Edit League')
      expect(screen.getByRole('link', { name: 'Back to Leagues' })).toHaveAttribute('href', '/manage/fixtures/leagues')
      expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute('href', '/manage/fixtures/leagues/league-1/schedule?seasonId=season-1')
    })

    it('ignores an external returnTo', async () => {
      listLeagues.mockResolvedValue([makeLeague({ id: 'league-1' })])
      renderPage('/manage/fixtures/leagues/league-1/edit?returnTo=https%3A%2F%2Fevil.example&returnLabel=Evil', 'test-club-id')
      await screen.findByText('Edit League')
      expect(screen.getByRole('link', { name: 'Back to Leagues' })).toHaveAttribute('href', '/manage/fixtures/leagues')
    })

    it('Save returns to the origin', async () => {
      const user = userEvent.setup()
      listLeagues.mockResolvedValue([makeLeague({ id: 'league-1' })])
      updateLeague.mockResolvedValueOnce(makeLeague({ id: 'league-1' }))
      const origin = '/manage/fixtures/leagues/league-1/schedule?seasonId=season-1'
      renderPage(`/manage/fixtures/leagues/league-1/edit?seasonId=season-1&returnTo=${encodeURIComponent(origin)}&returnLabel=Schedule`, 'test-club-id')
      await screen.findByText('Edit League')
      await user.click(screen.getByRole('button', { name: 'Save Changes' }))
      expect(await screen.findByText('League Schedule Page')).toBeInTheDocument()
      expect(screen.getByTestId('stub-at')).toHaveTextContent('/manage/fixtures/leagues/league-1/schedule?seasonId=season-1')
    })
  })

  // docs/specs/091 (D) and 128: Cancel beside Save, on Details and Branding only.
  it('shows Cancel on Details and Branding only, linking back to the league (edit) or the list (add)', async () => {
    const user = userEvent.setup()
    listLeagues.mockResolvedValue([makeLeague({ id: 'league-1' })])

    const { unmount } = renderPage('/manage/fixtures/leagues/league-1/edit', 'test-club-id')
    await screen.findByText('Edit League')
    expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute('href', '/manage/fixtures/leagues/league-1/schedule')
    await user.click(screen.getByRole('tab', { name: 'Branding' }))
    expect(screen.getByRole('link', { name: 'Cancel' })).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Contacts' }))
    expect(screen.queryByRole('link', { name: 'Cancel' })).not.toBeInTheDocument()
    unmount()

    renderPage('/manage/fixtures/leagues/new', 'test-club-id')
    await screen.findByText('Add League')
    expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute('href', '/manage/fixtures/leagues')
  })

  it('create mode: does not render tabs, the Season pill or the Teams tab content, even with ?tab=', async () => {
    listSeasons.mockResolvedValue([makeSeason()])
    renderPage('/manage/fixtures/leagues/new?tab=teams', 'test-club-id')

    expect(await screen.findByText('Add League')).toBeInTheDocument()
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Teams' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Season' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create League' })).toBeInTheDocument()
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
    await user.click(screen.getByRole('button', { name: 'Create League' }))

    expect(createLeague).toHaveBeenCalledWith(
      'test-club-id',
      expect.objectContaining({ name: 'Internal League' }),
    )
    expect(await screen.findByText('League List Page')).toBeInTheDocument()
  })

  // docs/specs/053-league-extended-profile.md: LeagueFormPage's initialValues object (passed to
  // <LeagueForm>) must correctly thread the five new profile fields from the fetched league
  // through to the form on the edit path, LeagueForm.test.tsx's own "prefills the Basic Info tab
  // from initialValues" test already proves LeagueForm renders these correctly given the right
  // props; this proves LeagueFormPage actually passes them.
  // docs/specs/110: the age cut-off day and month round trip, and the page shows the date ages are judged on.
  it('edit mode: prefills the cut-off month and day, and shows the date ages are judged on', async () => {
    listLeagues.mockResolvedValue([makeLeague({ id: 'league-1', maxAge: 15, ageCutoffMonth: 12, ageCutoffDay: 31 })])
    listSeasons.mockResolvedValue([makeSeason({ id: 'season-1' })])
    getLeagueAgeReference.mockResolvedValue({
      referenceDate: '2026-12-31',
      source: 'CUTOFF',
      leagueStart: '2026-09-05',
      leagueStartSource: 'FIRST_MATCH',
    })

    renderPage('/manage/fixtures/leagues/league-1/edit', 'test-club-id')

    await screen.findByText('Edit League')
    expect(screen.getByLabelText('Cut-off month (optional)')).toHaveTextContent('December')
    expect(screen.getByLabelText('Cut-off day (optional)')).toHaveTextContent('31')
    expect(await screen.findByTestId('league-age-reference')).toHaveTextContent('Ages are judged on 31 Dec 2026 (the cut-off)')
    expect(getLeagueAgeReference).toHaveBeenCalledWith('test-club-id', 'league-1', 'season-1')
  })

  it('add mode: opens with 31 December and saves it with no age limits', async () => {
    const user = userEvent.setup()
    createLeague.mockResolvedValue(makeLeague({ id: 'new-league' }))
    renderPage('/manage/fixtures/leagues/new', 'test-club-id')

    expect(await screen.findByLabelText('Cut-off month (optional)')).toHaveTextContent('December')
    expect(screen.getByLabelText('Cut-off day (optional)')).toHaveTextContent('31')
    await user.type(screen.getByLabelText('Name'), 'Fresh League')
    await user.click(screen.getByRole('button', { name: /save|create/i }))

    await waitFor(() => expect(createLeague).toHaveBeenCalled())
    expect(createLeague.mock.calls[0][1]).toMatchObject({ ageCutoffMonth: 12, ageCutoffDay: 31, minAge: null, maxAge: null })
  })

  it('edit mode: a league with no stored cut-off stays empty', async () => {
    listLeagues.mockResolvedValue([makeLeague({ id: 'league-1' })])
    renderPage('/manage/fixtures/leagues/league-1/edit', 'test-club-id')

    await screen.findByText('Edit League')
    expect(screen.getByLabelText('Cut-off month (optional)')).toHaveTextContent(/^\u200b?$/)
  })

  it('edit mode: the day the league starts is named when there is no cut-off', async () => {
    listLeagues.mockResolvedValue([makeLeague({ id: 'league-1', minAge: 12 })])
    listSeasons.mockResolvedValue([makeSeason({ id: 'season-1' })])
    getLeagueAgeReference.mockResolvedValue({
      referenceDate: '2027-07-14',
      source: 'LEAGUE_START',
      leagueStart: '2027-07-14',
      leagueStartSource: 'SEASON_START',
    })

    renderPage('/manage/fixtures/leagues/league-1/edit', 'test-club-id')

    expect(await screen.findByTestId('league-age-reference')).toHaveTextContent(
      'Ages are judged on 14 Jul 2027 (the day the league starts)',
    )
  })

  it('edit mode: no age line for a league without an age limit', async () => {
    listLeagues.mockResolvedValue([makeLeague({ id: 'league-1' })])
    listSeasons.mockResolvedValue([makeSeason({ id: 'season-1' })])

    renderPage('/manage/fixtures/leagues/league-1/edit', 'test-club-id')

    await screen.findByText('Edit League')
    expect(screen.queryByTestId('league-age-reference')).not.toBeInTheDocument()
    expect(getLeagueAgeReference).not.toHaveBeenCalled()
  })

  it('edit mode: prefills the form with the fetched league\'s format/logoUrl/phone/website/email/socialLinks', async () => {
    listLeagues.mockResolvedValue([
      makeLeague({
        id: 'league-1',
        maxPlayingXiSize: 12,
        format: 'T20',
        phone: '+27 21 555 0177',
        website: 'https://riverside.example.com',
        email: 'league@riverside.example.com',
        logoUrl: '/media/managed/league-logo.png',
        socialLinks: [{ platform: 'facebook', url: 'https://facebook.com/riverside-league' }],
      }),
    ])

    renderPage('/manage/fixtures/leagues/league-1/edit', 'test-club-id')

    await screen.findByText('Edit League')
    expect(screen.getByLabelText('Playing XI size')).toHaveValue(12)
    expect(screen.getByLabelText('Format')).toHaveTextContent('T20')
    expect(screen.getByLabelText('Phone (optional)')).toHaveValue('+27 21 555 0177')
    expect(screen.getByLabelText('Website (optional)')).toHaveValue('https://riverside.example.com')
    expect(screen.getByLabelText('Email (optional)')).toHaveValue('league@riverside.example.com')
    // The logo and social links are on the Branding tab (docs/specs/128).
    await userEvent.setup().click(screen.getByRole('tab', { name: 'Branding' }))
    expect(screen.getByRole('button', { name: 'Replace' })).toBeInTheDocument()
    expect(screen.getByDisplayValue('https://facebook.com/riverside-league')).toBeInTheDocument()
  })

  // docs/specs/095-league-edit-gold-standard.md (Shell): the compact tab strip bound to ?tab=, the one header Season pill and
  // the footer that exists only where there is something to save.
  describe('Shell', () => {
    const TWO_SEASONS = [
      makeSeason({ id: 'season-1', label: '2024', startDate: '2024-01-01', endDate: '2024-12-31', createdAt: '2024-01-01T00:00:00Z' }),
      makeSeason({ id: 'season-2', label: '2025', startDate: '2025-01-01', endDate: '2025-12-31', createdAt: '2025-01-01T00:00:00Z' }),
    ]

    function renderAt(path: string) {
      return renderPage(path, 'test-club-id')
    }

    beforeEach(() => {
      listLeagues.mockResolvedValue([makeLeague({ id: 'league-1' })])
      listSeasons.mockResolvedValue(TWO_SEASONS)
    })

    it('renders a real tablist with the four tabs in order', async () => {
      renderAt('/manage/fixtures/leagues/league-1/edit')

      await screen.findByText('Edit League')
      expect(screen.getByRole('tablist')).toBeInTheDocument()
      expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Details', 'Branding', 'Playing Conditions', 'Contacts'])
    })

    it.each([
      ['branding', 'Branding'],
      ['conditions', 'Playing Conditions'],
      ['contacts', 'Contacts'],
      ['details', 'Details'],
    ])('?tab=%s selects the %s tab', async (value, label) => {
      renderAt(`/manage/fixtures/leagues/league-1/edit?tab=${value}`)

      await screen.findByText('Edit League')
      expect(screen.getByRole('tab', { name: label })).toHaveAttribute('aria-selected', 'true')
    })

    it.each(['teams', 'schedule', 'nonsense'])('opens Details for the retired or unknown ?tab=%s', async (value) => {
      renderAt(`/manage/fixtures/leagues/league-1/edit?tab=${value}`)

      await screen.findByText('Edit League')
      expect(screen.getByRole('tab', { name: 'Details' })).toHaveAttribute('aria-selected', 'true')
      expect(screen.getByLabelText('Name')).toBeVisible()
    })

    it('shows the right content for ?tab=branding, ?tab=contacts and ?tab=conditions', async () => {
      const { unmount } = renderAt('/manage/fixtures/leagues/league-1/edit?tab=branding')
      expect(await screen.findByRole('heading', { level: 2, name: 'Branding and social' })).toBeInTheDocument()
      expect(screen.queryByRole('heading', { level: 2, name: 'Basic info' })).not.toBeInTheDocument()
      unmount()

      const second = renderAt('/manage/fixtures/leagues/league-1/edit?tab=contacts')
      expect(await screen.findByText('No contacts yet for this league.')).toBeInTheDocument()
      second.unmount()

      renderAt('/manage/fixtures/leagues/league-1/edit?tab=conditions')
      expect(await screen.findByText(/^Playing conditions for /)).toBeInTheDocument()
    })

    // docs/specs/128: the Season dates row opens the Details card; the page's one pill chooses the season.
    it('Details shows the Season dates row without its own Season select, and saves for the pill\'s season', async () => {
      const user = userEvent.setup()
      putLeagueSeasonDates.mockResolvedValue({ startDate: '2024-03-01', endDate: '2024-09-30' })
      renderAt('/manage/fixtures/leagues/league-1/edit?tab=details')

      expect(await screen.findByTestId('league-season-dates')).toBeInTheDocument()
      await waitFor(() => expect(getLeagueSeasonDates).toHaveBeenCalledWith('test-club-id', 'league-1', 'season-2'))
      expect(screen.queryByRole('combobox', { name: 'Season' })).not.toBeInTheDocument()
      expect(screen.getByRole('heading', { name: 'Season dates' })).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Season' }))
      await user.click(await screen.findByRole('option', { name: '2024' }))
      await waitFor(() => expect(getLeagueSeasonDates).toHaveBeenCalledWith('test-club-id', 'league-1', 'season-1'))

      await user.click(screen.getByRole('button', { name: 'Save Season Dates' }))
      await waitFor(() =>
        expect(putLeagueSeasonDates).toHaveBeenCalledWith('test-club-id', 'league-1', 'season-1', {
          startDate: '2025-02-01',
          endDate: '2025-10-31',
        }),
      )
    })

    it('the dates row buttons are both compact and the same size', async () => {
      renderAt('/manage/fixtures/leagues/league-1/edit?tab=details')
      const useBtn = await screen.findByRole('button', { name: 'Use First and Last Match' })
      const saveBtn = screen.getByRole('button', { name: 'Save Season Dates' })
      expect(useBtn.className).toContain('MuiButton-sizeSmall')
      expect(saveBtn.className).toContain('MuiButton-sizeSmall')
    })

    it('has no Season dates row on Branding, Playing Conditions or Contacts', async () => {
      const user = userEvent.setup()
      renderAt('/manage/fixtures/leagues/league-1/edit')
      await screen.findByTestId('league-season-dates')
      for (const name of ['Branding', 'Playing Conditions', 'Contacts']) {
        await user.click(screen.getByRole('tab', { name }))
        expect(screen.queryByTestId('league-season-dates')).not.toBeInTheDocument()
      }
    })

    it('Add page has no Season dates block', async () => {
      renderAt('/manage/fixtures/leagues/new')
      await screen.findByLabelText('Name')
      expect(screen.queryByTestId('league-season-dates')).not.toBeInTheDocument()
    })

    it('shows the one Season pill on Details and Playing Conditions only', async () => {
      const user = userEvent.setup()
      renderAt('/manage/fixtures/leagues/league-1/edit')

      await screen.findByText('Edit League')
      expect(await screen.findByRole('button', { name: 'Season' })).toBeInTheDocument()

      for (const name of ['Branding', 'Contacts']) {
        await user.click(screen.getByRole('tab', { name }))
        expect(screen.queryByRole('button', { name: 'Season' })).not.toBeInTheDocument()
      }

      await user.click(screen.getByRole('tab', { name: 'Playing Conditions' }))
      expect(await screen.findByRole('button', { name: 'Season' })).toBeInTheDocument()
      expect(screen.getAllByRole('button', { name: 'Season' })).toHaveLength(1)

      await user.click(screen.getByRole('tab', { name: 'Details' }))
      expect(await screen.findByRole('button', { name: 'Season' })).toBeInTheDocument()
    })

    it('one Season pill drives the Details dates and the Playing Conditions tab', async () => {
      const user = userEvent.setup()
      renderAt('/manage/fixtures/leagues/league-1/edit')

      await screen.findByText('Edit League')
      // The default is the most recently created season.
      await waitFor(() => expect(getLeagueSeasonDates).toHaveBeenCalledWith('test-club-id', 'league-1', 'season-2'))
      expect(screen.getByRole('button', { name: 'Season' })).toHaveTextContent('2025')

      await user.click(screen.getByRole('button', { name: 'Season' }))
      await user.click(await screen.findByRole('option', { name: '2024' }))
      await waitFor(() => expect(getLeagueSeasonDates).toHaveBeenCalledWith('test-club-id', 'league-1', 'season-1'))
      await waitFor(() =>
        expect(listMatches).toHaveBeenCalledWith('test-club-id', expect.objectContaining({ seasonId: 'season-1' })),
      )

      await user.click(screen.getByRole('tab', { name: 'Playing Conditions' }))
      expect(screen.getByRole('button', { name: 'Season' })).toHaveTextContent('2024')
      await waitFor(() => expect(getPlayingConditions).toHaveBeenCalledWith('test-club-id', 'league-1', 'season-1'))
    })

    it('starts on ?seasonId= when it names one of the club\'s seasons', async () => {
      renderAt('/manage/fixtures/leagues/league-1/edit?seasonId=season-1')

      await screen.findByText('Edit League')
      await waitFor(() => expect(getLeagueSeasonDates).toHaveBeenCalledWith('test-club-id', 'league-1', 'season-1'))
      expect(screen.getByRole('button', { name: 'Season' })).toHaveTextContent('2024')
    })

    it('falls back to the default season when ?seasonId= is not one of the club\'s seasons', async () => {
      renderAt('/manage/fixtures/leagues/league-1/edit?seasonId=nope')

      await screen.findByText('Edit League')
      await waitFor(() => expect(getLeagueSeasonDates).toHaveBeenCalledWith('test-club-id', 'league-1', 'season-2'))
      expect(screen.getByRole('button', { name: 'Season' })).toHaveTextContent('2025')
    })

    it('hides the pill and keeps the "Create a season first" message on Playing Conditions when the club has no season', async () => {
      listSeasons.mockResolvedValue([])
      renderAt('/manage/fixtures/leagues/league-1/edit?tab=conditions')

      expect(await screen.findByText(/Create a season first/)).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Season' })).not.toBeInTheDocument()
    })

    it('keeps the other parameters (seasonId) when switching tab', async () => {
      const user = userEvent.setup()
      renderAt('/manage/fixtures/leagues/league-1/edit?seasonId=season-1')

      await screen.findByText('Edit League')
      await user.click(screen.getByRole('tab', { name: 'Playing Conditions' }))

      await waitFor(() => expect(getPlayingConditions).toHaveBeenCalledWith('test-club-id', 'league-1', 'season-1'))
    })

    it.each(['details', 'branding'])('has a footer on %s: Cancel, Save Changes, Duplicate League and Deactivate', async (tab) => {
      renderAt(`/manage/fixtures/leagues/league-1/edit?tab=${tab}`)

      await screen.findByText('Edit League')
      expect(screen.getByRole('link', { name: 'Cancel' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Save Changes' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Duplicate League' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Deactivate' })).toBeInTheDocument()
    })

    it.each(['conditions', 'contacts'])('has no league footer on the %s tab', async (tab) => {
      renderAt(`/manage/fixtures/leagues/league-1/edit?tab=${tab}`)

      await screen.findByText('Edit League')
      expect(screen.queryByRole('link', { name: 'Cancel' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Save Changes' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Deactivate' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Reactivate' })).not.toBeInTheDocument()
    })

    // docs/specs/128: Details and Branding are one form, so edits on both tabs save together.
    it('saves edits made on Details and on Branding together, in one payload', async () => {
      const user = userEvent.setup()
      updateLeague.mockResolvedValue(makeLeague({ id: 'league-1' }))
      renderAt('/manage/fixtures/leagues/league-1/edit')

      await screen.findByText('Edit League')
      await user.clear(screen.getByLabelText('Name'))
      await user.type(screen.getByLabelText('Name'), 'Renamed League')
      await user.click(screen.getByRole('tab', { name: 'Branding' }))
      await user.click(screen.getByRole('button', { name: 'Add link' }))
      await user.click(screen.getByRole('button', { name: 'Save Changes' }))

      await waitFor(() => expect(updateLeague).toHaveBeenCalledTimes(1))
      expect(updateLeague).toHaveBeenCalledWith('test-club-id', 'league-1', expect.objectContaining({ name: 'Renamed League' }))
    })
  })

  // docs/specs/052-league-playing-conditions.md and docs/specs/095: the Playing conditions tab - a content line with the
  // PDF upload / view and Share, the sectioned PlayingConditionsForm, and a footer Save bound to the form by id.
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

    it('shows the scope line and an Upload button (no document yet) on the content line', async () => {
      const user = userEvent.setup()
      getPlayingConditions.mockResolvedValue(null)

      renderPlayingConditionsTab()

      await screen.findByText('Edit League')
      await user.click(screen.getByRole('tab', { name: 'Playing Conditions' }))

      expect(await screen.findByText('Playing conditions for 2026')).toBeInTheDocument()
      expect(await screen.findByRole('button', { name: 'Upload' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Playing Conditions.pdf' })).not.toBeInTheDocument()
    })

    it('does not render the DocumentUpload control under the Contacts tab', async () => {
      const user = userEvent.setup()
      getPlayingConditions.mockResolvedValue(null)

      renderPlayingConditionsTab()

      await screen.findByText('Edit League')
      await user.click(screen.getByRole('tab', { name: 'Contacts' }))

      expect(screen.queryByRole('button', { name: 'Upload' })).not.toBeInTheDocument()
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

      // docs/specs/072-league-view-pages.md: the stored uuid file name is never shown.
      expect(await screen.findByRole('button', { name: 'Playing Conditions.pdf' })).toBeInTheDocument()
      expect(screen.queryByText('2f6a1c9e-playing-conditions.pdf')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Replace' })).toBeInTheDocument()
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
      await screen.findByRole('button', { name: 'Upload' })

      const file = new File(['%PDF-1.4'], 'playing-conditions.pdf', { type: 'application/pdf' })
      await user.upload(screen.getByLabelText('Playing Conditions file'), file)

      await waitFor(() =>
        expect(uploadPlayingConditions).toHaveBeenCalledWith('test-club-id', 'league-1', 'season-1', file),
      )
    })

    it('renders the sectioned PlayingConditionsForm and saves from the footer button via updatePlayingConditions', async () => {
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

      for (const name of ['Innings', 'Points', 'Bonus points', 'Notes']) {
        expect(await screen.findByRole('heading', { name })).toBeInTheDocument()
      }
      expect(screen.queryByText('Full Document')).not.toBeInTheDocument()
      expect(screen.queryByText('Match Format & Points')).not.toBeInTheDocument()

      await user.type(screen.getByLabelText('Max overs per innings'), '20')
      await user.type(screen.getByLabelText('Powerplay overs'), '6')
      await user.click(screen.getByRole('button', { name: 'Save playing conditions' }))

      await waitFor(() =>
        expect(updatePlayingConditions).toHaveBeenCalledWith(
          'test-club-id',
          'league-1',
          'season-1',
          expect.objectContaining({ maxOversPerInnings: 20, powerplayOvers: 6 }),
        ),
      )
    })

    // docs/specs/052-league-playing-conditions.md: a second, independent Share flow, never
    // touches the Schedule tab's own ShareScheduleDialog/shareOpen state.
    it('"Share" button on the Playing Conditions tab opens the Share League dialog', async () => {
      const user = userEvent.setup()
      getPlayingConditions.mockResolvedValue(null)

      renderPlayingConditionsTab()

      await screen.findByText('Edit League')
      await user.click(screen.getByRole('tab', { name: 'Playing Conditions' }))

      expect(screen.queryByText('Share league')).not.toBeInTheDocument()

      await user.click(await screen.findByRole('button', { name: 'Share' }))

      expect(await screen.findByText('Share league')).toBeInTheDocument()
      // The Playing conditions tab preselects Playing conditions only.
      expect(screen.getByRole('dialog', { name: 'Share league' })).toHaveAttribute('data-preselected', 'CONDITIONS')
    })
  })

  // docs/specs/054-league-contacts.md and docs/specs/095: the last "Contacts" tab, only in edit mode, a panel of the
  // league's own named contacts as zebra rows, with a filled "Add contact" in its header.
  describe('Contacts tab', () => {
    function renderContactsTab() {
      return render(
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <MemoryRouter initialEntries={['/manage/fixtures/leagues/league-1/edit']}>
            <Routes>
              <Route path="/manage/fixtures" element={<OutletContextWrapper clubId="test-club-id" />}>
                <Route path="leagues/:leagueId/edit" element={<LeagueFormPage />} />
              </Route>
              <Route path="/manage/fixtures/leagues/:leagueId/contacts/new" element={<AddContactPageStub />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>,
      )
    }

    function AddContactPageStub() {
      return <div>Add League Contact Page</div>
    }

    beforeEach(() => {
      listLeagues.mockResolvedValue([makeLeague({ id: 'league-1' })])
    })

    it('does not render a Contacts tab in create mode', async () => {
      renderPage('/manage/fixtures/leagues/new', 'test-club-id')

      expect(await screen.findByText('Add League')).toBeInTheDocument()
      expect(screen.queryByRole('tab', { name: 'Contacts' })).not.toBeInTheDocument()
      expect(listLeagueContacts).not.toHaveBeenCalled()
    })

    it('renders the Contacts tab as the 4th tab, after Playing Conditions', async () => {
      const user = userEvent.setup()
      renderContactsTab()

      await screen.findByText('Edit League')
      // Switch off the Details tab first, LeagueForm renders its own nested "Basic Info"/
      // "Branding"/"Social Media" Tabs while active, which would otherwise also match
      // getAllByRole('tab') and pollute this assertion about the outer tab row.
      await user.click(screen.getByRole('tab', { name: 'Contacts' }))
      const tabs = screen.getAllByRole('tab').map((tab) => tab.textContent)

      expect(tabs).toEqual(['Details', 'Branding', 'Playing Conditions', 'Contacts'])
    })

    it('lists the league\'s contacts as rows with Role, Email and Phone, and the Primary badge', async () => {
      const user = userEvent.setup()
      listLeagueContacts.mockResolvedValue([
        makeContact({ id: 'contact-1', role: 'League Administrator', isPrimary: true }),
      ])

      renderContactsTab()

      await screen.findByText('Edit League')
      await user.click(screen.getByRole('tab', { name: 'Contacts' }))

      expect(listLeagueContacts).toHaveBeenCalledWith('test-club-id', 'league-1')
      expect(await screen.findByText('Jane Smith')).toBeInTheDocument()
      expect(screen.getByTestId('league-contact-role')).toHaveTextContent('League Administrator')
      expect(screen.getByText('jane.smith@example.com')).toBeInTheDocument()
      expect(screen.getByText('+27 21 555 0100')).toBeInTheDocument()
      expect(screen.getByText('Primary')).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: 'Contacts · 1' })).toBeInTheDocument()
    })

    it('opens the contact\'s View and Edit routes from the row actions', async () => {
      const user = userEvent.setup()
      listLeagueContacts.mockResolvedValue([makeContact({ id: 'contact-1' })])

      renderContactsTab()

      await screen.findByText('Edit League')
      await user.click(screen.getByRole('tab', { name: 'Contacts' }))

      await user.click(await screen.findByRole('button', { name: 'Actions for Jane Smith' }))
      expect(screen.getByRole('menuitem', { name: 'View Contact' })).toHaveAttribute(
        'href',
        expect.stringMatching(/^\/manage\/fixtures\/leagues\/league\-1\/contacts\/contact\-1\?returnTo=.*tab%3Dcontacts.*returnLabel=League\+contacts/),
      )
      expect(screen.getByRole('menuitem', { name: 'Edit Contact' })).toHaveAttribute(
        'href',
        expect.stringMatching(/^\/manage\/fixtures\/leagues\/league\-1\/contacts\/contact\-1\/edit\?returnTo=.*tab%3Dcontacts.*returnLabel=League\+contacts/),
      )
    })

    it('renders "No contacts yet for this league." when there are none', async () => {
      const user = userEvent.setup()
      listLeagueContacts.mockResolvedValue([])

      renderContactsTab()

      await screen.findByText('Edit League')
      await user.click(screen.getByRole('tab', { name: 'Contacts' }))

      expect(await screen.findByText('No contacts yet for this league.')).toBeInTheDocument()
      // The filled Add contact stays in the panel header even when empty.
      expect(screen.getByRole('button', { name: 'Add Contact' })).toBeInTheDocument()
    })

    it('"Add contact" navigates to the new League Contact route', async () => {
      const user = userEvent.setup()
      listLeagueContacts.mockResolvedValue([])

      renderContactsTab()

      await screen.findByText('Edit League')
      await user.click(screen.getByRole('tab', { name: 'Contacts' }))
      await user.click(await screen.findByRole('button', { name: 'Add Contact' }))

      expect(await screen.findByText('Add League Contact Page')).toBeInTheDocument()
    })
  })

  // docs/specs/038-move-deactivate-to-edit-screen.md: relocated from LeagueList's own card; docs/specs/095: it now lives
  // in the Details footer only.
  // docs/specs/096-duplicate-league.md: the Duplicate league entry on the Details footer, the success notice carried in
  // router state, and a fresh page instance per league.
  describe('Duplicate league', () => {
    const TWO_SEASONS = [
      makeSeason({ id: 'season-1', label: '2024', startDate: '2024-01-01', endDate: '2024-12-31', createdAt: '2024-01-01T00:00:00Z' }),
      makeSeason({ id: 'season-2', label: '2025', startDate: '2025-01-01', endDate: '2025-12-31', createdAt: '2025-01-01T00:00:00Z' }),
    ]

    function LocationAndNav() {
      const location = useLocation()
      const navigate = useNavigate()
      return (
        <>
          <div data-testid="location">{`${location.pathname}${location.search}`}</div>
          <div data-testid="state">{JSON.stringify(location.state)}</div>
          <button type="button" onClick={() => navigate('/manage/fixtures/leagues/league-2/edit?tab=teams&seasonId=season-2')}>
            Go to league 2
          </button>
        </>
      )
    }

    function renderEntry(entry: string | { pathname: string; state: unknown }) {
      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
      return render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={[entry]}>
            <LocationAndNav />
            <Routes>
              <Route path="/manage/fixtures" element={<OutletContextWrapper clubId="test-club-id" />}>
                <Route path="leagues/new" element={<LeagueFormPage />} />
                <Route path="leagues/:leagueId/edit" element={<LeagueEditRoute />} />
              </Route>
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>,
      )
    }

    beforeEach(() => {
      listLeagues.mockResolvedValue([makeLeague({ id: 'league-1' }), makeLeague({ id: 'league-2', name: 'Division 2' })])
      listSeasons.mockResolvedValue(TWO_SEASONS)
    })

    it('shows Duplicate league beside Deactivate on the Details footer in edit mode', async () => {
      renderEntry('/manage/fixtures/leagues/league-1/edit')

      const button = await screen.findByRole('button', { name: 'Duplicate League' })
      expect(button.className).toContain('MuiButton-outlined')
      expect(screen.getByRole('button', { name: 'Deactivate' })).toBeInTheDocument()
    })

    it.each(['conditions', 'contacts'])('is not on the %s tab, which has no footer', async (tab) => {
      renderEntry(`/manage/fixtures/leagues/league-1/edit?tab=${tab}`)

      await screen.findByText('Edit League')
      expect(screen.queryByRole('button', { name: 'Duplicate League' })).not.toBeInTheDocument()
    })

    it('is not on Add League', async () => {
      renderEntry('/manage/fixtures/leagues/new')

      await screen.findByText('Add League')
      expect(screen.queryByRole('button', { name: 'Duplicate League' })).not.toBeInTheDocument()
    })

    it('opens the dialog prefilled for this league with the page season ticked', async () => {
      const user = userEvent.setup()
      renderEntry('/manage/fixtures/leagues/league-1/edit?seasonId=season-1')

      await user.click(await screen.findByRole('button', { name: 'Duplicate League' }))

      const dialog = await screen.findByRole('dialog')
      expect(within(dialog).getByLabelText(/New league name/)).toHaveValue('Internal League (copy)')
      expect(within(dialog).getByRole('checkbox', { name: '2024' })).toBeChecked()
      expect(within(dialog).getByRole('checkbox', { name: '2025' })).not.toBeChecked()
    })

    it('duplicates, lands on the new league Details on that season, and shows the notice, then clears the router state', async () => {
      const user = userEvent.setup()
      duplicateLeague.mockResolvedValue({
        leagueId: 'league-2',
        name: 'Division 2',
        seasonsCopied: 1,
        playingConditionsCopied: 1,
        contactsCopied: 2,
      })
      renderEntry('/manage/fixtures/leagues/league-1/edit?seasonId=season-1')

      await user.click(await screen.findByRole('button', { name: 'Duplicate League' }))
      const dialog = await screen.findByRole('dialog')
      await user.clear(within(dialog).getByLabelText(/New league name/))
      await user.type(within(dialog).getByLabelText(/New league name/), 'Division 2')
      await user.click(within(dialog).getByRole('button', { name: 'Duplicate league' }))

      await waitFor(() =>
        expect(screen.getByTestId('location')).toHaveTextContent('/manage/fixtures/leagues/league-2/edit?seasonId=season-1'),
      )
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Division 2 created. Playing conditions copied for 1 season, 2 contacts. Add its teams next.',
      )
      await waitFor(() => expect(getLeagueSeasonDates).toHaveBeenCalledWith('test-club-id', 'league-2', 'season-1'))
      expect(screen.getByRole('button', { name: 'Season' })).toHaveTextContent('2024')
      await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('null'))
    })

    it('shows a notice from router state, and the close button dismisses it', async () => {
      const user = userEvent.setup()
      renderEntry({ pathname: '/manage/fixtures/leagues/league-1/edit', state: { notice: 'Division 2 created. Add its teams next.' } })

      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent('Division 2 created. Add its teams next.')
      await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('null'))
      expect(screen.getByRole('alert')).toBeInTheDocument()

      await user.click(within(alert).getByRole('button', { name: 'Close' }))
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('shows no notice when the router state carries none', async () => {
      renderEntry('/manage/fixtures/leagues/league-1/edit')

      await screen.findByText('Edit League')
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('uses a fresh page, and the new ?seasonId=, when navigating from one league edit page to another', async () => {
      const user = userEvent.setup()
      renderEntry('/manage/fixtures/leagues/league-1/edit?seasonId=season-1')

      await screen.findByText('Edit League')
      await waitFor(() => expect(getLeagueSeasonDates).toHaveBeenCalledWith('test-club-id', 'league-1', 'season-1'))
      expect(screen.getByRole('button', { name: 'Season' })).toHaveTextContent('2024')

      await user.click(screen.getByRole('button', { name: 'Go to league 2' }))

      await waitFor(() => expect(getLeagueSeasonDates).toHaveBeenCalledWith('test-club-id', 'league-2', 'season-2'))
      expect(screen.getByRole('button', { name: 'Season' })).toHaveTextContent('2025')
      expect(getLeagueSeasonDates).not.toHaveBeenCalledWith('test-club-id', 'league-2', 'season-1')
    })
  })

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

    it('is not rendered on the Contacts tab, nor is Save', async () => {
      const user = userEvent.setup()
      listLeagues.mockResolvedValue([makeLeague({ id: 'league-1', active: true })])

      renderPage('/manage/fixtures/leagues/league-1/edit', 'test-club-id')

      await screen.findByText('Edit League')
      expect(screen.getByRole('button', { name: 'Deactivate' })).toBeInTheDocument()
      await user.click(screen.getByRole('tab', { name: 'Contacts' }))

      expect(screen.queryByRole('button', { name: 'Deactivate' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Save Changes' })).not.toBeInTheDocument()
    })

    it('Reactivate is likewise only on the Details tab', async () => {
      const user = userEvent.setup()
      listLeagues.mockResolvedValue([makeLeague({ id: 'league-1', active: false })])

      renderPage('/manage/fixtures/leagues/league-1/edit', 'test-club-id')

      await screen.findByText('Edit League')
      expect(screen.getByRole('button', { name: 'Reactivate' })).toBeInTheDocument()
      await user.click(screen.getByRole('tab', { name: 'Contacts' }))

      expect(screen.queryByRole('button', { name: 'Reactivate' })).not.toBeInTheDocument()
    })
  })
})
