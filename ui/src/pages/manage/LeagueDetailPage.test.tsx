import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LeagueDetailPage from './LeagueDetailPage'
import { LEAGUE_FORMAT_LABELS } from '../../api/leagueApi'
import type { League } from '../../api/leagueApi'
import type { Season } from '../../api/seasonApi'
import type { Team } from '../../api/teamApi'
import type { Match } from '../../api/matchApi'
import type { LeagueAffiliation } from '../../api/leagueAffiliationApi'
import type { LeaguePlayingConditions } from '../../api/leaguePlayingConditionsApi'
import type { LeagueContact } from '../../api/leagueContactApi'

const listLeagues = vi.fn()
const listSeasons = vi.fn()
const listTeamsForClub = vi.fn()
const listLeagueAffiliations = vi.fn()
const listMatches = vi.fn()
const getPlayingConditions = vi.fn()
const listLeagueContacts = vi.fn()

vi.mock('../../api/leagueApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/leagueApi')>()
  return {
    ...actual,
    listLeagues: (clubId: string) => listLeagues(clubId),
  }
})

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

// The Playing Conditions section's own data — docs/specs/052-league-playing-conditions.md moved
// this off the shared season-picker's headerNote entirely and into its own RecordDetailScreen
// section below (see LeagueDetailPage.tsx's "Playing Conditions" section).
vi.mock('../../api/leaguePlayingConditionsApi', () => ({
  getPlayingConditions: (clubId: string, leagueId: string, seasonId: string) =>
    getPlayingConditions(clubId, leagueId, seasonId),
}))

// docs/specs/054-league-contacts.md: the new Contacts section's own contact list.
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

