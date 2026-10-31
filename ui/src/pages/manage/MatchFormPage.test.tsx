import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MatchFormPage from './MatchFormPage'
import type { Match } from '../../api/matchApi'
import { setDateTime } from '../../test/dateTimeField'

const getMatch = vi.fn()
const createMatch = vi.fn()
const updateMatch = vi.fn()
const deactivateMatch = vi.fn()
const deleteMatch = vi.fn()
const reactivateMatch = vi.fn()
const listTeamsForClub = vi.fn()
const listSeasons = vi.fn()
const listLeagues = vi.fn()
const listLeagueAffiliations = vi.fn()

vi.mock('../../api/matchApi', () => ({
  getMatch: (clubId: string, matchId: string) => getMatch(clubId, matchId),
  createMatch: (clubId: string, payload: unknown) => createMatch(clubId, payload),
  updateMatch: (clubId: string, matchId: string, payload: unknown) => updateMatch(clubId, matchId, payload),
  deactivateMatch: (clubId: string, matchId: string) => deactivateMatch(clubId, matchId),
  reactivateMatch: (clubId: string, matchId: string) => reactivateMatch(clubId, matchId),
  deleteMatch: (clubId: string, matchId: string) => deleteMatch(clubId, matchId),
}))

vi.mock('../../api/teamApi', () => ({
  listTeamsForClub: (clubId: string) => listTeamsForClub(clubId),
}))

vi.mock('../../api/seasonApi', () => ({
  listSeasons: (clubId: string) => listSeasons(clubId),
}))

vi.mock('../../api/leagueApi', () => ({
  listLeagues: (clubId: string) => listLeagues(clubId),
}))

vi.mock('../../api/leagueAffiliationApi', () => ({
  listLeagueAffiliations: (clubId: string, leagueId: string) => listLeagueAffiliations(clubId, leagueId),
}))

const activateSession = vi.fn()
const listLeagueTeams = vi.fn()

vi.mock('../../api/meApi', () => ({
  activateSession: () => activateSession(),
}))

vi.mock('../../api/leagueTeamApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/leagueTeamApi')>()
  return {
    ...actual,
    listLeagueTeams: (clubId: string, leagueId: string, seasonId: string) => listLeagueTeams(clubId, leagueId, seasonId),
  }
})

function makeMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: 'match-1',
    clubId: 'test-club-id',
    homeTeamId: 'team-1',
    homeTeamName: null,
    awayTeamId: 'team-2',
    awayTeamName: null,
    leagueId: null,
    seasonId: 'season-1',
    matchDate: '2026-06-01T14:30:00Z',
    venue: 'Riverside Oval',
    active: true,
    homeSideAnnounced: false,
    awaySideAnnounced: false,
    homePickedCount: null,
    awayPickedCount: null,
    playingXiSize: null,
    polls: [],
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
  activateSession.mockResolvedValue({ personId: null, personStatus: null, platformAdmin: false, clubAdminClubIds: [] })
  listLeagueTeams.mockResolvedValue([])
  listTeamsForClub.mockResolvedValue([
    { id: 'team-1', clubId: 'test-club-id', sectionId: 'section-1', name: '1st XI', logoUrl: null, active: true, createdAt: '', updatedAt: '', updatedBy: null },
    { id: 'team-2', clubId: 'test-club-id', sectionId: 'section-1', name: '2nd XI', logoUrl: null, active: true, createdAt: '', updatedAt: '', updatedBy: null },
  ])
  listSeasons.mockResolvedValue([
    { id: 'season-1', clubId: 'test-club-id', label: '2026', startDate: '2026-01-01', endDate: '2026-12-31', active: true, createdAt: '', updatedAt: '', updatedBy: null },
  ])
  listLeagues.mockResolvedValue([])
  listLeagueAffiliations.mockResolvedValue([])
})

function LocationProbe() {
  const location = useLocation()
  return <div>At: {location.pathname + location.search}</div>
}

function OutletContextWrapper({ clubId }: { clubId?: string }) {
  return <Outlet context={{ clubId }} />
}

function MatchListStub() {
  const notice = (useLocation().state as { notice?: string } | null)?.notice
  return (
    <div>
      Match List Page<span data-testid="list-notice">{notice}</span>
    </div>
  )
}

