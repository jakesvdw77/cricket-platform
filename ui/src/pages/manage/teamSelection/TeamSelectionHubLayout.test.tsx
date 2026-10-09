import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TeamSelectionHubLayout from './TeamSelectionHubLayout'
import MatchesView from './MatchesView'
import { PlaceholderView } from './PlaceholderView'
import { makeOverview, sampleMatches } from './teamSelectionTestUtils'
import type { Season } from '../../../api/seasonApi'

vi.mock('../../../api/leagueApi', () => ({ listLeagues: () => Promise.resolve([{ id: 'lg-1', name: 'Over 40 League' }]) }))
vi.mock('../../../api/sectionApi', () => ({ listSections: () => Promise.resolve([{ id: 'sec-1', name: 'Over 40', parentSectionId: null }]) }))
const listTeamsForClub = vi.fn()
vi.mock('../../../api/teamApi', () => ({ listTeamsForClub: (...args: unknown[]) => listTeamsForClub(...args) }))
const listSeasons = vi.fn()
vi.mock('../../../api/seasonApi', () => ({ listSeasons: (...args: unknown[]) => listSeasons(...args) }))
// The hook and its fetcher live in one module, so the HTTP client is what the tests replace.
const get = vi.fn()
vi.mock('../../../api/axiosConfig', () => ({ default: { get: (...args: unknown[]) => get(...args) } }))
const getTeamSelection = {
  mockReset: () => get.mockReset(),
  mockResolvedValue: (value: unknown) => get.mockResolvedValue({ data: value }),
  mockRejectedValue: (error: unknown) => get.mockRejectedValue(error),
}
const lastParams = () => get.mock.lastCall?.[1].params
vi.mock('../../../api/matchSideApi', () => ({ announceMatchSide: vi.fn() }))

function season(id: string, label: string, startDate: string, endDate: string): Season {
  return { id, clubId: 'club-1', label, startDate, endDate, active: true, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', updatedBy: null }
}
const SEASONS = [season('s-old', '2025', '2025-01-01', '2025-12-31'), season('s-now', '2026', '2026-01-01', '2026-12-31')]

function ClubShell() {
  return <Outlet context={{ clubId: 'club-1' }} />
}

function renderHub(path = '/manage/team-selection') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route element={<ClubShell />}>
            <Route path="/manage/team-selection" element={<TeamSelectionHubLayout />}>
              <Route index element={<Navigate to="matches" replace />} />
              <Route path="matches" element={<MatchesView />} />
              <Route path="players" element={<PlaceholderView title="Players" />} />
              <Route path="slots" element={<PlaceholderView title="Time slots" />} />
              <Route path="batting" element={<PlaceholderView title="Batting order" />} />
            </Route>
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  localStorage.clear()
  listTeamsForClub.mockReset()
  listTeamsForClub.mockResolvedValue([{ id: 'tm-1', name: 'Riverside Vets A' }])
  listSeasons.mockReset()
  listSeasons.mockResolvedValue(SEASONS)
  getTeamSelection.mockReset()
  getTeamSelection.mockResolvedValue(makeOverview(sampleMatches()))
})

describe('TeamSelectionHubLayout', () => {
  it('shows the Team selection header, the four-way switch and lands on Matches from the bare address', async () => {
    renderHub()
    expect(screen.getByRole('heading', { name: 'Team selection' })).toBeInTheDocument()
    const nav = screen.getByRole('navigation', { name: 'Team selection views' })
    expect(within(nav).getAllByRole('link').map((link) => link.textContent)).toEqual(['Matches', 'Players', 'Time slots', 'Batting order'])
    expect(within(nav).getByRole('link', { name: 'Matches' })).toHaveAttribute('aria-current', 'page')
    expect(await screen.findByRole('table', { name: 'Team selection by match' })).toBeInTheDocument()
  })

  it('switches to the placeholder views and back without losing the filters', async () => {
    localStorage.setItem('teamSelection:filters:club-1', JSON.stringify({ seasonId: 's-old', leagueId: 'lg-1', sectionId: null, teamId: null }))
    renderHub('/manage/team-selection/matches')
    await screen.findByRole('table', { name: 'Team selection by match' })
    await userEvent.click(screen.getByRole('link', { name: 'Batting order' }))
    expect(screen.getByText('This view is coming soon.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Batting order' })).toHaveAttribute('aria-current', 'page')
    await userEvent.click(screen.getByRole('link', { name: 'Matches' }))
    await screen.findByRole('table', { name: 'Team selection by match' })
    expect(lastParams()).toEqual(expect.objectContaining({ seasonId: 's-old', leagueId: 'lg-1' }))
  })

  it('requests the default season (the one containing today) without an All seasons choice', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-06-01T12:00:00'))
    try {
      renderHub()
      await waitFor(() => expect(get).toHaveBeenCalled())
      expect(get.mock.lastCall?.[0]).toBe('/manage/clubs/club-1/team-selection')
      expect(lastParams()).toEqual({ seasonId: 's-now' })
      await userEvent.click(screen.getByRole('button', { name: 'Season' }))
      expect(screen.queryByRole('option', { name: 'All seasons' })).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('saves the chosen season per club', async () => {
    renderHub()
    await screen.findByRole('table', { name: 'Team selection by match' })
    await userEvent.click(screen.getByRole('button', { name: 'Season' }))
    await userEvent.click(screen.getByRole('option', { name: '2025' }))
    await waitFor(() => expect(JSON.parse(localStorage.getItem('teamSelection:filters:club-1') ?? '{}').seasonId).toBe('s-old'))
  })
})
