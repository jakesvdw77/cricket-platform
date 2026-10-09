import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MatchList from './MatchList'
import { CARD_GRID_TEMPLATE_COLUMNS } from '../../utils/cardGrid'
import type { Match } from '../../api/matchApi'
import type { Page } from '../../api/productApi'

const listMatches = vi.fn()
const listMatchFilterOptions = vi.fn()
const getMatchesSummary = vi.fn()
const listTeamsForClub = vi.fn()
const listLeagues = vi.fn()
const listSeasons = vi.fn()
const listSections = vi.fn()

vi.mock('../../api/matchApi', () => ({
  listMatches: (clubId: string, params: unknown) => listMatches(clubId, params),
  listMatchFilterOptions: (clubId: string, params: unknown) => listMatchFilterOptions(clubId, params),
  getMatchesSummary: (clubId: string, filters: unknown) => getMatchesSummary(clubId, filters),
  matchesSummaryKey: (clubId: string, filters: unknown) => ['managed-club', clubId, 'matches', 'summary', filters],
  deactivateMatch: vi.fn(),
  reactivateMatch: vi.fn(),
}))

vi.mock('../../api/teamApi', () => ({
  listTeamsForClub: (clubId: string) => listTeamsForClub(clubId),
}))

vi.mock('../../api/leagueApi', () => ({
  listLeagues: (clubId: string) => listLeagues(clubId),
}))

vi.mock('../../api/seasonApi', () => ({
  listSeasons: (clubId: string) => listSeasons(clubId),
}))

vi.mock('../../api/sectionApi', () => ({
  listSections: (clubId: string) => listSections(clubId),
}))

function makeMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: 'match-1',
    clubId: 'test-club-id',
    homeTeamId: 'team-1',
    homeTeamName: null,
    awayTeamId: null,
    awayTeamName: 'Riverside Occasionals',
    leagueId: null,
    seasonId: 'season-1',
    matchDate: '2026-06-01T14:30:00Z',
    venue: 'Riverside Oval',
    active: true,
    homeSideAnnounced: false,
    awaySideAnnounced: false,
    homePickedCount: 0,
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

function makePage(content: Match[], overrides: Partial<Page<Match>> = {}): Page<Match> {
  return {
    content,
    totalElements: content.length,
    totalPages: 1,
    number: 0,
    size: 20,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  // docs/specs/042-match-list-filters-and-search.md: this is the first real localStorage
  // consumer in the codebase — each test starts from a clean slate so a filter selection made in
  // one test never leaks (via the real jsdom localStorage) into the next.
  localStorage.clear()
  listTeamsForClub.mockResolvedValue([{ id: 'team-1', name: '1st XI' }])
  listLeagues.mockResolvedValue([])
  listSeasons.mockResolvedValue([])
  listSections.mockResolvedValue([
    { id: 'section-1', clubId: 'test-club-id', parentSectionId: null, name: 'Men', minAge: null, maxAge: null, gender: null, active: true, createdAt: '', updatedAt: '', updatedBy: null },
  ])
  // docs/specs/042-match-list-filters-and-search.md: default keeps section-1 reachable (matching
  // listSections' own default fixture above) so tests that don't care about filter-options
  // narrowing (e.g. the existing Section test) aren't affected by it — filterOptionsQuery.data
  // being *undefined* (still loading) would also leave the full list unfiltered, but resolving it
  // here exercises the real narrowing path instead of only the loading fallback.
  listMatchFilterOptions.mockResolvedValue({ sectionIds: ['section-1'], leagueIds: [], seasonIds: [], teamIds: ['team-1'] })
  getMatchesSummary.mockResolvedValue({ matchesShown: 12, thisWeek: 3, teamsNotAnnounced: 4, withoutPoll: 2 })
})

function OutletContextWrapper({ clubId }: { clubId?: string }) {
  return <Outlet context={{ clubId }} />
}

function EditMatchPageStub() {
  const location = useLocation()
  return <div>Edit Match Page: {location.pathname + location.search}</div>
}

