import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LeagueDetailPage from './LeagueDetailPage'
import type { League } from '../../api/leagueApi'
import type { Season } from '../../api/seasonApi'
import type { Team } from '../../api/teamApi'
import type { Match } from '../../api/matchApi'
import type { LeagueAffiliation } from '../../api/leagueAffiliationApi'

const listLeagues = vi.fn()
const listSeasons = vi.fn()
const listTeamsForClub = vi.fn()
const listLeagueAffiliations = vi.fn()
const listMatches = vi.fn()
const getPlayingConditions = vi.fn()

vi.mock('../../api/leagueApi', () => ({
  listLeagues: (clubId: string) => listLeagues(clubId),
}))

vi.mock('../../api/seasonApi', () => ({
  listSeasons: (clubId: string) => listSeasons(clubId),
}))

vi.mock('../../api/teamApi', () => ({
  listTeamsForClub: (clubId: string) => listTeamsForClub(clubId),
}))

vi.mock('../../api/leagueAffiliationApi', () => ({
  listLeagueAffiliations: (clubId: string, leagueId: string) => listLeagueAffiliations(clubId, leagueId),
}))

// docs/specs/050-league-schedule-and-fixtures.md: the new Fixtures section's own match data —
// reuses listMatches unmodified from the existing matchApi.
vi.mock('../../api/matchApi', () => ({
  listMatches: (clubId: string, params: unknown) => listMatches(clubId, params),
}))

// The shared season-picker's own Playing Conditions link — resolves the selected season's
// document, if any (see LeagueDetailPage.tsx's headerNote).
vi.mock('../../api/leaguePlayingConditionsApi', () => ({
  getPlayingConditions: (clubId: string, leagueId: string, seasonId: string) =>
    getPlayingConditions(clubId, leagueId, seasonId),
}))

