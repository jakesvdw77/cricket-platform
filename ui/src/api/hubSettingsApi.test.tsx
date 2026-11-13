import { QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from './axiosConfig'
import { getHubSettings, hubSettingsKey, updateHubSettings } from './hubSettingsApi'
import { useHubSettings } from '../hooks/useHubSettings'
import { newQueryClient, routeApi } from '../test/accountTestUtils'
import type { ApiMock } from '../test/accountTestUtils'
import { makeHubSettings } from '../test/clubInfoFixtures'

vi.mock('./axiosConfig', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }))

// docs/specs/148 (API Contract, Manager side): GET and PUT of the eight switches; the hook keeps the cache in step with the write.
const http = api as unknown as ApiMock
const URL = '/manage/clubs/c1/hub-settings'

beforeEach(() => vi.clearAllMocks())

describe('hubSettingsApi', () => {
  it('reads and replaces the settings at the club hub-settings path', async () => {
    const settings = makeHubSettings()
    routeApi(http, { [`GET ${URL}`]: settings, [`PUT ${URL}`]: ({ body }: { body?: unknown }) => body })

    expect(await getHubSettings('c1')).toEqual(settings)
    expect(await updateHubSettings('c1', makeHubSettings({ logosShown: false }))).toEqual(makeHubSettings({ logosShown: false }))
    expect(http.put).toHaveBeenCalledWith(URL, makeHubSettings({ logosShown: false }))
  })

  it('keys the cache by club', () => {
    expect(hubSettingsKey('c1')).toEqual(['managed-club', 'c1', 'hub-settings'])
  })
})

describe('useHubSettings', () => {
  function setup(enabled = true) {
    const client = newQueryClient()
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
    return { client, ...renderHook(() => useHubSettings('c1', enabled), { wrapper }) }
  }

  it('loads the settings', async () => {
    routeApi(http, { [`GET ${URL}`]: makeHubSettings() })
    const { result } = setup()

    await waitFor(() => expect(result.current.settings).toEqual(makeHubSettings()))
  })

  it('does not read when disabled', async () => {
    routeApi(http, { [`GET ${URL}`]: makeHubSettings() })
    const { result } = setup(false)

    expect(result.current.settings).toBeUndefined()
    expect(http.get).not.toHaveBeenCalled()
  })

  it('saves the whole DTO and puts the saved value in the cache', async () => {
    routeApi(http, { [`GET ${URL}`]: makeHubSettings(), [`PUT ${URL}`]: ({ body }: { body?: unknown }) => body })
    const { result, client } = setup()
    await waitFor(() => expect(result.current.settings).toBeDefined())

    act(() => result.current.setSettings(makeHubSettings({ logoDownloadAllowed: true })))

    await waitFor(() => expect(http.put).toHaveBeenCalledWith(URL, makeHubSettings({ logoDownloadAllowed: true })))
    await waitFor(() => expect(client.getQueryData(hubSettingsKey('c1'))).toEqual(makeHubSettings({ logoDownloadAllowed: true })))
    await waitFor(() => expect(result.current.settings?.logoDownloadAllowed).toBe(true))
  })

  it('clears the phone and email switches in the saved payload when the directory is off', async () => {
    routeApi(http, { [`GET ${URL}`]: makeHubSettings(), [`PUT ${URL}`]: ({ body }: { body?: unknown }) => body })
    const { result } = setup()
    await waitFor(() => expect(result.current.settings).toBeDefined())

    act(() => result.current.setSettings(makeHubSettings({ directoryShown: false, directoryPhoneShown: true, directoryEmailShown: true })))

    await waitFor(() => expect(http.put).toHaveBeenCalledWith(URL, makeHubSettings({ directoryShown: false, directoryPhoneShown: false, directoryEmailShown: false })))
  })

  it('reports a failed save and keeps the cached value', async () => {
    routeApi(http, { [`GET ${URL}`]: makeHubSettings(), [`PUT ${URL}`]: new Error('nope') })
    const { result } = setup()
    await waitFor(() => expect(result.current.settings).toBeDefined())

    act(() => result.current.setSettings(makeHubSettings({ logosShown: false })))

    await waitFor(() => expect(result.current.saveFailed).toBe(true))
    expect(result.current.settings).toEqual(makeHubSettings())
  })
})
