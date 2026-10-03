import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useLeagueTeamMutations } from './useLeagueTeamMutations'

const api = vi.hoisted(() => ({
  createLeagueTeam: vi.fn(),
  updateLeagueTeam: vi.fn(),
  removeLeagueTeam: vi.fn(),
  copyLeagueTeams: vi.fn(),
  deactivateLeagueTeam: vi.fn(),
  reactivateLeagueTeam: vi.fn(),
}))

vi.mock('../../../api/leagueTeamApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../api/leagueTeamApi')>()),
  ...api,
}))

const TEAMS_KEY = ['managed-club', 'club-1', 'leagues', 'league-1', 'seasons', 'season-1', 'league-teams']
const MATCHES_KEY = ['managed-club', 'club-1', 'matches', 'list']
const FIXTURES_KEY = ['managed-club', 'club-1', 'leagues', 'league-1', 'matches', 'season-1']

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  queryClient.setQueryData(TEAMS_KEY, [])
  queryClient.setQueryData(MATCHES_KEY, [])
  queryClient.setQueryData(FIXTURES_KEY, [])
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  const { result } = renderHook(() => useLeagueTeamMutations('club-1', 'league-1', 'season-1'), { wrapper })
  return { queryClient, result }
}

beforeEach(() => {
  vi.clearAllMocks()
  Object.values(api).forEach((fn) => fn.mockResolvedValue({}))
})

describe('useLeagueTeamMutations', () => {
  it('create invalidates the league-team list only', async () => {
    const { queryClient, result } = setup()
    await act(() => result.current.create.mutateAsync({ name: 'A' }))
    await waitFor(() => expect(queryClient.getQueryState(TEAMS_KEY)?.isInvalidated).toBe(true))
    expect(queryClient.getQueryState(MATCHES_KEY)?.isInvalidated).toBe(false)
  })

  it('update also invalidates the matches lists because the name propagates', async () => {
    const { queryClient, result } = setup()
    await act(() => result.current.update.mutateAsync({ id: 'lt-1', payload: { name: 'B' } }))
    await waitFor(() => expect(queryClient.getQueryState(MATCHES_KEY)?.isInvalidated).toBe(true))
    expect(queryClient.getQueryState(TEAMS_KEY)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(FIXTURES_KEY)?.isInvalidated).toBe(true)
  })

  it('remove invalidates the league page fixtures cache too', async () => {
    const { queryClient, result } = setup()
    await act(() => result.current.remove.mutateAsync('lt-1'))
    await waitFor(() => expect(queryClient.getQueryState(FIXTURES_KEY)?.isInvalidated).toBe(true))
    expect(queryClient.getQueryState(MATCHES_KEY)?.isInvalidated).toBe(true)
  })

  it('create leaves the fixtures cache alone', async () => {
    const { queryClient, result } = setup()
    await act(() => result.current.create.mutateAsync({ name: 'A' }))
    await waitFor(() => expect(queryClient.getQueryState(TEAMS_KEY)?.isInvalidated).toBe(true))
    expect(queryClient.getQueryState(FIXTURES_KEY)?.isInvalidated).toBe(false)
  })

  it('remove and copy invalidate the list', async () => {
    const { queryClient, result } = setup()
    await act(() => result.current.copy.mutateAsync({ sourceLeagueId: 'l', sourceSeasonId: 's', leagueTeamIds: ['x'] }))
    await waitFor(() => expect(queryClient.getQueryState(TEAMS_KEY)?.isInvalidated).toBe(true))
    queryClient.setQueryData(TEAMS_KEY, [])
    await act(() => result.current.remove.mutateAsync('lt-1'))
    await waitFor(() => expect(queryClient.getQueryState(TEAMS_KEY)?.isInvalidated).toBe(true))
  })
})
