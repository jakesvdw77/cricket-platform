import { QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from './axiosConfig'
import { getMyClosedPolls, getMyPollResponses, useMyClosedPolls, useMyPollResponses } from './meAvailabilityApi'
import { calls, httpError, newQueryClient, routeApi } from '../test/accountTestUtils'
import type { ApiMock } from '../test/accountTestUtils'

vi.mock('./axiosConfig', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }))

// Player Hub Availability sub-menus: the Closed Polls and My Responses reads, their params and their query keys.
const http = api as unknown as ApiMock
const CLOSED = { sinceDays: 30, total: 0, rows: [] }
const RESPONSES = { scope: { seasonId: null }, seasons: [], currentSeasonId: null, summary: { polls: 0, answered: 0, available: 0, unavailable: 0, notSure: 0, notAnswered: 0 }, rows: [] }

const wrapper = (client = newQueryClient()) => ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>

beforeEach(() => vi.clearAllMocks())

describe('meAvailabilityApi requests', () => {
  it('asks for the last 30 days by default and adds the status only when one is set', async () => {
    routeApi(http, { 'GET /me/players/k1/polls/closed': CLOSED })

    await getMyClosedPolls('k1', {})
    await getMyClosedPolls('k1', { sinceDays: 7, status: 'UNSURE' })
    await getMyClosedPolls('k1', { status: null })

    const params = calls(http.get, '/me/players/k1/polls/closed').map((call) => call[1].params)
    expect(params).toEqual([{ sinceDays: 30 }, { sinceDays: 7, status: 'UNSURE' }, { sinceDays: 30 }])
  })

  it('sends seasonId and status to the responses read only when set', async () => {
    routeApi(http, { 'GET /me/players/k1/polls/responses': RESPONSES })

    await getMyPollResponses('k1', {})
    await getMyPollResponses('k1', { seasonId: 's9', status: 'NOT_ANSWERED' })

    const params = calls(http.get, '/me/players/k1/polls/responses').map((call) => call[1].params)
    expect(params).toEqual([{}, { seasonId: 's9', status: 'NOT_ANSWERED' }])
  })
})

describe('meAvailabilityApi hooks', () => {
  it('does not fetch without a player key or when disabled', async () => {
    routeApi(http, { 'GET /me/players/k1/polls/closed': CLOSED, 'GET /me/players/k1/polls/responses': RESPONSES })

    renderHook(() => useMyClosedPolls(undefined), { wrapper: wrapper() })
    renderHook(() => useMyPollResponses('k1', {}, false), { wrapper: wrapper() })
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(http.get).not.toHaveBeenCalled()
  })

  it('keys each query by player, sinceDays or season and status, so a different filter is a different read', async () => {
    routeApi(http, { 'GET /me/players/k1/polls/closed': CLOSED, 'GET /me/players/k1/polls/responses': RESPONSES })
    const client = newQueryClient()

    const closed = renderHook(() => useMyClosedPolls('k1', { sinceDays: 7, status: 'AVAILABLE' }), { wrapper: wrapper(client) })
    const responses = renderHook(() => useMyPollResponses('k1', { seasonId: 's2' }), { wrapper: wrapper(client) })
    await waitFor(() => expect(closed.result.current.isSuccess).toBe(true))
    await waitFor(() => expect(responses.result.current.isSuccess).toBe(true))

    const keys = client.getQueryCache().getAll().map((query) => query.queryKey)
    expect(keys).toContainEqual(['me', 'players', 'k1', 'polls', 'closed', 7, 'AVAILABLE'])
    expect(keys).toContainEqual(['me', 'players', 'k1', 'polls', 'responses', 's2', ''])
  })

  it('does not retry a failed read', async () => {
    routeApi(http, { 'GET /me/players/k1/polls/closed': httpError(500) })
    // newQueryClient already sets retry false, so use a client with the default to prove the hook's own retry: false.
    const { QueryClient } = await import('@tanstack/react-query')
    const client = new QueryClient()

    const { result } = renderHook(() => useMyClosedPolls('k1'), { wrapper: wrapper(client) })
    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(calls(http.get, '/me/players/k1/polls/closed')).toHaveLength(1)
  })
})