function ScheduleStub() {
  const location = useLocation()
  const notice = (location.state as { notice?: string } | null)?.notice
  return (
    <div>
      League Schedule Page<span data-testid="schedule-at">{location.pathname + location.search}</span>
      <span data-testid="schedule-notice">{notice}</span>
    </div>
  )
}

function renderPage(initialPath: string, clubId?: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/manage/fixtures" element={<OutletContextWrapper clubId={clubId} />}>
            <Route path="matches" element={<MatchListStub />} />
            <Route path="matches/new" element={<MatchFormPage />} />
            <Route path="matches/:matchId/edit" element={<MatchFormPage />} />
            <Route path="leagues/:leagueId/schedule" element={<ScheduleStub />} />
          </Route>
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('MatchFormPage', () => {
  it('create mode: renders no tabs and submits via createMatch', async () => {
    const user = userEvent.setup()
    createMatch.mockResolvedValueOnce(makeMatch())

    renderPage('/manage/fixtures/matches/new', 'test-club-id')

    expect(await screen.findByText('Add Match')).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Home XI' })).not.toBeInTheDocument()
    // docs/specs/038-move-deactivate-to-edit-screen.md: never rendered on a brand-new, not-yet-
    // saved record.
    expect(screen.queryByRole('button', { name: 'Deactivate' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reactivate' })).not.toBeInTheDocument()

    await user.click(screen.getByLabelText('Season'))
    await user.click(await screen.findByRole('option', { name: '2026' }))
    await user.click(screen.getByLabelText('Home team'))
    await user.click(await screen.findByRole('option', { name: '1st XI' }))
    await user.click(screen.getByLabelText('Away team'))
    await user.click(await screen.findByRole('option', { name: '2nd XI' }))
    setDateTime('Match date & time', '2026-06-01T14:30')
    await user.click(screen.getByRole('button', { name: 'Create Match' }))

    expect(createMatch).toHaveBeenCalledTimes(1)
    expect(await screen.findByText('Match List Page')).toBeInTheDocument()
  })

  it('create mode: Cancel links back to the matches list', async () => {
    renderPage('/manage/fixtures/matches/new', 'test-club-id')

    expect(await screen.findByText('Add Match')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute('href', '/manage/fixtures/matches')
  })

  // docs/specs/050-league-schedule-and-fixtures.md item 31/32: LeagueFormPage's Schedule tab's own
  // "Add Match" shortcut pre-fills League/Season via query params on this same create route.
  describe('League/Season query-param prefill', () => {
    beforeEach(() => {
      listLeagues.mockResolvedValue([
        {
          id: 'league-1',
          clubId: 'test-club-id',
          name: 'Premier League',
          source: 'INTERNAL',
          maxPlayingXiSize: 11,
          minAge: null,
          maxAge: null,
          ageCutoffMonth: null,
          ageCutoffDay: null,
          active: true,
          createdAt: '',
          updatedAt: '',
          updatedBy: null,
          currentSeasonTeamCount: 4,
          currentSeasonLabel: '2026',
          currentSeasonPlayingConditionsUrl: null,
          matchCount: null,
          playedCount: null,
          firstMatchDate: null,
          lastMatchDate: null,
          nextMatchDate: null,
          teams: null,
        },
      ])
    })

    it('create mode: a ?leagueId=&seasonId= query string pre-selects both on the rendered form', async () => {
      renderPage('/manage/fixtures/matches/new?leagueId=league-1&seasonId=season-1', 'test-club-id')

      expect(await screen.findByText('Add Match')).toBeInTheDocument()
      expect(await screen.findByLabelText('League (optional)')).toHaveTextContent('Premier League')
      expect(screen.getByLabelText('Season')).toHaveTextContent('2026')
    })

    it('edit mode: the same query string is ignored — the match\'s own League/Season values win', async () => {
      const user = userEvent.setup()
      // A second season in the club's own list, distinct from the match's real season, so a stray
      // seasonId query param landing here would be visibly distinguishable (in the submitted
      // payload) if it were (incorrectly) applied.
      listSeasons.mockResolvedValue([
        { id: 'season-1', clubId: 'test-club-id', label: '2026', startDate: '2026-01-01', endDate: '2026-12-31', active: true, createdAt: '', updatedAt: '', updatedBy: null },
        { id: 'season-2', clubId: 'test-club-id', label: '2027', startDate: '2027-01-01', endDate: '2027-12-31', active: true, createdAt: '', updatedAt: '', updatedBy: null },
      ])
      // The match's own values are both real, already-filled fields (homeTeamId/awayTeamId,
      // matchDate) — no further form interaction is needed before submitting, isolating this
      // assertion to exactly the League/Season prefill behavior under test.
      // .mockResolvedValue (not Once) — onSuccess invalidates this same query, triggering a
      // refetch while the page is still mounted.
      getMatch.mockResolvedValue(makeMatch({ leagueId: null, seasonId: 'season-1' }))
      updateMatch.mockResolvedValueOnce(makeMatch({ leagueId: null, seasonId: 'season-1' }))

      renderPage('/manage/fixtures/matches/match-1/edit?leagueId=league-1&seasonId=season-2', 'test-club-id')

      expect(await screen.findByText('Edit Match')).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Save Changes' }))

      // The query string's leagueId=league-1/seasonId=season-2 never leak into the submitted
      // payload — the match's own leagueId (null) and seasonId (season-1) win instead.
      expect(updateMatch).toHaveBeenCalledWith(
        'test-club-id',
        'match-1',
        expect.objectContaining({ leagueId: null, seasonId: 'season-1' }),
      )
    })
  })

  // docs/specs/093-team-selection-hub.md: the Home XI / Away XI tabs moved to the Select team page; Edit Match is the Details.
  describe('Details only, with a link to the Select team page (093)', () => {
    it('edit mode: renders no tabs, the Details form, Cancel, Save and Deactivate', async () => {
      getMatch.mockResolvedValue(makeMatch())

      renderPage('/manage/fixtures/matches/match-1/edit', 'test-club-id')

      expect(await screen.findByText('Edit Match')).toBeInTheDocument()
      expect(screen.queryByRole('tab')).not.toBeInTheDocument()
      expect(screen.getByLabelText('Field (optional)')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute('href', '/manage/fixtures/matches/match-1')
      expect(screen.getByRole('button', { name: 'Save Changes' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Deactivate' })).toBeInTheDocument()
    })

    it('edit mode: has no Availability button (it moved to the Select team page)', async () => {
      getMatch.mockResolvedValue(makeMatch())

      renderPage('/manage/fixtures/matches/match-1/edit', 'test-club-id')

      expect(await screen.findByText('Edit Match')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Availability' })).not.toBeInTheDocument()
    })

    it('create mode: renders no Select Team link and no tabs', async () => {
      renderPage('/manage/fixtures/matches/new', 'test-club-id')

      expect(await screen.findByText('Add Match')).toBeInTheDocument()
      expect(screen.queryByRole('link', { name: 'Select Team' })).not.toBeInTheDocument()
      expect(screen.queryByRole('tab')).not.toBeInTheDocument()
    })

    // docs/specs/130: the loose Select Team button left the title row (it is in Manage Match on the match page).
    it('edit mode: has no Select Team button or link on the title row', async () => {
      getMatch.mockResolvedValue(makeMatch())

      renderPage('/manage/fixtures/matches/match-1/edit', 'test-club-id')

      await screen.findByText('Edit Match')
      expect(screen.queryByRole('link', { name: /select team/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /select team/i })).not.toBeInTheDocument()
    })

    it('edit mode: the footer reads Cancel, Save Changes, Deactivate, Delete (Delete disabled with its reason)', async () => {
      getMatch.mockResolvedValue(makeMatch({ deletable: false }))

      renderPage('/manage/fixtures/matches/match-1/edit', 'test-club-id')

      await screen.findByText('Edit Match')
      const footer = screen.getByRole('button', { name: 'Save Changes' }).parentElement as HTMLElement
      const labels = Array.from(footer.querySelectorAll('a, button')).map((node) => node.textContent?.trim())
      expect(labels).toEqual(['Cancel', 'Save Changes', 'Deactivate', 'Delete'])
      expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Save Changes' }).className).toContain('MuiButton-contained')
    })

    it('?tab=availability and ?tab=availability&side=away stay on Details', async () => {
      getMatch.mockResolvedValue(makeMatch())
      const { unmount } = renderPage('/manage/fixtures/matches/match-1/edit?tab=availability', 'test-club-id')
      await screen.findByText('Edit Match')
      expect(screen.getByLabelText('Field (optional)')).toBeInTheDocument()
      unmount()

      renderPage('/manage/fixtures/matches/match-1/edit?tab=availability&side=away', 'test-club-id')
      await screen.findByText('Edit Match')
      expect(screen.getByLabelText('Field (optional)')).toBeInTheDocument()
    })
  })

  // docs/specs/099-fields-directory.md: the Venue input became the Field picker; the page feeds it the match's field.
  describe('Field picker (099)', () => {
    it('edit mode: a match on a field shows it in the box, flags it when unverified, and saves its id', async () => {
      const user = userEvent.setup()
      const match = makeMatch({ playingAreaId: 'field-7', playingAreaName: 'Away Park', playingAreaVerificationStatus: 'UNVERIFIED', venue: 'Away Park' })
      getMatch.mockResolvedValue(match)
      updateMatch.mockResolvedValue(match)

      renderPage('/manage/fixtures/matches/match-1/edit', 'test-club-id')

      expect(await screen.findByText('Edit Match')).toBeInTheDocument()
      expect(screen.getByLabelText('Field (optional)')).toHaveValue('Away Park')
      expect(screen.getByTestId('field-unverified-alert')).toBeInTheDocument()
      expect(screen.queryByTestId('legacy-venue')).not.toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Save Changes' }))

      expect(updateMatch).toHaveBeenCalledWith('test-club-id', 'match-1', expect.objectContaining({ playingAreaId: 'field-7', venue: 'Away Park' }))
    })

    it('edit mode: a match with only the old venue text shows it under the box and saves it unchanged', async () => {
      const user = userEvent.setup()
      getMatch.mockResolvedValue(makeMatch({ venue: 'Riverside Oval' }))
      updateMatch.mockResolvedValue(makeMatch())

      renderPage('/manage/fixtures/matches/match-1/edit', 'test-club-id')

      expect(await screen.findByText('Edit Match')).toBeInTheDocument()
      expect(screen.getByLabelText('Field (optional)')).toHaveValue('')
      expect(screen.getByTestId('legacy-venue')).toHaveTextContent('Current venue: Riverside Oval')

      await user.click(screen.getByRole('button', { name: 'Save Changes' }))

      expect(updateMatch).toHaveBeenCalledWith('test-club-id', 'match-1', expect.objectContaining({ playingAreaId: null, venue: 'Riverside Oval' }))
    })

    it('edit mode: a rejected field blocks Save', async () => {
      const user = userEvent.setup()
      getMatch.mockResolvedValue(makeMatch({ playingAreaId: 'field-8', playingAreaName: 'Old Ground', playingAreaVerificationStatus: 'REJECTED' }))

      renderPage('/manage/fixtures/matches/match-1/edit', 'test-club-id')

      expect(await screen.findByTestId('field-rejected-alert')).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Save Changes' }))

      expect(updateMatch).not.toHaveBeenCalled()
    })

    it('create mode: shows the Field (optional) picker and no Venue input', async () => {
      renderPage('/manage/fixtures/matches/new', 'test-club-id')

      expect(await screen.findByText('Add Match')).toBeInTheDocument()
      expect(screen.getByLabelText('Field (optional)')).toBeInTheDocument()
      expect(screen.queryByLabelText(/^Venue/)).not.toBeInTheDocument()
    })
  })

  describe('old Playing XI links redirect to the Select team page (093)', () => {
    const redirectsTo = async (query: string, expected: string, match: Match = makeMatch()) => {
      getMatch.mockResolvedValue(match)
      renderPage(`/manage/fixtures/matches/match-1/edit${query}`, 'test-club-id')
      expect(await screen.findByText(`At: ${expected}`)).toBeInTheDocument()
    }
    const HOME = '/manage/team-selection/matches/match-1/sides/home'
    const AWAY = '/manage/team-selection/matches/match-1/sides/away'

    it('?tab=playing-xi opens the home side', () => redirectsTo('?tab=playing-xi', HOME))
    it('?tab=playing-xi opens the away side when only the away side is a team', () =>
      redirectsTo('?tab=playing-xi', AWAY, makeMatch({ homeTeamId: null, homeTeamName: 'Them' })))
    it('?tab=home-xi opens the home side', () => redirectsTo('?tab=home-xi', HOME))
    it('?tab=away-xi opens the away side', () => redirectsTo('?tab=away-xi', AWAY))
    it('?tab=away-xi falls back to the home side when the away side is not a team', () =>
      redirectsTo('?tab=away-xi', HOME, makeMatch({ awayTeamId: null, awayTeamName: 'Them' })))
    it('?tab=match-squad&side=away opens the away side', () => redirectsTo('?tab=match-squad&side=away', AWAY))
    it('?tab=match-squad&side=home opens the home side', () => redirectsTo('?tab=match-squad&side=home', HOME))

    it('does not redirect when neither side is a team of the club', async () => {
      getMatch.mockResolvedValue(makeMatch({ homeTeamId: null, homeTeamName: 'A', awayTeamId: null, awayTeamName: 'B' }))
      renderPage('/manage/fixtures/matches/match-1/edit?tab=playing-xi', 'test-club-id')
      expect(await screen.findByText('Edit Match')).toBeInTheDocument()
    })
  })

  it('prefills the scoring and streaming links from the match and sends them in the payload', async () => {
      const user = userEvent.setup()
      getMatch.mockResolvedValueOnce(
        makeMatch({ scoringUrl: 'https://cricclubs.com/matches/1', streamingUrl: 'https://pitchvision.example/live' }),
      )
      updateMatch.mockResolvedValue(makeMatch())

      renderPage('/manage/fixtures/matches/match-1/edit', 'test-club-id')

      await screen.findByText('Edit Match')
      expect(screen.getByLabelText('Scoring link (optional)')).toHaveValue('https://cricclubs.com/matches/1')
      expect(screen.getByLabelText('Streaming link (optional)')).toHaveValue('https://pitchvision.example/live')
      await user.click(screen.getByRole('button', { name: 'Save Changes' }))

      await waitFor(() =>
        expect(updateMatch).toHaveBeenCalledWith(
          'test-club-id',
          'match-1',
          expect.objectContaining({
            scoringUrl: 'https://cricclubs.com/matches/1',
            streamingUrl: 'https://pitchvision.example/live',
          }),
        ),
      )
    })

  // docs/specs/109-delete-empty-match.md
  // docs/specs/127-return-navigation.md: Back, Cancel, Save and Delete return to where the page was opened from.
  describe('return navigation (127)', () => {
    const SCHEDULE = '/manage/fixtures/leagues/league-1/schedule?seasonId=season-1'
    const WITH_ORIGIN = `/manage/fixtures/matches/new?returnTo=${encodeURIComponent(SCHEDULE)}&returnLabel=${encodeURIComponent('TVL schedule')}`

    async function fillAndCreate(user: ReturnType<typeof userEvent.setup>, when: string) {
      await user.click(screen.getByLabelText('Season'))
      await user.click(await screen.findByRole('option', { name: '2026' }))
      await user.click(screen.getByLabelText('Home team'))
      await user.click(await screen.findByRole('option', { name: '1st XI' }))
      await user.click(screen.getByLabelText('Away team'))
      await user.click(await screen.findByRole('option', { name: '2nd XI' }))
      setDateTime('Match date & time', when)
      await user.click(screen.getByRole('button', { name: 'Create Match' }))
    }

    it('shows "Back to {label}" and sends Back and Cancel to the origin', async () => {
      renderPage(WITH_ORIGIN, 'test-club-id')
      expect(await screen.findByText('Add Match')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Back to TVL schedule' })).toHaveAttribute('href', SCHEDULE)
      expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute('href', SCHEDULE)
    })

    it('keeps "Back to Matches" and the Matches list for Cancel without a returnTo', async () => {
      renderPage('/manage/fixtures/matches/new', 'test-club-id')
      expect(await screen.findByText('Add Match')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Back to Matches' })).toHaveAttribute('href', '/manage/fixtures/matches')
    })

    it('ignores an external returnTo', async () => {
      renderPage('/manage/fixtures/matches/new?returnTo=https%3A%2F%2Fevil.example&returnLabel=Evil', 'test-club-id')
      expect(await screen.findByText('Add Match')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Back to Matches' })).toHaveAttribute('href', '/manage/fixtures/matches')
      expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute('href', '/manage/fixtures/matches')
    })

    it('Cancel on the edit page returns to the origin instead of the match', async () => {
      getMatch.mockResolvedValue(makeMatch())
      renderPage(`/manage/fixtures/matches/match-1/edit?returnTo=${encodeURIComponent(SCHEDULE)}&returnLabel=TVL%20schedule`, 'test-club-id')
      expect(await screen.findByText('Edit Match')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute('href', SCHEDULE)
    })

    it('Save of a past match returns to the league Schedule with showAll=1', async () => {
      const user = userEvent.setup()
      createMatch.mockResolvedValueOnce(makeMatch())
      renderPage(WITH_ORIGIN, 'test-club-id')
      await screen.findByText('Add Match')
      await fillAndCreate(user, '2026-06-01T14:30')
      expect(await screen.findByText('League Schedule Page')).toBeInTheDocument()
      expect(screen.getByTestId('schedule-at')).toHaveTextContent('/manage/fixtures/leagues/league-1/schedule?seasonId=season-1&showAll=1')
    })

    it('Save of a future match returns to the origin unchanged', async () => {
      const user = userEvent.setup()
      createMatch.mockResolvedValueOnce(makeMatch())
      renderPage(WITH_ORIGIN, 'test-club-id')
      await screen.findByText('Add Match')
      await fillAndCreate(user, '2099-06-01T14:30')
      expect(await screen.findByText('League Schedule Page')).toBeInTheDocument()
      expect(screen.getByTestId('schedule-at')).toHaveTextContent(/^\/manage\/fixtures\/leagues\/league-1\/schedule\?seasonId=season-1$/)
    })

    it('Save on the edit page returns to the origin', async () => {
      const user = userEvent.setup()
      getMatch.mockResolvedValue(makeMatch())
      updateMatch.mockResolvedValueOnce(makeMatch())
      renderPage(`/manage/fixtures/matches/match-1/edit?returnTo=${encodeURIComponent(SCHEDULE)}&returnLabel=TVL%20schedule`, 'test-club-id')
      await screen.findByText('Edit Match')
      await user.click(screen.getByRole('button', { name: 'Save Changes' }))
      expect(await screen.findByText('League Schedule Page')).toBeInTheDocument()
    })

    it('Delete returns to the origin with the same notice', async () => {
      const user = userEvent.setup()
      getMatch.mockResolvedValue(makeMatch({ deletable: true }))
      deleteMatch.mockResolvedValueOnce(undefined)
      renderPage(`/manage/fixtures/matches/match-1/edit?returnTo=${encodeURIComponent(SCHEDULE)}&returnLabel=TVL%20schedule`, 'test-club-id')
      await user.click(await screen.findByRole('button', { name: 'Delete' }))
      const dialog = await screen.findByRole('dialog', { name: 'Delete this match?' })
      await user.click(within(dialog).getByRole('button', { name: 'Delete' }))
      expect(await screen.findByText('League Schedule Page')).toBeInTheDocument()
      expect(screen.getByTestId('schedule-notice')).toHaveTextContent('Match deleted.')
    })
  })

  describe('Delete (109)', () => {
    it('shows a disabled Delete when the match has something recorded against it', async () => {
      getMatch.mockResolvedValue(makeMatch({ deletable: false }))
      renderPage('/manage/fixtures/matches/match-1/edit', 'test-club-id')
      expect(await screen.findByText('Edit Match')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Deactivate' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled()
    })

    it('explains why Delete is disabled', async () => {
      const user = userEvent.setup()
      getMatch.mockResolvedValue(makeMatch({ deletable: false }))
      renderPage('/manage/fixtures/matches/match-1/edit', 'test-club-id')
      await screen.findByText('Edit Match')
      await user.hover(screen.getByRole('button', { name: 'Delete' }).parentElement as HTMLElement)
      expect(await screen.findByText(/A match can only be deleted when nothing is recorded against it/)).toBeInTheDocument()
    })

    it('shows no Delete on the Add page', async () => {
      renderPage('/manage/fixtures/matches/new', 'test-club-id')
      expect(await screen.findByText('Add Match')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
    })

    it('asks first, then deletes and returns to the list', async () => {
      const user = userEvent.setup()
      getMatch.mockResolvedValue(makeMatch({ deletable: true }))
      deleteMatch.mockResolvedValueOnce(undefined)
      renderPage('/manage/fixtures/matches/match-1/edit', 'test-club-id')

      await user.click(await screen.findByRole('button', { name: 'Delete' }))
      const dialog = await screen.findByRole('dialog', { name: 'Delete this match?' })
      expect(within(dialog).getByText('It has nothing recorded against it. This cannot be undone.')).toBeInTheDocument()
      expect(deleteMatch).not.toHaveBeenCalled()

      await user.click(within(dialog).getByRole('button', { name: 'Delete' }))
      await waitFor(() => expect(deleteMatch).toHaveBeenCalledWith('test-club-id', 'match-1'))
      expect(await screen.findByText('Match List Page')).toBeInTheDocument()
      expect(screen.getByTestId('list-notice')).toHaveTextContent('Match deleted.')
    })

    it('Cancel closes the dialog without deleting', async () => {
      const user = userEvent.setup()
      getMatch.mockResolvedValue(makeMatch({ deletable: true }))
      renderPage('/manage/fixtures/matches/match-1/edit', 'test-club-id')

      await user.click(await screen.findByRole('button', { name: 'Delete' }))
      await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancel' }))
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
      expect(deleteMatch).not.toHaveBeenCalled()
    })

    it('shows a 409 message inside the dialog and stays on the page', async () => {
      const user = userEvent.setup()
      getMatch.mockResolvedValue(makeMatch({ deletable: true }))
      deleteMatch.mockRejectedValueOnce(
        Object.assign(new Error('conflict'), { isAxiosError: true, response: { status: 409, data: { detail: 'This match has a draft result. Deactivate it instead.' } } }),
      )
      renderPage('/manage/fixtures/matches/match-1/edit', 'test-club-id')

      await user.click(await screen.findByRole('button', { name: 'Delete' }))
      const dialog = await screen.findByRole('dialog')
      await user.click(within(dialog).getByRole('button', { name: 'Delete' }))

      expect(await within(dialog).findByRole('alert')).toHaveTextContent('This match has a draft result. Deactivate it instead.')
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.queryByText('Match List Page')).not.toBeInTheDocument()
    })
  })

  // docs/specs/038-move-deactivate-to-edit-screen.md: relocated from MatchList's own card, plus
  // the tab-gating restructure — the button must render on every tab, not just Details.
  describe('Deactivate/Reactivate', () => {
    it('edit mode: renders Deactivate for an active match on the Details tab, clicking it calls deactivateMatch', async () => {
      const user = userEvent.setup()
      getMatch.mockResolvedValueOnce(makeMatch({ active: true }))
      // onSuccess invalidates ['managed-club', clubId, 'matches'], which prefix-matches this
      // page's own single-record query too, triggering a refetch that must resolve to the
      // now-inactive record for the button to relabel.
      getMatch.mockResolvedValueOnce(makeMatch({ active: false }))
      let resolveDeactivate: (value: Match) => void = () => {}
      deactivateMatch.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveDeactivate = resolve
        }),
      )

      renderPage('/manage/fixtures/matches/match-1/edit', 'test-club-id')

      await screen.findByText('Edit Match')
      await user.click(screen.getByRole('button', { name: 'Deactivate' }))

      expect(deactivateMatch).toHaveBeenCalledWith('test-club-id', 'match-1')
      expect(await screen.findByRole('button', { name: 'Deactivating…' })).toBeInTheDocument()

      resolveDeactivate(makeMatch({ active: false }))

      expect(await screen.findByRole('button', { name: 'Reactivate' })).toBeInTheDocument()
    })

    it('edit mode: renders Reactivate for an inactive match, clicking it calls reactivateMatch', async () => {
      const user = userEvent.setup()
      getMatch.mockResolvedValueOnce(makeMatch({ active: false }))
      // onSuccess invalidates ['managed-club', clubId, 'matches'], which prefix-matches this
      // page's own single-record query too, triggering a refetch.
      getMatch.mockResolvedValueOnce(makeMatch({ active: true }))
      reactivateMatch.mockResolvedValueOnce(makeMatch({ active: true }))

      renderPage('/manage/fixtures/matches/match-1/edit', 'test-club-id')

      await screen.findByText('Edit Match')
      await user.click(screen.getByRole('button', { name: 'Reactivate' }))

      expect(reactivateMatch).toHaveBeenCalledWith('test-club-id', 'match-1')
    })

    it('also renders Deactivate on Details only: the page has no other tab to host it', async () => {
      getMatch.mockResolvedValue(makeMatch({ active: true }))

      renderPage('/manage/fixtures/matches/match-1/edit', 'test-club-id')

      await screen.findByText('Edit Match')
      expect(await screen.findByRole('button', { name: 'Deactivate' })).toBeInTheDocument()
      expect(screen.queryByRole('tab')).not.toBeInTheDocument()
    })
  })
})
