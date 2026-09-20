import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MatchList from './MatchList'
import type { Match } from '../../api/matchApi'
import type { Page } from '../../api/productApi'

const listMatches = vi.fn()
const listTeamsForClub = vi.fn()
const listLeagues = vi.fn()
const listSeasons = vi.fn()
const listSections = vi.fn()

vi.mock('../../api/matchApi', () => ({
  listMatches: (clubId: string, params: unknown) => listMatches(clubId, params),
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
  listTeamsForClub.mockResolvedValue([{ id: 'team-1', name: '1st XI' }])
  listLeagues.mockResolvedValue([])
  listSeasons.mockResolvedValue([])
  listSections.mockResolvedValue([
    { id: 'section-1', clubId: 'test-club-id', parentSectionId: null, name: 'Men', minAge: null, maxAge: null, gender: null, active: true, createdAt: '', updatedAt: '', updatedBy: null },
  ])
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

  // docs/specs/041-list-screen-header-actions.md: MatchList's default viewTo AND editTo are both
  // real routes, so its card is the one existing call site where RecordCard's revised
  // View+Edit-together rendering is actually reachable today.
  it('renders View and Edit together on a card, both pointing at the match\'s own routes', async () => {
    listMatches.mockResolvedValueOnce(makePage([makeMatch({ id: 'match-1' })]))

    renderPage('test-club-id')

    await screen.findByText('1st XI vs Riverside Occasionals')
    expect(screen.getByRole('link', { name: 'View' })).toHaveAttribute('href', '/manage/fixtures/matches/match-1')
    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute(
      'href',
      '/manage/fixtures/matches/match-1/edit',
    )
  })

  // docs/specs/037-match-improvements.md item 1
  it('sends upcomingOnly: true by default, with no UI toggle to change it', async () => {
    listMatches.mockResolvedValueOnce(makePage([makeMatch()]))

    renderPage('test-club-id')

    await screen.findByText('1st XI vs Riverside Occasionals')
    expect(listMatches).toHaveBeenCalledWith('test-club-id', expect.objectContaining({ upcomingOnly: true }))
  })

  // docs/specs/037-match-improvements.md item 2
  describe('Select Team shortcut', () => {
    it('navigates to the edit route\'s Playing XI tab when the match has a real-Team side', async () => {
      const user = userEvent.setup()
      listMatches.mockResolvedValueOnce(makePage([makeMatch({ homeTeamId: 'team-1' })]))

      renderPage('test-club-id')

      await screen.findByText('1st XI vs Riverside Occasionals')
      await user.click(screen.getByRole('button', { name: 'Select Team' }))

      expect(await screen.findByText('Edit Match Page')).toBeInTheDocument()
    })

    it('is hidden for a match with no real-Team side on either end', async () => {
      listMatches.mockResolvedValueOnce(
        makePage([makeMatch({ homeTeamId: null, homeTeamName: 'Home Occasionals', awayTeamId: null, awayTeamName: 'Away Occasionals' })]),
      )

      renderPage('test-club-id')

      await screen.findByText('Home Occasionals vs Away Occasionals')
      expect(screen.queryByRole('button', { name: 'Select Team' })).not.toBeInTheDocument()
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
      await user.click(screen.getByRole('button', { name: 'Select Team' }))

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
    it('shows an unprefixed "Not Announced" badge for the one real-Team side', async () => {
      listMatches.mockResolvedValueOnce(
        makePage([makeMatch({ homeTeamId: 'team-1', homeSideAnnounced: false })]),
      )

      renderPage('test-club-id')

      expect(await screen.findByText('Not Announced')).toBeInTheDocument()
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
      expect(screen.getByText('2nd XI: Not Announced')).toBeInTheDocument()
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

      expect(await screen.findByText('1st XI: Not Announced')).toBeInTheDocument()
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
  // the card at all (active or inactive) — it moved to MatchFormPage's own actions bar. "Select
  // Team" and "Team Sheet" (037/041 — the latter shortened from "Communicate Team Sheet") are
  // unaffected — still on the card.
  it('never renders a Deactivate/Reactivate button on the card, while Select Team/Team Sheet remain', async () => {
    listMatches.mockResolvedValueOnce(makePage([makeMatch({ id: 'match-1', active: true, homeTeamId: 'team-1' })]))

    renderPage('test-club-id')

    await screen.findByText('1st XI vs Riverside Occasionals')
    expect(screen.queryByRole('button', { name: 'Deactivate' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reactivate' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Select Team' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Team Sheet' })).toBeInTheDocument()
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
})