function makeLeaguePlayingConditions(overrides: Partial<LeaguePlayingConditions> = {}): LeaguePlayingConditions {
  return {
    id: 'playing-conditions-1',
    leagueId: 'league-1',
    seasonId: 'season-1',
    documentUrl: null,
    uploadedAt: null,
    uploadedBy: null,
    maxOversPerInnings: 20,
    powerplayOvers: 6,
    maxOversPerBowler: 4,
    fieldingRestrictionsNotes: null,
    allowSubstitutions: false,
    pointsForWin: 2,
    pointsForLoss: 0,
    pointsForDraw: 1,
    pointsForNoResult: 1,
    pointsForForfeitWin: 2,
    bonusPointsEnabled: false,
    bonusBattingOversThreshold: null,
    bonusBowlingRestrictionPercentage: null,
    additionalNotes: null,
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
  listSeasons.mockResolvedValue([])
  listTeamsForClub.mockResolvedValue([])
  listLeagueAffiliations.mockResolvedValue([])
  listMatches.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
  getPlayingConditions.mockResolvedValue(null)
  listLeagueContacts.mockResolvedValue([])
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

  // docs/specs/062-league-detail-redesign.md: format/Playing XI size/age range move out of a
  // "Details" section entirely and render as chips directly under the league's name — there is no
  // longer a "Details" heading that owns these three facts.
  it('loads the matching league and renders Playing XI size and age range as header chips, with the header Edit button pointing at the league\'s edit route', async () => {
    listLeagues.mockResolvedValueOnce([makeLeague({ id: 'league-1' }), makeLeague({ id: 'league-2' })])

    renderPage('/manage/fixtures/leagues/league-1', 'test-club-id')

    expect(await screen.findByRole('heading', { name: 'Internal League' })).toBeInTheDocument()
    expect(listLeagues).toHaveBeenCalledWith('test-club-id')
    expect(screen.getByText('Playing XI: 11')).toBeInTheDocument()
    expect(screen.getByText('13–17')).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()

    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/manage/fixtures/leagues/league-1/edit')
  })

  // docs/specs/062-league-detail-redesign.md Acceptance Criteria: the header's teams/fixtures count
  // chip is deliberately re-derived from this page's own selected-season affiliationsForSeason/
  // matchesQuery data, not League.currentSeasonTeamCount/currentSeasonLabel — those reflect the
  // club's own "current" season specifically, which can differ from whichever season this page's
  // picker has selected. currentSeasonTeamCount is set to a value the real season-scoped data
  // contradicts, to prove the chip isn't reading it.
  it('computes the header teams/fixtures count chip from the selected season\'s own data, not league.currentSeasonTeamCount', async () => {
    listLeagues.mockResolvedValueOnce([makeLeague({ id: 'league-1', currentSeasonTeamCount: 99, currentSeasonLabel: '2099' })])
    listSeasons.mockResolvedValueOnce([makeSeason({ id: 'season-1' })])
    listTeamsForClub.mockResolvedValueOnce([makeTeam({ id: 'team-1' })])
    listLeagueAffiliations.mockResolvedValueOnce([makeAffiliation({ teamId: 'team-1', seasonId: 'season-1' })])
    listMatches.mockResolvedValueOnce({
      content: [makeMatch({ id: 'match-1' })],
      totalElements: 1,
      totalPages: 1,
      number: 0,
      size: 20,
    })

    renderPage('/manage/fixtures/leagues/league-1', 'test-club-id')

    await screen.findByRole('heading', { name: 'Internal League' })
    expect(await screen.findByText('1 team · 1 fixture')).toBeInTheDocument()
    expect(screen.queryByText(/99/)).not.toBeInTheDocument()
  })

  // docs/specs/062-league-detail-redesign.md: the new page-local LeagueTeamTile has no Edit action
  // on the tile itself — Edit lives one click away on the team's own detail page. The league's own
  // header Edit button (asserted above) is the only Edit action this page renders.
  it('renders affiliated teams for the default season as LeagueTeamTiles linking to the team\'s own detail page, with no Edit action on the tile', async () => {
    listLeagues.mockResolvedValueOnce([makeLeague({ id: 'league-1' })])
    listSeasons.mockResolvedValueOnce([makeSeason({ id: 'season-1' })])
    listTeamsForClub.mockResolvedValueOnce([makeTeam({ id: 'team-1', sectionId: 'section-1', name: '1st XI' })])
    listLeagueAffiliations.mockResolvedValueOnce([makeAffiliation({ teamId: 'team-1', seasonId: 'season-1' })])

    renderPage('/manage/fixtures/leagues/league-1', 'test-club-id')

    await screen.findByRole('heading', { name: 'Internal League' })
    expect(screen.getByText('Teams')).toBeInTheDocument()

    expect(await screen.findByRole('link', { name: '1st XI' })).toHaveAttribute(
      'href',
      '/manage/sections/section-1/teams/team-1',
    )
    // Only the league's own header Edit link is present — no per-tile Edit link into the team's
    // edit route.
    const editLinks = screen.getAllByRole('link', { name: 'Edit' }).map((link) => link.getAttribute('href'))
    expect(editLinks).toEqual(['/manage/fixtures/leagues/league-1/edit'])
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

  // docs/specs/062-league-detail-redesign.md: Schedule is now a visually-distinguished hero Card,
  // the first thing rendered below the header, ahead of Details/Contacts/Teams/Playing Conditions.
  it('renders the Schedule hero card first, ahead of Details/Contacts/Teams/Playing Conditions', async () => {
    listLeagues.mockResolvedValueOnce([makeLeague({ id: 'league-1' })])
    listSeasons.mockResolvedValueOnce([makeSeason({ id: 'season-1' })])

    renderPage('/manage/fixtures/leagues/league-1', 'test-club-id')

    await screen.findByRole('heading', { name: 'Internal League' })
    const scheduleHeading = screen.getByText('Schedule')
    const detailsHeading = screen.getByText('Details')
    const contactsHeading = screen.getByText('Contacts')
    const teamsHeading = screen.getByText('Teams')
    const playingConditionsHeading = screen.getByText('Playing Conditions')

    ;[detailsHeading, contactsHeading, teamsHeading, playingConditionsHeading].forEach((heading) => {
      expect(scheduleHeading.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })
  })

  it('renders the Schedule hero showing LeagueFixtures for the selected season', async () => {
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
    expect(screen.getByText('Schedule')).toBeInTheDocument()
    expect(await screen.findByText('1st XI')).toBeInTheDocument()
    expect(screen.getByText('Riverside Occasionals')).toBeInTheDocument()
    expect(listMatches).toHaveBeenCalledWith(
      'test-club-id',
      expect.objectContaining({ leagueId: 'league-1', seasonId: 'season-1' }),
    )
  })

  it('renders the LeagueFixtures empty state in the Schedule hero when the season has no matches', async () => {
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

  // docs/specs/051-league-schedule-sharing.md item 7 / docs/specs/062-league-detail-redesign.md:
  // the Schedule hero's own Share button opens ShareScheduleDialog. The hero now renders first on
  // the page (ahead of Details/Contacts/Teams/Playing Conditions), so its Share button is the
  // first of the two "Share" buttons in DOM order — Playing Conditions' own Share button, now last
  // on the page, is the second.
  it('opens ShareScheduleDialog from the Schedule hero\'s Share button', async () => {
    const user = userEvent.setup()
    listLeagues.mockResolvedValueOnce([makeLeague({ id: 'league-1' })])
    listSeasons.mockResolvedValueOnce([makeSeason({ id: 'season-1' })])

    renderPage('/manage/fixtures/leagues/league-1', 'test-club-id')

    await screen.findByRole('heading', { name: 'Internal League' })
    expect(screen.queryByText('Share Schedule')).not.toBeInTheDocument()

    const shareButtons = screen.getAllByRole('button', { name: 'Share' })
    await user.click(shareButtons[0])

    expect(await screen.findByText('Share Schedule')).toBeInTheDocument()
    expect(screen.queryByText('Share Playing Conditions')).not.toBeInTheDocument()
  })

  // docs/specs/052-league-playing-conditions.md: a second, independent Share flow — the Playing
  // Conditions section's own captain-summary share, opening PlayingConditionsShareDialog without
  // ever touching the Schedule hero's own ShareScheduleDialog/shareOpen state. Playing Conditions
  // now renders last on the page (docs/specs/062-league-detail-redesign.md), so its Share button
  // is the second of the two on the page.
  it('renders a Playing Conditions section with its own independent Share button', async () => {
    const user = userEvent.setup()
    listLeagues.mockResolvedValueOnce([makeLeague({ id: 'league-1' })])
    listSeasons.mockResolvedValueOnce([makeSeason({ id: 'season-1' })])

    renderPage('/manage/fixtures/leagues/league-1', 'test-club-id')

    await screen.findByRole('heading', { name: 'Internal League' })
    expect(screen.getByText('Playing Conditions')).toBeInTheDocument()
    expect(screen.getByText('No Playing Conditions set for this season yet.')).toBeInTheDocument()

    const shareButtons = screen.getAllByRole('button', { name: 'Share' })
    expect(shareButtons).toHaveLength(2)
    await user.click(shareButtons[1])

    expect(await screen.findByText('Share Playing Conditions')).toBeInTheDocument()
    expect(screen.queryByText('Share Schedule')).not.toBeInTheDocument()
  })

  // docs/specs/052-league-playing-conditions.md Test Plan: the populated DetailFieldGrid render
  // path — every structured field, the bonus rows appearing when bonusPointsEnabled is true, and
  // "View full document" rendering (and opening the right URL) when documentUrl is set.
  it('renders the full Playing Conditions DetailFieldGrid, including bonus rows and "View full document", when data exists', async () => {
    const user = userEvent.setup()
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    listLeagues.mockResolvedValueOnce([makeLeague({ id: 'league-1' })])
    listSeasons.mockResolvedValueOnce([makeSeason({ id: 'season-1' })])
    getPlayingConditions.mockResolvedValue(
      makeLeaguePlayingConditions({
        documentUrl: '/media/rules.pdf',
        maxOversPerBowler: 4,
        fieldingRestrictionsNotes: 'Two fielders outside the circle in the powerplay.',
        allowSubstitutions: true,
        bonusPointsEnabled: true,
        bonusBattingOversThreshold: 17,
        bonusBowlingRestrictionPercentage: 80,
        additionalNotes: 'No DLS below 5 overs a side.',
      }),
    )

    renderPage('/manage/fixtures/leagues/league-1', 'test-club-id')

    await screen.findByRole('heading', { name: 'Internal League' })
    expect(await screen.findByText('20')).toBeInTheDocument()
    expect(screen.getByText('6')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getByText('Two fielders outside the circle in the powerplay.')).toBeInTheDocument()
    expect(screen.getByText('Substitutions allowed')).toBeInTheDocument()
    expect(screen.getByText('Before over 17')).toBeInTheDocument()
    expect(screen.getByText('80% of target')).toBeInTheDocument()
    expect(screen.getByText('No DLS below 5 overs a side.')).toBeInTheDocument()
    expect(screen.queryByText('No Playing Conditions set for this season yet.')).not.toBeInTheDocument()

    const viewDocumentButton = screen.getByRole('button', { name: 'View full document' })
    await user.click(viewDocumentButton)
    expect(openSpy).toHaveBeenCalledWith('/media/rules.pdf', '_blank')

    openSpy.mockRestore()
  })

  it('omits the bonus rows, shows the "(auto)" hint, and hides "View full document" when bonus points are off and no PDF is uploaded', async () => {
    listLeagues.mockResolvedValueOnce([makeLeague({ id: 'league-1' })])
    listSeasons.mockResolvedValueOnce([makeSeason({ id: 'season-1' })])
    getPlayingConditions.mockResolvedValue(
      makeLeaguePlayingConditions({
        maxOversPerBowler: null,
        bonusPointsEnabled: false,
        documentUrl: null,
      }),
    )

    renderPage('/manage/fixtures/leagues/league-1', 'test-club-id')

    await screen.findByRole('heading', { name: 'Internal League' })
    expect(await screen.findByText('4 (auto)')).toBeInTheDocument()
    expect(screen.queryByText(/Before over/)).not.toBeInTheDocument()
    expect(screen.queryByText(/% of target/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'View full document' })).not.toBeInTheDocument()
  })

  // docs/specs/053-league-extended-profile.md: phone/email/website DetailFieldRows and the
  // SocialLinksRow inside the Details card, and the format Chip in the header's chip row
  // (docs/specs/062-league-detail-redesign.md) — mirroring SponsorDetailPage.test.tsx's
  // equivalent contact-fields assertions.
  describe('extended profile fields', () => {
    it('renders phone/email/website rows, the social links row, and the format chip when all are set', async () => {
      listLeagues.mockResolvedValueOnce([
        makeLeague({
          id: 'league-1',
          format: 'T20',
          phone: '+27 21 555 0199',
          email: 'info@riverside-premier.example',
          website: 'https://riverside-premier.example',
          socialLinks: [{ platform: 'facebook', url: 'https://facebook.com/riverside-premier' }],
        }),
      ])

      renderPage('/manage/fixtures/leagues/league-1', 'test-club-id')

      await screen.findByRole('heading', { name: 'Internal League' })
      expect(screen.getByText('+27 21 555 0199')).toBeInTheDocument()
      expect(screen.getByText('info@riverside-premier.example')).toBeInTheDocument()
      expect(screen.getByText('https://riverside-premier.example')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Facebook' })).toHaveAttribute(
        'href',
        'https://facebook.com/riverside-premier',
      )
      expect(screen.getByText(LEAGUE_FORMAT_LABELS.T20)).toBeInTheDocument()
    })

    it('renders none of the phone/email/website rows, no social links row, and no format chip when all are unset', async () => {
      listLeagues.mockResolvedValueOnce([
        makeLeague({
          id: 'league-1',
          format: null,
          phone: null,
          email: null,
          website: null,
          socialLinks: [],
        }),
      ])

      renderPage('/manage/fixtures/leagues/league-1', 'test-club-id')

      await screen.findByRole('heading', { name: 'Internal League' })
      expect(screen.queryByText('Phone')).not.toBeInTheDocument()
      expect(screen.queryByText('Email')).not.toBeInTheDocument()
      expect(screen.queryByText('Website')).not.toBeInTheDocument()
      expect(screen.queryByRole('link', { name: 'Facebook' })).not.toBeInTheDocument()
      Object.values(LEAGUE_FORMAT_LABELS).forEach((label) => {
        expect(screen.queryByText(label)).not.toBeInTheDocument()
      })
    })
  })

  // docs/specs/062-league-detail-redesign.md: Contacts is rebuilt from a full-width RecordCard grid
  // into a compact RecordIconButton icon row + RecordQuickViewDialog, paired beside Details in the
  // two-column row — same pattern TeamDetailPage.test.tsx/ClubOverviewPage.test.tsx already assert
  // for their own Contacts cards.
  describe('Contacts section', () => {
    it('renders "No contacts yet for this league." when the league has no contacts', async () => {
      listLeagues.mockResolvedValueOnce([makeLeague({ id: 'league-1' })])
      listLeagueContacts.mockResolvedValue([])

      renderPage('/manage/fixtures/leagues/league-1', 'test-club-id')

      await screen.findByRole('heading', { name: 'Internal League' })
      expect(await screen.findByText('No contacts yet for this league.')).toBeInTheDocument()
    })

    it('opens the Contacts quick-view dialog with Role/Email/Phone fields on click, edit route intact', async () => {
      const user = userEvent.setup()
      listLeagues.mockResolvedValueOnce([makeLeague({ id: 'league-1' })])
      listLeagueContacts.mockResolvedValue([makeContact({ id: 'contact-1', role: 'League Administrator' })])

      renderPage('/manage/fixtures/leagues/league-1', 'test-club-id')

      await screen.findByRole('heading', { name: 'Internal League' })
      expect(listLeagueContacts).toHaveBeenCalledWith('test-club-id', 'league-1')

      // The icon row renders a button (RecordIconButton), not a link — accessible name combines
      // the contact's full name and role, same convention as TeamDetailPage's own Contacts card.
      await user.click(await screen.findByRole('button', { name: 'Jane Smith — League Administrator' }))

      expect(await screen.findByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText('jane.smith@example.com')).toBeInTheDocument()
      expect(screen.getByText('+27 21 555 0100')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute(
        'href',
        '/manage/fixtures/leagues/league-1/contacts/contact-1/edit',
      )
    })
  })
})
