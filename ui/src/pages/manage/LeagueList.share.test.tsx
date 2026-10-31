import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LeagueList from './LeagueList'
import type { League } from '../../api/leagueApi'

const listLeagues = vi.fn()
const getLeaguesSummary = vi.fn()
const listSeasons = vi.fn()

// Mirrors SponsorList.test.tsx's mock-every-export-individually pattern. No deactivate/
// reactivate assertions here — docs/specs/038-move-deactivate-to-edit-screen.md relocated that
// control off this card entirely, onto LeagueFormPage's own actions bar.
vi.mock('../../api/leagueApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/leagueApi')>()
  return {
    ...actual,
    listLeagues: (clubId: string, params?: unknown) => listLeagues(clubId, params),
    getLeaguesSummary: (clubId: string, filters?: unknown) => getLeaguesSummary(clubId, filters),
    deactivateLeague: vi.fn(),
    reactivateLeague: vi.fn(),
  }
})

vi.mock('../../api/seasonApi', () => ({
  listSeasons: (clubId: string) => listSeasons(clubId),
}))

// docs/specs/122-league-sharing.md (Entry points): the league list opens the one Share League dialog from a card (Share button)
// and from a row (icon button), with League details and Schedule ticked and the selected season. The dialog is a stub here (it
// has its own test); it shows what it was opened with.
vi.mock('../../components/ShareLeagueDialog', () => ({
  ShareLeagueDialog: (props: { open: boolean; preselected: string[]; seasonId?: string | null; league: { name: string }; clubId: string; onClose: () => void }) =>
    props.open ? (
      <div role="dialog" aria-label="Share league stub" data-preselected={props.preselected.join(',')} data-season={props.seasonId ?? ''} data-club={props.clubId}>
        {props.league.name}
        <button onClick={props.onClose}>Stub close</button>
      </div>
    ) : null,
}))

const SEASON_2026 = {
  id: 'season-2026',
  clubId: 'test-club-id',
  label: '2026/2027',
  startDate: '2000-01-01',
  endDate: '2999-12-31',
  active: true,
  createdAt: '2026-02-01T00:00:00Z',
  updatedAt: '',
  updatedBy: null,
}
const SEASON_2025 = { ...SEASON_2026, id: 'season-2025', label: '2025/2026', startDate: '1999-01-01', endDate: '1999-12-31', createdAt: '2025-02-01T00:00:00Z' }

const SUMMARY = { leaguesShown: 6, active: 5, teamsEntered: 42, players: 311, seasons: 4, matchesThisWeek: 9, needAttention: 2 }

beforeEach(() => {
  // mockReset: a leftover mockResolvedValueOnce must not leak between tests
  for (const fn of [listLeagues, getLeaguesSummary, listSeasons]) fn.mockReset()
  localStorage.clear()
  listSeasons.mockResolvedValue([SEASON_2025, SEASON_2026])
  getLeaguesSummary.mockResolvedValue(SUMMARY)
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
    ageCutoffMonth: null,
    ageCutoffDay: null,
    active: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: null,
    currentSeasonTeamCount: 0,
    currentSeasonLabel: null,
    currentSeasonPlayingConditionsUrl: null,
    matchCount: 0,
    playedCount: 0,
    firstMatchDate: null,
    lastMatchDate: null,
    nextMatchDate: null,
    teams: [],
    format: null,
    logoUrl: null,
    phone: null,
    website: null,
    email: null,
    socialLinks: [],
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
            <Route path="leagues/:id/schedule" element={<div>League Schedule Page</div>} />
            <Route path="leagues/:id/edit" element={<div>Edit League Page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('LeagueList Share', () => {
  it('opens the dialog from a card with League details and Schedule ticked, and closes it', async () => {
    const user = userEvent.setup()
    listLeagues.mockResolvedValue([makeLeague({ name: 'Card League' })])
    renderList('test-club-id')

    await user.click(await screen.findByRole('button', { name: 'Actions for Card League' }))
    await user.click(screen.getByRole('menuitem', { name: 'Share League' }))

    const dialog = await screen.findByRole('dialog', { name: 'Share league stub' })
    expect(dialog).toHaveAttribute('data-preselected', 'DETAILS,SCHEDULE')
    expect(dialog).toHaveAttribute('data-season', 'season-2026')
    expect(dialog).toHaveAttribute('data-club', 'test-club-id')
    expect(dialog).toHaveTextContent('Card League')

    await user.click(within(dialog).getByRole('button', { name: 'Stub close' }))
    expect(screen.queryByRole('dialog', { name: 'Share league stub' })).not.toBeInTheDocument()
  })

  it('opens the dialog from a row in list view for that row\'s league', async () => {
    const user = userEvent.setup()
    listLeagues.mockResolvedValue([makeLeague({ id: 'league-1', name: 'First League' }), makeLeague({ id: 'league-2', name: 'Second League' })])
    renderList('test-club-id')

    await screen.findByText('First League')
    await user.click(screen.getAllByRole('button', { name: 'List' })[0])
    const table = await screen.findByRole('table', { name: 'Leagues' })
    await user.click(within(table).getByRole('button', { name: 'Actions for Second League' }))
    await user.click(screen.getByRole('menuitem', { name: 'Share League' }))

    const dialog = await screen.findByRole('dialog', { name: 'Share league stub' })
    expect(dialog).toHaveAttribute('data-preselected', 'DETAILS,SCHEDULE')
    expect(dialog).toHaveTextContent('Second League')
  })
})
