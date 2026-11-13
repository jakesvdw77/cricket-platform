import { QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from './axiosConfig'
import { clubInfoKeys, getMyClubContacts, getMyClubInfo, useMyClubContacts, useMyClubInfo } from './meClubInfoApi'
import { httpError, newQueryClient, routeApi } from '../test/accountTestUtils'
import type { ApiMock } from '../test/accountTestUtils'
import { makeClubInfo, makeContact, makeContactPage } from '../test/clubInfoFixtures'

vi.mock('./axiosConfig', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }))

// docs/specs/148 (API Contract): the two read-only reads and their query keys.
const http = api as unknown as ApiMock
const INFO = '/me/players/k1/club-info'
const CONTACTS = `${INFO}/contacts`
const NONE = { query: '', sort: 'name', letter: null } as const

function hook<T>(run: () => T) {
  const client = newQueryClient()
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
  return renderHook(run, { wrapper })
}
const lastParams = () => (http.get.mock.calls.filter((call) => call[0] === CONTACTS).at(-1)?.[1] as { params: Record<string, unknown> }).params

beforeEach(() => vi.clearAllMocks())

describe('query keys', () => {
  it('nest under the player so one invalidation reaches both reads, and carry every filter', () => {
    expect(clubInfoKeys.info('k1')).toEqual(['me', 'players', 'k1', 'club-info', 'info'])
    expect(clubInfoKeys.contacts('k1', { query: 'ben', sort: 'role', letter: 'N' })).toEqual(['me', 'players', 'k1', 'club-info', 'contacts', 'ben', 'role', 'N'])
    expect(clubInfoKeys.info('k1').slice(0, 4)).toEqual(clubInfoKeys.all('k1'))
  })
})

describe('getMyClubInfo and getMyClubContacts', () => {
  it('reads the club info of the player', async () => {
    routeApi(http, { [`GET ${INFO}`]: makeClubInfo() })

    expect((await getMyClubInfo('k1')).clubName).toBe('Riverside CC')
  })

  it('sends sort, page and size, and leaves query and letter out when empty', async () => {
    routeApi(http, { [`GET ${CONTACTS}`]: makeContactPage([]) })

    await getMyClubContacts('k1', NONE, 0, 25)
    expect(lastParams()).toEqual({ sort: 'name', page: 0, size: 25 })
    await getMyClubContacts('k1', { query: '  ben  ', sort: 'role', letter: 'N' }, 2, 25)
    expect(lastParams()).toEqual({ sort: 'role', page: 2, size: 25, query: 'ben', letter: 'N' })
    await getMyClubContacts('k1', { query: '   ', sort: 'name', letter: null }, 0, 25)
    expect(lastParams()).not.toHaveProperty('query')
  })
})

describe('useMyClubInfo', () => {
  it('does not ask without a player key', () => {
    routeApi(http, { [`GET ${INFO}`]: makeClubInfo() })
    hook(() => useMyClubInfo(undefined))

    expect(http.get).not.toHaveBeenCalled()
  })

  it('does not retry a failure', async () => {
    routeApi(http, { [`GET ${INFO}`]: httpError(500) })
    const { result } = hook(() => useMyClubInfo('k1'))

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(http.get).toHaveBeenCalledTimes(1)
  })
})

describe('useMyClubContacts', () => {
  it('pages through the server: the next page is requested and the items are flattened, last page letters win', async () => {
    routeApi(http, {
      [`GET ${CONTACTS}`]: ({ config }: { config?: { params?: Record<string, unknown> } }) =>
        config?.params?.page === 1
          ? makeContactPage([makeContact({ id: 'c3' })], { page: 1, hasMore: false, letters: ['A', 'B'] })
          : makeContactPage([makeContact({ id: 'c1' }), makeContact({ id: 'c2' })], { page: 0, hasMore: true, letters: ['A'] }),
    })
    const { result } = hook(() => useMyClubContacts('k1', NONE))

    await waitFor(() => expect(result.current.items).toHaveLength(2))
    expect(result.current.hasNextPage).toBe(true)
    expect(lastParams()).toMatchObject({ page: 0, size: 25 })

    await act(async () => { await result.current.fetchNextPage() })
    await waitFor(() => expect(result.current.items.map((item) => item.id)).toEqual(['c1', 'c2', 'c3']))
    expect(lastParams()).toMatchObject({ page: 1, size: 25 })
    expect(result.current.hasNextPage).toBe(false)
    expect(result.current.lastPage?.letters).toEqual(['A', 'B'])
  })

  it('does not ask when disabled or without a player key, and does not retry a failure', async () => {
    routeApi(http, { [`GET ${CONTACTS}`]: httpError(500) })
    hook(() => useMyClubContacts('k1', NONE, false))
    hook(() => useMyClubContacts(undefined, NONE))
    expect(http.get).not.toHaveBeenCalled()

    const { result } = hook(() => useMyClubContacts('k1', NONE))
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(http.get).toHaveBeenCalledTimes(1)
  })
})
