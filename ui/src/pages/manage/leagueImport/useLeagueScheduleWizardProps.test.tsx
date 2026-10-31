import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useLeagueScheduleWizardProps } from './useLeagueScheduleWizardProps'

const mocks = vi.hoisted(() => ({
  leagues: vi.fn(),
  seasons: vi.fn(),
  leagueTeams: vi.fn(),
  affiliations: vi.fn(),
  matches: vi.fn(),
  areas: vi.fn(),
  teams: vi.fn(),
}))
vi.mock('../../../api/leagueApi', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../../api/leagueApi')>()), listLeagues: () => mocks.leagues() }))
vi.mock('../../../api/seasonApi', () => ({ listSeasons: () => mocks.seasons() }))
vi.mock('../../../api/leagueTeamApi', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../../api/leagueTeamApi')>()), listLeagueTeams: () => mocks.leagueTeams() }))
vi.mock('../../../api/leagueAffiliationApi', () => ({ listLeagueAffiliations: () => mocks.affiliations() }))
vi.mock('../../../api/matchApi', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../../api/matchApi')>()), listMatches: () => mocks.matches() }))
vi.mock('../../../api/playingAreaApi', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../../api/playingAreaApi')>()), listPlayingAreas: () => mocks.areas() }))
vi.mock('../../../api/teamApi', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../../api/teamApi')>()), listTeamsForClub: () => mocks.teams() }))

function wrapperFor(url: string) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>
      </QueryClientProvider>
    )
  }
}

const params = { leagueId: 'l1', seasonId: 's1' }

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset())
  mocks.leagues.mockResolvedValue([{ id: 'l1', name: 'Northern Premier League', active: true }])
  mocks.seasons.mockResolvedValue([{ id: 's1', label: '2026/27' }])
  mocks.leagueTeams.mockResolvedValue([
    { id: 'lt1', name: 'Hilton', active: true },
    { id: 'lt2', name: 'Maritzburg', active: true },
    { id: 'lt3', name: 'Retired XI', active: false },
    { id: 'lt4', name: 'CBC U13', active: true },
  ])
  mocks.affiliations.mockResolvedValue([
    { id: 'a1', teamId: 't1', seasonId: 's1' },
    { id: 'a2', teamId: 't2', seasonId: 'other-season' },
  ])
  mocks.matches.mockResolvedValue({ content: [{ venue: 'Kingsmead' }, { venue: 'kingsmead' }, { venue: null }] })
  mocks.areas.mockResolvedValue({ content: [{ name: 'Alpha Oval' }] })
  mocks.teams.mockResolvedValue([
    { id: 't1', name: 'CBC U13', active: true },
    { id: 't2', name: 'CBC U15', active: true },
    { id: 't3', name: 'Old', active: false },
  ])
})