function renderPage(clubId?: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/manage/fixtures/matches']}>
        <Routes>
          <Route path="/manage/fixtures" element={<OutletContextWrapper clubId={clubId} />}>
            <Route path="matches" element={<MatchList />} />
            <Route path="matches/new" element={<div>New Match Page</div>} />
            <Route path="matches/:matchId" element={<div>Match Detail Page</div>} />
            <Route path="matches/:matchId/edit" element={<div>Edit Match Page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('MatchList', () => {
  it('renders "Home vs Away" resolving a real team id against the club\'s teams and a free-text opponent name', async () => {
    listMatches.mockResolvedValueOnce(makePage([makeMatch()]))

    renderPage('test-club-id')

    expect(await screen.findByText('1st XI vs Riverside Occasionals')).toBeInTheDocument()
    expect(listMatches).toHaveBeenCalledWith('test-club-id', expect.objectContaining({ page: 0 }))
  })

  it('lays the cards out in an auto-fill grid (min 340px, capped at 100%) with stretched equal heights', async () => {
    listMatches.mockResolvedValueOnce(makePage([makeMatch()]))

    renderPage('test-club-id')

    const heading = await screen.findByRole('heading', { name: '1st XI vs Riverside Occasionals' })
    const grid = heading.closest('.MuiCard-root')?.parentElement as HTMLElement
    expect(grid).toHaveStyle({
      display: 'grid',
      gridTemplateColumns: CARD_GRID_TEMPLATE_COLUMNS,
      alignItems: 'stretch',
    })
  })

  // docs/specs/089 (C): the Cards | List switch and its remembered preference.
  describe('list view', () => {
    it('shows cards by default, switches to the table and back, and keeps the other controls', async () => {
      listMatches.mockResolvedValue(makePage([makeMatch()]))
      const user = userEvent.setup()
      renderPage('test-club-id')

      await screen.findByText('1st XI vs Riverside Occasionals')
      expect(screen.queryByRole('table', { name: 'Matches' })).not.toBeInTheDocument()

      await user.click(screen.getAllByRole('button', { name: 'List' })[0])
      expect(await screen.findByRole('table', { name: 'Matches' })).toBeInTheDocument()
      expect(screen.getByLabelText('Show past matches')).toBeInTheDocument()

      await user.click(screen.getAllByRole('button', { name: 'Cards' })[0])
      await waitFor(() => expect(screen.queryByRole('table', { name: 'Matches' })).not.toBeInTheDocument())
    })

    it('remembers the chosen view for next time', async () => {
      listMatches.mockResolvedValue(makePage([makeMatch()]))
      const user = userEvent.setup()
      const { unmount } = renderPage('test-club-id')

      await screen.findByText('1st XI vs Riverside Occasionals')
      await user.click(screen.getAllByRole('button', { name: 'List' })[0])
      await screen.findByRole('table', { name: 'Matches' })
      expect(localStorage.getItem('matchList:view')).toBe('list')
      unmount()

      renderPage('test-club-id')
      expect(await screen.findByRole('table', { name: 'Matches' })).toBeInTheDocument()
    })

    it('opens the match when a row is clicked', async () => {
      localStorage.setItem('matchList:view', 'list')
      listMatches.mockResolvedValue(makePage([makeMatch({ id: 'match-9' })]))
      const user = userEvent.setup()
      renderPage('test-club-id')

      await user.click(await screen.findByRole('link', { name: '1st XI vs Riverside Occasionals' }))
      expect(await screen.findByText('Match Detail Page')).toBeInTheDocument()
    })
  })

  // docs/specs/079-manager-shell-and-overview.md: no default back link any more.
  it('renders no back link by default', async () => {
    listMatches.mockResolvedValueOnce(makePage([makeMatch()]))

    renderPage('test-club-id')

    await screen.findByText('1st XI vs Riverside Occasionals')
    expect(screen.queryByRole('link', { name: /back/i })).not.toBeInTheDocument()
  })

  // docs/specs/041-list-screen-header-actions.md: MatchList's default viewTo AND editTo are both
  // real routes, so its card is the one existing call site where RecordCard's revised
  // View+Edit-together rendering is actually reachable today.
  it('renders a title link to the match view route and a footer Edit button on a card', async () => {
    listMatches.mockResolvedValueOnce(makePage([makeMatch({ id: 'match-1' })]))

    renderPage('test-club-id')

    await screen.findByText('1st XI vs Riverside Occasionals')
    expect(screen.getByRole('link', { name: '1st XI vs Riverside Occasionals' })).toHaveAttribute(
      'href',
      '/manage/fixtures/matches/match-1',
    )
    // Edit is now an icon-over-caption footer button (docs/specs/069), not a link.
    expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit' })).toBeEnabled()
  })

  // docs/specs/059-record-card-click-to-view.md: the dedicated footer "View" button is gone — the
  // card title is the click target. Extends the href-only assertion above with a real
  // click-through, confirming the title link still resolves to the same route the old View button
  // targeted, and Edit still navigates independently — a good regression case here specifically
  // because this card also carries a four-button footer (Edit, Select, Availability, Share), the
  // exact scenario the stacking-order fix must not break.
  it('clicking the card title navigates to the match view route, and Edit still navigates to the edit route', async () => {
    const user = userEvent.setup()
    listMatches.mockResolvedValue(makePage([makeMatch({ id: 'match-1' })]))

    const { unmount } = renderPage('test-club-id')
    await screen.findByText('1st XI vs Riverside Occasionals')
    await user.click(screen.getByRole('link', { name: '1st XI vs Riverside Occasionals' }))
    expect(await screen.findByText('Match Detail Page')).toBeInTheDocument()
    unmount()

    renderPage('test-club-id')
    await screen.findByText('1st XI vs Riverside Occasionals')
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    expect(await screen.findByText('Edit Match Page')).toBeInTheDocument()
  })

  // docs/specs/037-match-improvements.md item 1
  it('sends upcomingOnly: true by default, and "Show past matches" turns it off', async () => {
    const user = userEvent.setup()
    listMatches.mockResolvedValue(makePage([makeMatch()]))

    renderPage('test-club-id')

    await screen.findByText('1st XI vs Riverside Occasionals')
    expect(listMatches).toHaveBeenLastCalledWith('test-club-id', expect.objectContaining({ upcomingOnly: true }))

    await user.click(screen.getByRole('checkbox', { name: /show past matches/i }))
    await waitFor(() =>
      expect(listMatches).toHaveBeenLastCalledWith('test-club-id', expect.objectContaining({ upcomingOnly: false })),
    )

    await user.click(screen.getByRole('checkbox', { name: /show past matches/i }))
    await waitFor(() =>
      expect(listMatches).toHaveBeenLastCalledWith('test-club-id', expect.objectContaining({ upcomingOnly: true })),
    )
  })

  // docs/specs/042-match-list-filters-and-search.md: the spec's whole reason for existing
  // includes "shows the match that is first coming up... by default" — a fresh render, with no
  // prior interaction with the sort toggle, must already request ascending (soonest-first) order.
  it('defaults to ascending sort (soonest match first), sending sort: "matchDate,asc" on a fresh render', async () => {
    listMatches.mockResolvedValueOnce(makePage([makeMatch()]))

    renderPage('test-club-id')

    await screen.findByText('1st XI vs Riverside Occasionals')
    expect(listMatches).toHaveBeenCalledWith('test-club-id', expect.objectContaining({ sort: 'matchDate,asc' }))
    // docs/specs/087: the quiet sort link reads the CURRENT order and reverses it on click.
    expect(screen.getByRole('button', { name: /soonest first/i })).toBeInTheDocument()
  })

  // docs/specs/087-matches-polls-alignment.md (B)
  describe('Polls-style toolbar (087)', () => {
    it('shows the scope text on the content line, and the sort link reverses the order via the backend sort param', async () => {
      const user = userEvent.setup()
      listMatches.mockResolvedValue(makePage([makeMatch(), makeMatch({ id: 'match-2' })]))

      renderPage('test-club-id')

      await screen.findAllByText('1st XI vs Riverside Occasionals')
      expect(screen.getByText(/Showing 2 upcoming matches/)).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: /soonest first/i }))
      await waitFor(() => expect(listMatches).toHaveBeenLastCalledWith('test-club-id', expect.objectContaining({ sort: 'matchDate,desc' })))
      expect(await screen.findByRole('button', { name: /latest first/i })).toBeInTheDocument()
    })

    it('reads "Showing N matches" once past matches are included, and singular for one', async () => {
      const user = userEvent.setup()
      listMatches.mockResolvedValue(makePage([makeMatch()]))

      renderPage('test-club-id')

      expect(await screen.findByText(/Showing 1 upcoming match/)).toBeInTheDocument()
      await user.click(screen.getByRole('checkbox', { name: /show past matches/i }))
      expect(await screen.findByText(/^Showing 1 match(?!es)/)).toBeInTheDocument()
    })

    it('on a phone shows search and a Filters button, with Show past matches and the sort link inside the sheet', async () => {
      const user = userEvent.setup()
      window.matchMedia = ((query: string) => ({
        matches: query.includes('max-width'),
        media: query,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
      })) as unknown as typeof window.matchMedia
      try {
        listMatches.mockResolvedValue(makePage([makeMatch()]))

        renderPage('test-club-id')

        await screen.findByText('1st XI vs Riverside Occasionals')
        expect(screen.getByText(/Showing 1 upcoming match/)).toBeInTheDocument()
        expect(screen.queryByRole('checkbox', { name: /show past matches/i })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /soonest first/i })).not.toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: 'Filters' }))
        expect(await screen.findByRole('checkbox', { name: /show past matches/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /soonest first/i })).toBeInTheDocument()
      } finally {
        delete (window as { matchMedia?: unknown }).matchMedia
      }
    })

    it('names the chosen section and season under the title', async () => {
      const user = userEvent.setup()
      listMatches.mockResolvedValue(makePage([makeMatch()]))
      listSeasons.mockResolvedValue([
        { id: 'season-1', clubId: 'test-club-id', label: '2026/27', startDate: '2026-01-01', endDate: '2026-12-31', active: true, createdAt: '', updatedAt: '', updatedBy: null },
      ])
      listMatchFilterOptions.mockResolvedValue({ sectionIds: ['section-1'], leagueIds: [], seasonIds: ['season-1'], teamIds: ['team-1'] })

      renderPage('test-club-id')

      await screen.findByText('1st XI vs Riverside Occasionals')
      expect(screen.queryByText(/^Showing: /)).not.toBeInTheDocument()

      await user.click(screen.getByLabelText('Section'))
      await user.click(within(screen.getByRole('treeitem', { name: 'Men' })).getByText('Men'))
      await user.click(screen.getByLabelText('Season'))
      await user.click(await screen.findByRole('option', { name: '2026/27' }))

      expect(await screen.findByText('Showing: Men · 2026/27')).toBeInTheDocument()
    })
  })

  // docs/specs/037-match-improvements.md item 2
  describe('Select shortcut', () => {
    it('navigates to the edit route\'s Playing XI tab when the match has a real-Team side', async () => {
      const user = userEvent.setup()
      listMatches.mockResolvedValueOnce(makePage([makeMatch({ homeTeamId: 'team-1' })]))

      renderPage('test-club-id')

      await screen.findByText('1st XI vs Riverside Occasionals')
      await user.click(screen.getByRole('button', { name: 'Select' }))

      expect(await screen.findByText('Edit Match Page')).toBeInTheDocument()
    })

    it('is disabled with an explanatory title for a match with no real-Team side on either end', async () => {
      listMatches.mockResolvedValueOnce(
        makePage([makeMatch({ homeTeamId: null, homeTeamName: 'Home Occasionals', awayTeamId: null, awayTeamName: 'Away Occasionals' })]),
      )

      renderPage('test-club-id')

      await screen.findByText('Home Occasionals vs Away Occasionals')
      const select = screen.getByRole('button', { name: 'Select' })
      expect(select).toBeDisabled()
      expect(select.closest('span[title]')).toHaveAttribute('title', 'None of your teams is playing in this match')
    })

    // docs/specs/037-match-improvements.md item 2: SquadPicker.tsx (029) passes its own `editTo`
    // that already ends in `?tab=playing-xi` — confirms the query string is never doubled up into
    // an unparseable `?tab=playing-xi?tab=playing-xi`.
    it('appends rather than duplicates the query string when editTo already carries one (SquadPicker\'s own editTo shape)', async () => {
      const user = userEvent.setup()
      listMatches.mockResolvedValueOnce(makePage([makeMatch({ homeTeamId: 'team-1' })]))

      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/manage/fixtures/matches']}>
            <Routes>
              <Route path="/manage/fixtures" element={<OutletContextWrapper clubId="test-club-id" />}>
                <Route
                  path="matches"
                  element={<MatchList editTo={(matchId) => `/manage/fixtures/matches/${matchId}/edit?tab=playing-xi`} viewTo={null} />}
                />
                <Route path="matches/:matchId/edit" element={<EditMatchPageStub />} />
              </Route>
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>,
      )

      await screen.findByText('1st XI vs Riverside Occasionals')
      await user.click(screen.getByRole('button', { name: 'Select' }))

      expect(await screen.findByText('Edit Match Page: /manage/fixtures/matches/match-1/edit?tab=playing-xi')).toBeInTheDocument()
    })
  })

  it('requests the next page from the backend rather than slicing an already-fetched list', async () => {
    const user = userEvent.setup()
    listMatches
      .mockResolvedValueOnce(makePage([makeMatch({ id: 'match-1' })], { totalPages: 2, number: 0 }))
      .mockResolvedValueOnce(makePage([makeMatch({ id: 'match-2' })], { totalPages: 2, number: 1 }))

    renderPage('test-club-id')

    await screen.findByText('Page 1 of 2')
    await user.click(screen.getByRole('button', { name: 'Next' }))

    expect(await screen.findByText('Page 2 of 2')).toBeInTheDocument()
    expect(listMatches).toHaveBeenLastCalledWith('test-club-id', expect.objectContaining({ page: 1 }))
  })

  it('does not render pagination controls for a single-page result', async () => {
    listMatches.mockResolvedValueOnce(makePage([makeMatch()], { totalPages: 1 }))

    renderPage('test-club-id')

    await screen.findByText('1st XI vs Riverside Occasionals')
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument()
  })

  it('shows an Inactive badge for a deactivated match', async () => {
    listMatches.mockResolvedValueOnce(makePage([makeMatch({ active: false })]))

    renderPage('test-club-id')

    expect(await screen.findByText('Inactive')).toBeInTheDocument()
  })

  // docs/specs/040-announce-team.md
  describe('announced badges', () => {
    it('shows an unprefixed "Not announced" badge for the one real-Team side', async () => {
      listMatches.mockResolvedValueOnce(
        makePage([makeMatch({ homeTeamId: 'team-1', homeSideAnnounced: false })]),
      )

      renderPage('test-club-id')

      expect(await screen.findByText('Not announced')).toBeInTheDocument()
    })

    it('prefixes each side\'s badge with its own team name when both sides are real Teams', async () => {
      listMatches.mockResolvedValueOnce(
        makePage([
          makeMatch({
            homeTeamId: 'team-1',
            homeSideAnnounced: true,
            awayTeamId: 'team-2',
            awayTeamName: null,
            awaySideAnnounced: false,
          }),
        ]),
      )
      listTeamsForClub.mockResolvedValueOnce([
        { id: 'team-1', name: '1st XI' },
        { id: 'team-2', name: '2nd XI' },
      ])

      renderPage('test-club-id')

      expect(await screen.findByText('1st XI: Announced')).toBeInTheDocument()
      expect(screen.getByText('2nd XI: Not announced')).toBeInTheDocument()
    })

    it('prefixes each side\'s badge with its own team name for the opposite announced/not-announced ordering', async () => {
      listMatches.mockResolvedValueOnce(
        makePage([
          makeMatch({
            homeTeamId: 'team-1',
            homeSideAnnounced: false,
            awayTeamId: 'team-2',
            awayTeamName: null,
            awaySideAnnounced: true,
          }),
        ]),
      )
      listTeamsForClub.mockResolvedValueOnce([
        { id: 'team-1', name: '1st XI' },
        { id: 'team-2', name: '2nd XI' },
      ])

      renderPage('test-club-id')

      expect(await screen.findByText('1st XI: Not announced')).toBeInTheDocument()
      expect(screen.getByText('2nd XI: Announced')).toBeInTheDocument()
    })

    it('shows no announced badge at all when neither side is a real Team', async () => {
      listMatches.mockResolvedValueOnce(
        makePage([
          makeMatch({ homeTeamId: null, homeTeamName: 'Home Occasionals', awayTeamId: null, awayTeamName: 'Away Occasionals' }),
        ]),
      )

      renderPage('test-club-id')

      await screen.findByText('Home Occasionals vs Away Occasionals')
      expect(screen.queryByText(/Announced/)).not.toBeInTheDocument()
    })
  })

  // docs/specs/038-move-deactivate-to-edit-screen.md: Deactivate/Reactivate no longer renders on
  // the card at all (active or inactive) — it moved to MatchFormPage's own actions bar. The
  // footer is Edit / Select / Poll / Share (docs/specs/069).
  it('never renders a Deactivate/Reactivate button on the card, while Edit/Select/Availability/Share remain', async () => {
    listMatches.mockResolvedValueOnce(makePage([makeMatch({ id: 'match-1', active: true, homeTeamId: 'team-1' })]))

    renderPage('test-club-id')

    await screen.findByText('1st XI vs Riverside Occasionals')
    expect(screen.queryByRole('button', { name: 'Deactivate' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reactivate' })).not.toBeInTheDocument()
    for (const name of ['Edit', 'Select', 'Availability', 'Share']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument()
    }
  })

  it('navigates to the create route by default', async () => {
    const user = userEvent.setup()
    listMatches.mockResolvedValueOnce(makePage([]))

    renderPage('test-club-id')

    await user.click(await screen.findByRole('button', { name: 'Add Match' }))
    expect(await screen.findByText('New Match Page')).toBeInTheDocument()
  })

  it('selecting a section in the filter re-fetches via the backend sectionId param, never client-side', async () => {
    const user = userEvent.setup()
    listMatches.mockResolvedValue(makePage([makeMatch()]))

    renderPage('test-club-id')

    await screen.findByText('1st XI vs Riverside Occasionals')
    const lastCallParams = () => listMatches.mock.calls.at(-1)?.[1]
    expect(lastCallParams().sectionId).toBeUndefined()

    await user.click(screen.getByLabelText('Section'))
    await user.click(within(screen.getByRole('treeitem', { name: 'Men' })).getByText('Men'))

    expect(await screen.findByLabelText('Section')).toHaveValue('Men')
    await waitFor(() => expect(lastCallParams().sectionId).toBe('section-1'))

    await user.click(screen.getByLabelText('Section'))
    await user.click(screen.getByRole('button', { name: /all sections/i }))

    await waitFor(() => expect(lastCallParams().sectionId).toBeUndefined())
  })

  // docs/specs/042-match-list-filters-and-search.md: mirrors the Section filter test above —
  // League is a real, backend-param-driven filter, and filter-options' own leagueIds narrows the
  // League Select's own option list.
  it('selecting a league in the filter re-fetches via the backend leagueId param, never client-side', async () => {
    const user = userEvent.setup()
    listMatches.mockResolvedValue(makePage([makeMatch()]))
    listLeagues.mockResolvedValue([
      {
        id: 'league-1',
        clubId: 'test-club-id',
        name: 'Premier League',
        source: 'INTERNAL',
        maxPlayingXiSize: 11,
        minAge: null,
        maxAge: null,
        ageCutoffDate: null,
        active: true,
        createdAt: '',
        updatedAt: '',
        updatedBy: null,
      },
    ])
    listMatchFilterOptions.mockResolvedValue({ sectionIds: ['section-1'], leagueIds: ['league-1'], seasonIds: [], teamIds: ['team-1'] })

    renderPage('test-club-id')

    await screen.findByText('1st XI vs Riverside Occasionals')
    const lastCallParams = () => listMatches.mock.calls.at(-1)?.[1]
    expect(lastCallParams().leagueId).toBeUndefined()

    await user.click(screen.getByLabelText('League'))
    await user.click(await screen.findByRole('option', { name: 'Premier League' }))

    await waitFor(() => expect(lastCallParams().leagueId).toBe('league-1'))
  })

  // docs/specs/042-match-list-filters-and-search.md: mirrors the Section/League filter tests
  // above — Season is a real, backend-param-driven filter too.
  it('selecting a season in the filter re-fetches via the backend seasonId param, never client-side', async () => {
    const user = userEvent.setup()
    listMatches.mockResolvedValue(makePage([makeMatch()]))
    listSeasons.mockResolvedValue([
      {
        id: 'season-1',
        clubId: 'test-club-id',
        label: '2026',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        active: true,
        createdAt: '',
        updatedAt: '',
        updatedBy: null,
      },
    ])
    listMatchFilterOptions.mockResolvedValue({ sectionIds: ['section-1'], leagueIds: [], seasonIds: ['season-1'], teamIds: ['team-1'] })

    renderPage('test-club-id')

    await screen.findByText('1st XI vs Riverside Occasionals')
    const lastCallParams = () => listMatches.mock.calls.at(-1)?.[1]
    expect(lastCallParams().seasonId).toBeUndefined()

    await user.click(screen.getByLabelText('Season'))
    await user.click(await screen.findByRole('option', { name: '2026' }))

    await waitFor(() => expect(lastCallParams().seasonId).toBe('season-1'))
  })

  // docs/specs/042-match-list-filters-and-search.md: the actual "filters narrow each other's own
  // option lists" behavior the spec exists to prove — a league excluded from filter-options'
  // leagueIds response must not even be offered as an option, not just fail to be selected.
  it('narrows the League dropdown to only the leagues filter-options reports as reachable', async () => {
    const user = userEvent.setup()
    listMatches.mockResolvedValue(makePage([makeMatch()]))
    listLeagues.mockResolvedValue([
      {
        id: 'league-1',
        clubId: 'test-club-id',
        name: 'Premier League',
        source: 'INTERNAL',
        maxPlayingXiSize: 11,
        minAge: null,
        maxAge: null,
        ageCutoffDate: null,
        active: true,
        createdAt: '',
        updatedAt: '',
        updatedBy: null,
      },
      {
        id: 'league-2',
        clubId: 'test-club-id',
        name: 'Division Two',
        source: 'INTERNAL',
        maxPlayingXiSize: 11,
        minAge: null,
        maxAge: null,
        ageCutoffDate: null,
        active: true,
        createdAt: '',
        updatedAt: '',
        updatedBy: null,
      },
    ])
    // Only league-1 is reachable — league-2 exists in the club's full league list but has no
    // match matching the currently-active filters, so it must not appear as an option at all.
    listMatchFilterOptions.mockResolvedValue({ sectionIds: ['section-1'], leagueIds: ['league-1'], seasonIds: [], teamIds: ['team-1'] })

    renderPage('test-club-id')

    await screen.findByText('1st XI vs Riverside Occasionals')
    await user.click(screen.getByLabelText('League'))

    expect(await screen.findByRole('option', { name: 'Premier League' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Division Two' })).not.toBeInTheDocument()
  })

  // docs/specs/042-match-list-filters-and-search.md: the single most important new assertion in
  // this file — search previously reached listMatches as a harmless, silently-ignored extra
  // param; this proves it's now genuinely sent, closing that exact gap.
  it('sends the typed search term to listMatches as a real backend param', async () => {
    const user = userEvent.setup()
    listMatches.mockResolvedValue(makePage([makeMatch()]))

    renderPage('test-club-id')

    await screen.findByText('1st XI vs Riverside Occasionals')
    await user.type(screen.getByLabelText('Search'), '1st XI')

    await waitFor(() =>
      expect(listMatches).toHaveBeenLastCalledWith('test-club-id', expect.objectContaining({ search: '1st XI' })),
    )
  })

  // docs/specs/042-match-list-filters-and-search.md: confirming a suggestion (not just typing
  // free text) also flows into the real backend search param — the suggestion list is drawn from
  // the club's own already-loaded Team names.
  it('clicking a search suggestion sets the search value and sends it to listMatches as a real backend param', async () => {
    const user = userEvent.setup()
    listMatches.mockResolvedValue(makePage([makeMatch()]))
    listTeamsForClub.mockResolvedValue([
      { id: 'team-1', name: '1st XI' },
      { id: 'team-2', name: 'Lakeside CC' },
    ])
    // Both teams must be in filter-options' own teamIds for either to be suggested — a team
    // outside the currently-reachable set is never offered as a suggestion (see the dedicated
    // narrowing test below).
    listMatchFilterOptions.mockResolvedValue({
      sectionIds: ['section-1'],
      leagueIds: [],
      seasonIds: [],
      teamIds: ['team-1', 'team-2'],
    })

    renderPage('test-club-id')

    await screen.findByText('1st XI vs Riverside Occasionals')
    await user.type(screen.getByLabelText('Search'), 'Lake')

    const suggestion = await screen.findByRole('option', { name: 'Lakeside CC' })
    await user.click(suggestion)

    expect(screen.getByLabelText('Search')).toHaveValue('Lakeside CC')
    await waitFor(() =>
      expect(listMatches).toHaveBeenLastCalledWith(
        'test-club-id',
        expect.objectContaining({ search: 'Lakeside CC' }),
      ),
    )
  })

  // Regression test for a real bug found via manual review: search suggestions were drawn from
  // *every* team in the club, completely unfiltered by the currently-active Section/League/Season
  // filters — so a team with no connection to the selected filters (e.g. an Over-40s team while
  // filtering by a Juniors section) was still suggested. Suggestions must be narrowed by
  // filter-options' own teamIds first, exactly like the Section/League/Season pickers already are.
  it('never suggests a team that filter-options excludes from teamIds, even though it appears in the full team list', async () => {
    const user = userEvent.setup()
    listMatches.mockResolvedValue(makePage([makeMatch()]))
    listTeamsForClub.mockResolvedValue([
      { id: 'team-1', name: '1st XI' },
      { id: 'team-2', name: 'Over 40s' },
    ])
    // team-2 exists in the club's full team list but has no match matching the currently-active
    // filters — it must not be suggested at all.
    listMatchFilterOptions.mockResolvedValue({
      sectionIds: ['section-1'],
      leagueIds: [],
      seasonIds: [],
      teamIds: ['team-1'],
    })

    renderPage('test-club-id')

    await screen.findByText('1st XI vs Riverside Occasionals')
    await user.click(screen.getByLabelText('Search'))

    expect(await screen.findByRole('option', { name: '1st XI' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Over 40s' })).not.toBeInTheDocument()
  })

  // docs/specs/042-match-list-filters-and-search.md: Section/League/Season selections persist per
  // club across visits — Search is explicitly excluded. A fresh mount picks previously-persisted
  // filters back up from localStorage.
  it('reapplies a persisted section filter on mount, and never persists the search text', async () => {
    listMatches.mockResolvedValue(makePage([makeMatch()]))
    localStorage.setItem('matchList:filters:test-club-id', JSON.stringify({ sectionId: 'section-1', leagueId: null, seasonId: null }))

    renderPage('test-club-id')

    const lastCallParams = () => listMatches.mock.calls.at(-1)?.[1]
    await waitFor(() => expect(lastCallParams().sectionId).toBe('section-1'))
    expect(await screen.findByLabelText('Section')).toHaveValue('Men')

    const persisted = JSON.parse(localStorage.getItem('matchList:filters:test-club-id') as string)
    expect(persisted).not.toHaveProperty('search')
  })

  // docs/specs/042-match-list-filters-and-search.md: extends the section-only persistence test
  // above — League/Season round-trip through localStorage the same way, and the persisted blob's
  // own shape (not just applied behavior) is asserted directly, confirming it genuinely never
  // carries a `search` key even after the admin types into Search.
  it('reapplies persisted League and Season filters too, and the persisted localStorage blob itself never carries a search key', async () => {
    const user = userEvent.setup()
    listMatches.mockResolvedValue(makePage([makeMatch()]))
    listLeagues.mockResolvedValue([
      {
        id: 'league-1',
        clubId: 'test-club-id',
        name: 'Premier League',
        source: 'INTERNAL',
        maxPlayingXiSize: 11,
        minAge: null,
        maxAge: null,
        ageCutoffDate: null,
        active: true,
        createdAt: '',
        updatedAt: '',
        updatedBy: null,
      },
    ])
    listSeasons.mockResolvedValue([
      {
        id: 'season-1',
        clubId: 'test-club-id',
        label: '2026',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        active: true,
        createdAt: '',
        updatedAt: '',
        updatedBy: null,
      },
    ])
    listMatchFilterOptions.mockResolvedValue({ sectionIds: ['section-1'], leagueIds: ['league-1'], seasonIds: ['season-1'], teamIds: ['team-1'] })
    localStorage.setItem(
      'matchList:filters:test-club-id',
      JSON.stringify({ sectionId: 'section-1', leagueId: 'league-1', seasonId: 'season-1' }),
    )

    renderPage('test-club-id')

    await screen.findByText('1st XI vs Riverside Occasionals')
    const lastCallParams = () => listMatches.mock.calls.at(-1)?.[1]
    await waitFor(() =>
      expect(lastCallParams()).toEqual(
        expect.objectContaining({ sectionId: 'section-1', leagueId: 'league-1', seasonId: 'season-1' }),
      ),
    )

    // Typing into Search must never make it into the persisted blob.
    await user.type(screen.getByLabelText('Search'), 'Riverside')
    await waitFor(() =>
      expect(listMatches).toHaveBeenLastCalledWith('test-club-id', expect.objectContaining({ search: 'Riverside' })),
    )

    const persisted = JSON.parse(localStorage.getItem('matchList:filters:test-club-id') as string)
    expect(persisted).toEqual({ sectionId: 'section-1', leagueId: 'league-1', seasonId: 'season-1' })
  })

  // docs/specs/087-matches-polls-alignment.md (A): the counters and the Team filter
  describe('counters and quick filters (087)', () => {
    const counter = (id: string) => screen.getByTestId(`page-counter-${id}`)

    it('shows the four counters from the summary, with amber on the two that need attention', async () => {
      listMatches.mockResolvedValue(makePage([makeMatch()]))

      renderPage('test-club-id')

      await screen.findByText('1st XI vs Riverside Occasionals')
      await screen.findByTestId('page-counter-shown')
      expect(within(counter('shown')).getByText('12')).toBeInTheDocument()
      expect(within(counter('shown')).getByText('Upcoming matches')).toBeInTheDocument()
      expect(within(counter('this-week')).getByText('3')).toBeInTheDocument()
      expect(within(counter('not-announced')).getByText('Teams not announced')).toBeInTheDocument()
      expect(within(counter('no-poll')).getByText('Without a poll')).toBeInTheDocument()
      const valueColour = (id: string) => getComputedStyle(within(counter(id)).getByTestId('page-counter-value')).color
      expect(valueColour('not-announced')).not.toBe(valueColour('this-week'))
      expect(valueColour('no-poll')).toBe(valueColour('not-announced'))
      expect(counter('shown')).toHaveAttribute('aria-pressed', 'true')
      expect(counter('this-week')).toHaveAttribute('aria-pressed', 'false')
    })

    it('asks the summary for exactly the list filters, with includePast the inverse of Show past matches', async () => {
      const user = userEvent.setup()
      listMatches.mockResolvedValue(makePage([makeMatch()]))

      renderPage('test-club-id')

      await screen.findByTestId('page-counter-shown')
      expect(getMatchesSummary).toHaveBeenLastCalledWith('test-club-id', expect.objectContaining({ includePast: false }))
      expect(within(counter('shown')).getByText('Upcoming matches')).toBeInTheDocument()

      await user.click(screen.getByRole('checkbox', { name: /show past matches/i }))

      await waitFor(() =>
        expect(getMatchesSummary).toHaveBeenLastCalledWith('test-club-id', expect.objectContaining({ includePast: true })),
      )
      expect(await within(counter('shown')).findByText('Matches shown')).toBeInTheDocument()
    })

    it('choosing a counter sends the backend focus, names it in a chip and the scope text, and marks the counter pressed', async () => {
      const user = userEvent.setup()
      listMatches.mockResolvedValue(makePage([makeMatch()]))

      renderPage('test-club-id')

      await screen.findByTestId('page-counter-not-announced')
      await user.click(counter('not-announced'))

      await waitFor(() =>
        expect(listMatches).toHaveBeenLastCalledWith('test-club-id', expect.objectContaining({ focus: 'not-announced' })),
      )
      expect(counter('not-announced')).toHaveAttribute('aria-pressed', 'true')
      expect(counter('shown')).toHaveAttribute('aria-pressed', 'false')
      expect(screen.getByText(/Showing 1 upcoming match · Teams not announced/)).toBeInTheDocument()
      // the counters keep describing the list's filters, not the quick filter
      expect(getMatchesSummary).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ focus: expect.anything() }))
    })

    it('choosing another counter replaces the first, and choosing the active one or the first card clears it', async () => {
      const user = userEvent.setup()
      listMatches.mockResolvedValue(makePage([makeMatch()]))

      renderPage('test-club-id')

      await screen.findByTestId('page-counter-this-week')
      await user.click(counter('this-week'))
      await waitFor(() => expect(listMatches).toHaveBeenLastCalledWith('test-club-id', expect.objectContaining({ focus: 'this-week' })))

      await user.click(counter('no-poll'))
      await waitFor(() => expect(listMatches).toHaveBeenLastCalledWith('test-club-id', expect.objectContaining({ focus: 'no-poll' })))
      expect(counter('this-week')).toHaveAttribute('aria-pressed', 'false')

      await user.click(counter('no-poll'))
      await waitFor(() => expect(listMatches.mock.calls.at(-1)?.[1].focus).toBeUndefined())
      expect(counter('shown')).toHaveAttribute('aria-pressed', 'true')

      await user.click(counter('this-week'))
      await waitFor(() => expect(listMatches).toHaveBeenLastCalledWith('test-club-id', expect.objectContaining({ focus: 'this-week' })))
      await user.click(counter('shown'))
      await waitFor(() => expect(listMatches.mock.calls.at(-1)?.[1].focus).toBeUndefined())
    })

    it('a counter at zero is a plain card, not a button', async () => {
      getMatchesSummary.mockResolvedValue({ matchesShown: 5, thisWeek: 0, teamsNotAnnounced: 0, withoutPoll: 1 })
      listMatches.mockResolvedValue(makePage([makeMatch()]))

      renderPage('test-club-id')

      await screen.findByTestId('page-counter-this-week')
      expect(counter('this-week').tagName).not.toBe('BUTTON')
      expect(counter('not-announced').tagName).not.toBe('BUTTON')
      expect(counter('no-poll').tagName).toBe('BUTTON')
    })

    it('hides the counters when the summary fails, and the list still works', async () => {
      getMatchesSummary.mockRejectedValue(new Error('boom'))
      listMatches.mockResolvedValue(makePage([makeMatch()]))

      renderPage('test-club-id')

      expect(await screen.findByText('1st XI vs Riverside Occasionals')).toBeInTheDocument()
      await waitFor(() => expect(getMatchesSummary).toHaveBeenCalled())
      expect(screen.queryByTestId('page-counter-shown')).not.toBeInTheDocument()
    })

    it('the Team field narrows the list and the counters through the backend teamId, and names the team under the title', async () => {
      const user = userEvent.setup()
      listMatches.mockResolvedValue(makePage([makeMatch()]))
      listTeamsForClub.mockResolvedValue([
        { id: 'team-1', name: '1st XI' },
        { id: 'team-2', name: '2nd XI' },
      ])
      listMatchFilterOptions.mockResolvedValue({ sectionIds: ['section-1'], leagueIds: [], seasonIds: [], teamIds: ['team-1'] })

      renderPage('test-club-id')

      await screen.findByText('1st XI vs Riverside Occasionals')
      await user.click(screen.getByLabelText('Team'))
      // only teams that filter-options reports as reachable are offered
      expect(screen.queryByRole('option', { name: '2nd XI' })).not.toBeInTheDocument()
      await user.click(await screen.findByRole('option', { name: '1st XI' }))

      await waitFor(() => expect(listMatches).toHaveBeenLastCalledWith('test-club-id', expect.objectContaining({ teamId: 'team-1' })))
      expect(getMatchesSummary).toHaveBeenLastCalledWith('test-club-id', expect.objectContaining({ teamId: 'team-1' }))
      expect(listMatchFilterOptions).toHaveBeenLastCalledWith('test-club-id', expect.objectContaining({ teamId: 'team-1' }))
      expect(await screen.findByText('Showing: 1st XI')).toBeInTheDocument()
    })

    it('never saves the team or the quick filter with the persisted Section, League and Season filters', async () => {
      const user = userEvent.setup()
      listMatches.mockResolvedValue(makePage([makeMatch()]))

      renderPage('test-club-id')

      await screen.findByTestId('page-counter-no-poll')
      await user.click(counter('no-poll'))
      await user.click(screen.getByLabelText('Team'))
      await user.click(await screen.findByRole('option', { name: '1st XI' }))
      await waitFor(() => expect(listMatches).toHaveBeenLastCalledWith('test-club-id', expect.objectContaining({ teamId: 'team-1', focus: 'no-poll' })))

      const persisted = JSON.parse(localStorage.getItem('matchList:filters:test-club-id') as string)
      expect(persisted).not.toHaveProperty('focus')
      expect(persisted).not.toHaveProperty('teamId')
    })

    it('on a phone the quick filter is a chip, counts in the Filters badge, shows a Quick filter row in the sheet, and Clear all clears it with the team', async () => {
      const user = userEvent.setup()
      window.matchMedia = ((query: string) => ({
        matches: query.includes('max-width'),
        media: query,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
      })) as unknown as typeof window.matchMedia
      try {
        listMatches.mockResolvedValue(makePage([makeMatch()]))

        renderPage('test-club-id')

        await screen.findByTestId('page-counter-not-announced')
        // the phone shows the short label; the full name stays accessible
        expect(within(counter('not-announced')).getByText('Not announced')).toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: '4 Teams not announced' }))

        expect(await screen.findByRole('button', { name: 'Filters, 1 active' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Remove filter Teams not announced' })).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: 'Filters, 1 active' }))
        expect(await screen.findByText(/Quick filter:/)).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: 'Clear all' }))
        await waitFor(() => expect(listMatches.mock.calls.at(-1)?.[1].focus).toBeUndefined())
        expect(counter('shown')).toHaveAttribute('aria-pressed', 'true')
      } finally {
        delete (window as { matchMedia?: unknown }).matchMedia
      }
    })
  })
})

