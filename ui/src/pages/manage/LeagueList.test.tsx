import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LeagueList from './LeagueList'
import type { League } from '../../api/leagueApi'

const listLeagues = vi.fn()

// Mirrors SponsorList.test.tsx's mock-every-export-individually pattern. No deactivate/
// reactivate assertions here — docs/specs/038-move-deactivate-to-edit-screen.md relocated that
// control off this card entirely, onto LeagueFormPage's own actions bar.
vi.mock('../../api/leagueApi', () => ({
  listLeagues: (clubId: string) => listLeagues(clubId),
  deactivateLeague: vi.fn(),
  reactivateLeague: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

function makeLeague(overrides: Partial<League> = {}): League {
  return {
    id: 'league-1',
    clubId: 'test-club-id',
    name: 'Internal League',
    source: 'INTERNAL',
    maxPlayingXiSize: 11,
    minAge: null,
    maxAge: null,
    ageCutoffDate: null,
    active: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: null,
    currentSeasonTeamCount: 0,
    currentSeasonLabel: null,
    currentSeasonPlayingConditionsUrl: null,
    ...overrides,
  }
}

// LeagueList reads clubId via useOutletContext, not useParams (normally threaded through by
// ManagerHome's own <Outlet context={{ clubId }} />) — same wrapper-route shape as
// SponsorList.test.tsx, reproduced here without pulling ManagerHome in.
function OutletContextWrapper({ clubId }: { clubId?: string }) {
  return <Outlet context={{ clubId }} />
}

function renderList(clubId?: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/manage/fixtures/leagues']}>
        <Routes>
          <Route path="/manage/fixtures" element={<OutletContextWrapper clubId={clubId} />}>
            <Route path="leagues" element={<LeagueList />} />
            <Route path="leagues/new" element={<div>Add League Page</div>} />
            <Route path="leagues/:id/edit" element={<div>Edit League Page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('LeagueList', () => {
  it('renders "Not authorized" and does not fetch when no clubId is in the Outlet context', () => {
    renderList(undefined)

    expect(screen.getByText('Not authorized')).toBeInTheDocument()
    expect(listLeagues).not.toHaveBeenCalled()
  })

  it('renders nothing while the list is loading', () => {
    listLeagues.mockReturnValueOnce(new Promise(() => {}))

    renderList('test-club-id')

    expect(screen.queryByText('No leagues yet')).not.toBeInTheDocument()
    expect(screen.queryByText('Not authorized')).not.toBeInTheDocument()
  })

  it('renders an error state when the fetch fails', async () => {
    listLeagues.mockRejectedValueOnce(new Error('network error'))

    renderList('test-club-id')

    expect(await screen.findByText("Couldn't load leagues")).toBeInTheDocument()
  })

  it('renders the "No leagues yet" empty state when the club has no leagues', async () => {
    listLeagues.mockResolvedValueOnce([])

    renderList('test-club-id')

    expect(await screen.findByText('No leagues yet')).toBeInTheDocument()
  })

  it('renders a card per league with its fields and an Inactive badge for a deactivated one', async () => {
    listLeagues.mockResolvedValueOnce([
      makeLeague({ id: 'league-1', name: 'Internal League' }),
      makeLeague({ id: 'league-2', name: 'Retired League', active: false }),
    ])

    renderList('test-club-id')

    expect(await screen.findByText('Internal League')).toBeInTheDocument()
    expect(screen.getByText('Retired League')).toBeInTheDocument()
    expect(screen.getByText('Inactive')).toBeInTheDocument()
  })

  it('filters cards by the search term (matched against name)', async () => {
    listLeagues.mockResolvedValueOnce([
      makeLeague({ id: 'league-1', name: 'Internal League' }),
      makeLeague({ id: 'league-2', name: 'External League' }),
    ])

    renderList('test-club-id')

    await screen.findByText('Internal League')
    expect(screen.getByText('External League')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'internal' } })

    expect(await screen.findByText('Internal League')).toBeInTheDocument()
    expect(screen.queryByText('External League')).not.toBeInTheDocument()
  })

  // docs/specs/043-list-toolbar-gold-standard.md: the Sort Select was replaced by a compact icon
  // toggle — this exercises the previously-dead `direction === 'desc'` branch for real, not just
  // visually.
  it('clicking the sort icon reverses the card order, and flips its own accessible name', async () => {
    const user = userEvent.setup()
    listLeagues.mockResolvedValueOnce([
      makeLeague({ id: 'league-1', name: 'Alpha League' }),
      makeLeague({ id: 'league-2', name: 'Zeta League' }),
    ])

    renderList('test-club-id')

    await screen.findByText('Alpha League')
    expect(screen.getAllByRole('heading', { level: 3 }).map((el) => el.textContent)).toEqual([
      'Alpha League',
      'Zeta League',
    ])

    await user.click(screen.getByRole('button', { name: 'Name, Z to A' }))

    expect(screen.getAllByRole('heading', { level: 3 }).map((el) => el.textContent)).toEqual([
      'Zeta League',
      'Alpha League',
    ])
    expect(screen.getByRole('button', { name: 'Name, A to Z' })).toBeInTheDocument()
  })

  it('clicking Add League navigates to the create route', async () => {
    const user = userEvent.setup()
    listLeagues.mockResolvedValueOnce([])

    renderList('test-club-id')

    await screen.findByText('No leagues yet')
    await user.click(screen.getByRole('button', { name: 'Add League' }))

    expect(await screen.findByText('Add League Page')).toBeInTheDocument()
  })

  // docs/specs/049-record-list-edit-action-rollout.md: mirrors MatchList.test.tsx's own
  // precedent test for the View+Edit dual-render footer.
  it('renders View and Edit together on a card, both pointing at the league\'s own routes', async () => {
    listLeagues.mockResolvedValueOnce([makeLeague({ id: 'league-1' })])

    renderList('test-club-id')

    await screen.findByText('Internal League')
    expect(screen.getByRole('link', { name: 'View' })).toHaveAttribute(
      'href',
      '/manage/fixtures/leagues/league-1',
    )
    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute(
      'href',
      '/manage/fixtures/leagues/league-1/edit',
    )
  })

  // docs/specs/038-move-deactivate-to-edit-screen.md: Deactivate/Reactivate no longer renders on
  // the list card at all — active or inactive — it moved to LeagueFormPage's own actions bar.
  it('never renders a Deactivate/Reactivate button on the card, active or inactive', async () => {
    listLeagues.mockResolvedValueOnce([
      makeLeague({ id: 'league-1', name: 'Internal League', active: true }),
      makeLeague({ id: 'league-2', name: 'Retired League', active: false }),
    ])

    renderList('test-club-id')

    await screen.findByText('Internal League')
    expect(screen.getByText('Retired League')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Deactivate' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reactivate' })).not.toBeInTheDocument()
  })

  // docs/specs/050-league-schedule-and-fixtures.md item 1: leagueSeasonBadges' two badges,
  // rendered via RecordCard's own badges prop.
  describe('season badges', () => {
    it('renders both the team-count and season-label badges when the club has a current season', async () => {
      listLeagues.mockResolvedValueOnce([
        makeLeague({ id: 'league-1', currentSeasonTeamCount: 6, currentSeasonLabel: '2026/2027' }),
      ])

      renderList('test-club-id')

      await screen.findByText('Internal League')
      expect(screen.getByText('6 teams')).toBeInTheDocument()
      expect(screen.getByText('2026/2027')).toBeInTheDocument()
    })

    it('singularizes the team-count badge label for exactly one team', async () => {
      listLeagues.mockResolvedValueOnce([makeLeague({ id: 'league-1', currentSeasonTeamCount: 1, currentSeasonLabel: '2026' })])

      renderList('test-club-id')

      await screen.findByText('Internal League')
      expect(screen.getByText('1 team')).toBeInTheDocument()
    })

    it('omits the season-label badge entirely (not blank) when the club has no current season', async () => {
      listLeagues.mockResolvedValueOnce([
        makeLeague({ id: 'league-1', currentSeasonTeamCount: 0, currentSeasonLabel: null }),
      ])

      renderList('test-club-id')

      await screen.findByText('Internal League')
      expect(screen.getByText('0 teams')).toBeInTheDocument()
      // The only other badge this card can show is Active/Inactive — confirms no empty/blank
      // season badge slipped through instead of being omitted outright.
      expect(screen.queryByText('Inactive')).not.toBeInTheDocument()
    })
  })

  // docs/specs/050-league-schedule-and-fixtures.md item 8: the conditional "Playing Conditions"
  // card footer action — mirrors MatchList.tsx's own "Team Sheet"/window.open precedent, but
  // this one opens the URL directly (no dialog in between).
  describe('Playing Conditions action', () => {
    it('renders the action and opens the document URL in a new tab when currentSeasonPlayingConditionsUrl is set', async () => {
      const user = userEvent.setup()
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
      listLeagues.mockResolvedValueOnce([
        makeLeague({ id: 'league-1', currentSeasonPlayingConditionsUrl: '/media/2f6a1c9e-playing-conditions.pdf' }),
      ])

      renderList('test-club-id')

      await screen.findByText('Internal League')
      await user.click(screen.getByRole('button', { name: 'Playing Conditions' }))

      expect(openSpy).toHaveBeenCalledWith('/media/2f6a1c9e-playing-conditions.pdf', '_blank')
      openSpy.mockRestore()
    })

    it('does not render the action at all when currentSeasonPlayingConditionsUrl is null', async () => {
      listLeagues.mockResolvedValueOnce([makeLeague({ id: 'league-1', currentSeasonPlayingConditionsUrl: null })])

      renderList('test-club-id')

      await screen.findByText('Internal League')
      expect(screen.queryByRole('button', { name: 'Playing Conditions' })).not.toBeInTheDocument()
    })
  })
})