describe('useLeagueScheduleWizardProps', () => {
  it('is null while the league and season load, then names the scope and the way back', async () => {
    const { result } = renderHook(() => useLeagueScheduleWizardProps('c1', params), { wrapper: wrapperFor('/x') })
    expect(result.current).toBeNull()
    await waitFor(() => expect(result.current).not.toBeNull())
    expect(result.current?.scopeLabel).toBe('Northern Premier League, 2026/27')
    expect(result.current?.backTo).toBe('/manage/fixtures/leagues/l1/schedule?seasonId=s1')
    expect(result.current?.backLabel).toBe('Back to the schedule')
    expect(result.current?.resultLinks).toEqual([{ label: 'View schedule', to: '/manage/fixtures/leagues/l1/schedule?seasonId=s1' }])
    expect(result.current?.createOptions?.existingNames).toEqual(expect.arrayContaining(['Hilton', 'Retired XI']))
  })

  it('falls back to "League" when the league is not in the list', async () => {
    mocks.leagues.mockResolvedValue([])
    const { result } = renderHook(() => useLeagueScheduleWizardProps('c1', params), { wrapper: wrapperFor('/x') })
    await waitFor(() => expect(result.current).not.toBeNull())
    expect(result.current?.scopeLabel).toBe('League, 2026/27')
  })

  it('a returnTo in the address wins, with its label; without a label the link just says Back', async () => {
    const origin = encodeURIComponent('/manage/fixtures/leagues?x=1')
    const labelled = renderHook(() => useLeagueScheduleWizardProps('c1', params), { wrapper: wrapperFor(`/x?returnTo=${origin}&returnLabel=Leagues`) })
    await waitFor(() => expect(labelled.result.current).not.toBeNull())
    expect(labelled.result.current?.backTo).toBe('/manage/fixtures/leagues?x=1')
    expect(labelled.result.current?.backLabel).toBe('Back to Leagues')
    const bare = renderHook(() => useLeagueScheduleWizardProps('c1', params), { wrapper: wrapperFor(`/x?returnTo=${origin}`) })
    await waitFor(() => expect(bare.result.current).not.toBeNull())
    expect(bare.result.current?.backLabel).toBe('Back')
  })

  it('an unsafe returnTo is ignored', async () => {
    const { result } = renderHook(() => useLeagueScheduleWizardProps('c1', params), { wrapper: wrapperFor(`/x?returnTo=${encodeURIComponent('https://evil.example')}`) })
    await waitFor(() => expect(result.current).not.toBeNull())
    expect(result.current?.backTo).toBe('/manage/fixtures/leagues/l1/schedule?seasonId=s1')
  })

  it('fetches no suggestions until the Check rows step, then offers only this league and season teams and the venues in use', async () => {
    const { result } = renderHook(() => useLeagueScheduleWizardProps('c1', params), { wrapper: wrapperFor('/x') })
    await waitFor(() => expect(result.current).not.toBeNull())
    expect(mocks.teams).not.toHaveBeenCalled()
    // Only the league's own active teams, none of our club teams yet.
    expect(result.current?.columnOptions?.home?.map((option) => (typeof option === 'string' ? option : option.kind))).toEqual(['LEAGUE_TEAM', 'LEAGUE_TEAM', 'LEAGUE_TEAM'])

    act(() => result.current?.onStepChange?.('rows'))
    await waitFor(() => expect(result.current?.columnOptions?.venue?.length).toBeGreaterThan(0))
    
    const home = result.current?.columnOptions?.home ?? []
    // Own affiliated team only (CBC U15 is affiliated to another season, Old is inactive, Retired XI is an inactive league team).
    expect(home.map((option) => (typeof option === 'string' ? option : option.label))).toEqual(['CBC U13', 'Hilton', 'Maritzburg'])
    expect(home.map((option) => (typeof option === 'string' ? option : option.label))).not.toContain('CBC U15')
    expect(home.map((option) => (typeof option === 'string' ? option : option.label))).not.toContain('Retired XI')
    // The own team keeps its identity when a league team shares its name.
    const cbc = home.find((option) => typeof option !== 'string' && option.label === 'CBC U13')
    expect(cbc).toMatchObject({ kind: 'OWN_TEAM', id: 't1' })
    expect(result.current?.columnOptions?.away).toEqual(home)
    // Venues: distinct ignoring case, sorted, blanks dropped.
    expect(result.current?.columnOptions?.venue).toEqual(['Alpha Oval', 'Kingsmead'])
  })

  it('with no affiliation this season, falls back to our teams already in the league', async () => {
    mocks.affiliations.mockResolvedValue([])
    const { result } = renderHook(() => useLeagueScheduleWizardProps('c1', params), { wrapper: wrapperFor('/x') })
    await waitFor(() => expect(result.current).not.toBeNull())
    act(() => result.current?.onStepChange?.('rows'))
    await waitFor(() => expect(result.current?.columnOptions?.venue?.length).toBeGreaterThan(0))
    const labels = (result.current?.columnOptions?.home ?? []).map((option) => (typeof option === 'string' ? option : option.label))
    expect(labels).not.toContain('CBC U15')
    expect(labels).toContain('CBC U13')
  })

  it('the confirm label and settings come from the schedule helpers', async () => {
    const { result } = renderHook(() => useLeagueScheduleWizardProps('c1', params), { wrapper: wrapperFor('/x') })
    await waitFor(() => expect(result.current).not.toBeNull())
    expect(result.current?.labels?.rowsStep).toBe('Check')
    expect(result.current?.editLayout?.differentPair).toEqual(['home', 'away'])
    expect(result.current?.invalidateKeys).toContainEqual(['managed-club', 'c1', 'matches'])
  })
})