function makeLeague(overrides: Partial<League> = {}): League {
  return {
    id: 'league-1',
    clubId: 'test-club-id',
    name: 'Internal League',
    source: 'INTERNAL',
    maxPlayingXiSize: 11,
    allowSubstitutions: true,
    minAge: 13,
    maxAge: 17,
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

function makeAffiliation(overrides: Partial<LeagueAffiliation> = {}): LeagueAffiliation {
  return {
    id: 'affiliation-1',
    leagueId: 'league-1',
    teamId: 'team-1',
    seasonId: 'season-1',
    createdAt: '2026-01-01T00:00:00Z',
    createdBy: null,
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
            <Route path="leagues/:leagueId" element={<LeagueDetailPage />} />
            <Route path="leagues/:leagueId/edit" element={<div>Edit League Page</div>} />
          </Route>
          {/* Sibling top-level route — the Affiliated Teams card's editTo targets Team's own edit
              route, which lives outside the /manage/fixtures branch this page's wrapper otherwise
              nests under. */}
          <Route path="/manage/sections/:sectionId/teams/:teamId/edit" element={<div>Edit Team Page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('LeagueDetailPage', () => {
  it('renders "Not authorized" and does not fetch when no clubId is in the Outlet context', () => {
    renderPage('/manage/fixtures/leagues/league-1', undefined)

    expect(screen.getByText('Not authorized')).toBeInTheDocument()
    expect(listLeagues).not.toHaveBeenCalled()
  })

  it('loads the matching league and renders its Details fields read-only', async () => {
    listLeagues.mockResolvedValueOnce([makeLeague({ id: 'league-1' }), makeLeague({ id: 'league-2' })])

    renderPage('/manage/fixtures/leagues/league-1', 'test-club-id')

    expect(await screen.findByRole('heading', { name: 'Internal League' })).toBeInTheDocument()
    expect(listLeagues).toHaveBeenCalledWith('test-club-id')
    expect(screen.getByText('11')).toBeInTheDocument()
    expect(screen.getByText('13–17')).toBeInTheDocument()
    expect(screen.getByText('Yes')).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()

    expect(screen.getByRole('link', { name: /edit/i })).toHaveAttribute('href', '/manage/fixtures/leagues/league-1/edit')
  })

  // docs/specs/049-record-list-edit-action-rollout.md (amendment, item 16): the Affiliated Teams
  // card now passes editTo alongside viewTo, rendering View and Edit side by side — mirrors
  // MatchList.test.tsx's own View+Edit precedent.
  it('renders affiliated teams for the default season as View and Edit cards, both pointing at the team\'s own routes', async () => {
    listLeagues.mockResolvedValueOnce([makeLeague({ id: 'league-1' })])
    listSeasons.mockResolvedValueOnce([makeSeason({ id: 'season-1' })])
    listTeamsForClub.mockResolvedValueOnce([makeTeam({ id: 'team-1', sectionId: 'section-1', name: '1st XI' })])
    listLeagueAffiliations.mockResolvedValueOnce([makeAffiliation({ teamId: 'team-1', seasonId: 'season-1' })])

    renderPage('/manage/fixtures/leagues/league-1', 'test-club-id')

    await screen.findByRole('heading', { name: 'Internal League' })

    expect(screen.getByText('1st XI')).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: 'View' })).toHaveAttribute(
      'href',
      '/manage/sections/section-1/teams/team-1',
    )
    // The League's own "Edit" action (RecordDetailScreen's own header link) is also present, so
    // this asserts containment rather than an exact-length match.
    const editLinks = screen.getAllByRole('link', { name: 'Edit' }).map((link) => link.getAttribute('href'))
    expect(editLinks).toContain('/manage/sections/section-1/teams/team-1/edit')
  })

  it('renders an error state when the matching league id is not in the fetched list', async () => {
    listLeagues.mockResolvedValueOnce([makeLeague({ id: 'some-other-id' })])

    renderPage('/manage/fixtures/leagues/league-1', 'test-club-id')

    expect(await screen.findByText("Couldn't load this league")).toBeInTheDocument()
  })

  // docs/specs/050-league-schedule-and-fixtures.md item 2/7/30: the Affiliations→Teams rename and
  // the new Fixtures section, rendering LeagueFixtures for the page's own selected season.
  it('renders the "Teams" section heading, not "Affiliations"', async () => {
    listLeagues.mockResolvedValueOnce([makeLeague({ id: 'league-1' })])

    renderPage('/manage/fixtures/leagues/league-1', 'test-club-id')

    await screen.findByRole('heading', { name: 'Internal League' })
    expect(screen.getByText('Teams')).toBeInTheDocument()
    expect(screen.queryByText('Affiliations')).not.toBeInTheDocument()
  })

  it('renders a new Fixtures section showing LeagueFixtures for the selected season', async () => {
    listLeagues.mockResolvedValueOnce([makeLeague({ id: 'league-1' })])
    listSeasons.mockResolvedValueOnce([makeSeason({ id: 'season-1' })])
    listTeamsForClub.mockResolvedValueOnce([makeTeam({ id: 'team-1', name: '1st XI' })])
    listMatches.mockResolvedValueOnce({
      content: [makeMatch({ homeTeamId: 'team-1', awayTeamName: 'Riverside Occasionals' })],
      totalElements: 1,
      totalPages: 1,
      number: 0,
      size: 20,
    })

    renderPage('/manage/fixtures/leagues/league-1', 'test-club-id')

    await screen.findByRole('heading', { name: 'Internal League' })
    expect(screen.getByText('Fixtures')).toBeInTheDocument()
    expect(await screen.findByText('1st XI')).toBeInTheDocument()
    expect(screen.getByText('Riverside Occasionals')).toBeInTheDocument()
    expect(listMatches).toHaveBeenCalledWith(
      'test-club-id',
      expect.objectContaining({ leagueId: 'league-1', seasonId: 'season-1' }),
    )
  })

  it('renders the LeagueFixtures empty state in the Fixtures section when the season has no matches', async () => {
    listLeagues.mockResolvedValueOnce([makeLeague({ id: 'league-1' })])
    listSeasons.mockResolvedValueOnce([makeSeason({ id: 'season-1' })])

    renderPage('/manage/fixtures/leagues/league-1', 'test-club-id')

    await screen.findByRole('heading', { name: 'Internal League' })
    expect(await screen.findByText('No fixtures yet')).toBeInTheDocument()
  })

  // docs/specs/051-league-schedule-sharing.md item 7: NextMatchCountdown renders above
  // LeagueFixtures whenever the season's own match list has an upcoming (strictly future-dated)
  // fixture, and renders nothing at all otherwise — LeagueFixtures' own EmptyState already covers
  // "nothing scheduled".
  it('renders NextMatchCountdown above LeagueFixtures when an upcoming match exists', async () => {
    listLeagues.mockResolvedValueOnce([makeLeague({ id: 'league-1' })])
    listSeasons.mockResolvedValueOnce([makeSeason({ id: 'season-1' })])
    listTeamsForClub.mockResolvedValueOnce([makeTeam({ id: 'team-1', name: '1st XI' })])
    listMatches.mockResolvedValueOnce({
      content: [
        makeMatch({
          id: 'match-future',
          homeTeamId: 'team-1',
          awayTeamName: 'Riverside Occasionals',
          // Far enough in the future to stay "upcoming" for the lifetime of this test.
          matchDate: '2030-06-01T14:30:00Z',
        }),
      ],
      totalElements: 1,
      totalPages: 1,
      number: 0,
      size: 20,
    })

    renderPage('/manage/fixtures/leagues/league-1', 'test-club-id')

    await screen.findByRole('heading', { name: 'Internal League' })
    const countdownLabel = await screen.findByText('Next match')
    const fixturesEntry = screen.getByText('1st XI')

    expect(countdownLabel.compareDocumentPosition(fixturesEntry) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('renders no NextMatchCountdown card when the season has no upcoming (future-dated) match', async () => {
    listLeagues.mockResolvedValueOnce([makeLeague({ id: 'league-1' })])
    listSeasons.mockResolvedValueOnce([makeSeason({ id: 'season-1' })])
    listTeamsForClub.mockResolvedValueOnce([makeTeam({ id: 'team-1', name: '1st XI' })])
    listMatches.mockResolvedValueOnce({
      content: [
        makeMatch({
          id: 'match-past',
          homeTeamId: 'team-1',
          awayTeamName: 'Riverside Occasionals',
          matchDate: '2020-06-01T14:30:00Z',
        }),
      ],
      totalElements: 1,
      totalPages: 1,
      number: 0,
      size: 20,
    })

    renderPage('/manage/fixtures/leagues/league-1', 'test-club-id')

    await screen.findByRole('heading', { name: 'Internal League' })
    await screen.findByText('1st XI')
    expect(screen.queryByText('Next match')).not.toBeInTheDocument()
  })

  // docs/specs/051-league-schedule-sharing.md item 7: the Fixtures section's own "note" slot
  // Share button opens ShareScheduleDialog, rather than widening RecordDetailScreen's own
  // link-only secondaryActions contract.
  it('opens ShareScheduleDialog from the Fixtures section\'s Share button', async () => {
    const user = userEvent.setup()
    listLeagues.mockResolvedValueOnce([makeLeague({ id: 'league-1' })])
    listSeasons.mockResolvedValueOnce([makeSeason({ id: 'season-1' })])

    renderPage('/manage/fixtures/leagues/league-1', 'test-club-id')

    await screen.findByRole('heading', { name: 'Internal League' })
    expect(screen.queryByText('Share Schedule')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Share' }))

    expect(await screen.findByText('Share Schedule')).toBeInTheDocument()
  })
})
