import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LeagueDetailPage from './LeagueDetailPage'
import type { League } from '../../api/leagueApi'
import type { Season } from '../../api/seasonApi'
import type { Team } from '../../api/teamApi'
import type { LeagueAffiliation } from '../../api/leagueAffiliationApi'

const listLeagues = vi.fn()
const listSeasons = vi.fn()
const listTeamsForClub = vi.fn()
const listLeagueAffiliations = vi.fn()

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
            <Route path="leagues/:leagueId" element={<LeagueDetailPage />} />
            <Route path="leagues/:leagueId/edit" element={<div>Edit League Page</div>} />
          </Route>
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

  it('renders affiliated teams for the default season as viewTo cards, not edit links', async () => {
    listLeagues.mockResolvedValueOnce([makeLeague({ id: 'league-1' })])
    listSeasons.mockResolvedValueOnce([makeSeason({ id: 'season-1' })])
    listTeamsForClub.mockResolvedValueOnce([makeTeam({ id: 'team-1', sectionId: 'section-1', name: '1st XI' })])
    listLeagueAffiliations.mockResolvedValueOnce([makeAffiliation({ teamId: 'team-1', seasonId: 'season-1' })])

    renderPage('/manage/fixtures/leagues/league-1', 'test-club-id')

    await screen.findByRole('heading', { name: 'Internal League' })

    const teamLink = await screen.findByRole('link', { name: /view/i })
    expect(teamLink).toHaveAttribute('href', '/manage/sections/section-1/teams/team-1')
    expect(screen.getByText('1st XI')).toBeInTheDocument()
  })

  it('renders an error state when the matching league id is not in the fetched list', async () => {
    listLeagues.mockResolvedValueOnce([makeLeague({ id: 'some-other-id' })])

    renderPage('/manage/fixtures/leagues/league-1', 'test-club-id')

    expect(await screen.findByText("Couldn't load this league")).toBeInTheDocument()
  })
})
