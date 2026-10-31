import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { installFakeImportApi } from '../components/ImportWizard/importFakes'
import type { FakeImportServer } from '../components/ImportWizard/importFakes'
import { SAMPLE_BATCH_ID, SAMPLE_CLUB_ID, committedBatch, confirmableBatch } from '../components/ImportWizard/importFixtures'
import { emptyImportDecisions, getAiHelp, importCount, importKeys, importSourceName, importTypedSummary, useCommitImport, useDeleteImport, useSaveImportDecisions } from './importApi'

let server: FakeImportServer | null = null
afterEach(() => server?.restore())

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
  return { client, wrapper }
}

describe('import batch helpers', () => {
  it('importCount reads a numeric counter and answers 0 for a missing or non-numeric one', () => {
    expect(importCount({ counts: { added: 3, weird: 'x' } }, 'added')).toBe(3)
    expect(importCount({ counts: { added: 3 } }, 'edited')).toBe(0)
    expect(importCount({ counts: { weird: 'x' } }, 'weird')).toBe(0)
    expect(importCount(null, 'added')).toBe(0)
  })

  it('importTypedSummary names typed-in and edited rows, or nothing', () => {
    expect(importTypedSummary({ counts: { added: 3, edited: 2 } })).toBe('3 typed in, 2 edited')
    expect(importTypedSummary({ counts: { added: 1 } })).toBe('1 typed in')
    expect(importTypedSummary({ counts: { edited: 4 } })).toBe('4 edited')
    expect(importTypedSummary({ counts: { added: 0, edited: 0 } })).toBeNull()
  })

  it('importSourceName names a manual batch, else the file, else the fallback', () => {
    expect(importSourceName({ source: 'MANUAL', fileName: 'x.xlsx' })).toBe('Typed in the wizard')
    expect(importSourceName({ source: 'TEMPLATE_FILE', fileName: 'x.xlsx' })).toBe('x.xlsx')
    expect(importSourceName({ source: 'TEMPLATE_FILE', fileName: null }, 'Upload')).toBe('Upload')
  })
})

describe('getAiHelp', () => {
  it('sends the consumer params and both scope choices as query parameters', async () => {
    server = installFakeImportApi()
    await getAiHelp(SAMPLE_CLUB_ID, 'LEAGUE_SCHEDULE', { scopeMode: 'OURS_ONLY', templateScope: 'OURS_AND_OTHERS', params: { leagueId: 'l1', seasonId: 's1' } })
    const call = server.calls.find((entry) => entry.url.includes('ai-help'))
    expect(call?.params).toEqual({ leagueId: 'l1', seasonId: 's1', templateScope: 'OURS_AND_OTHERS', scopeMode: 'OURS_ONLY' })
  })
})

describe('import mutations and the cache', () => {
  it('a commit stores the returned batch and refreshes the import keys and the consumer keys', async () => {
    // The fake answers a commit with the batch it holds, so it holds a committed one (the cache starts empty).
    server = installFakeImportApi({ batch: committedBatch() })
    const { client, wrapper } = setup()
    expect(client.getQueryData(importKeys.batch(SAMPLE_CLUB_ID, SAMPLE_BATCH_ID))).toBeUndefined()
    const spy = vi.spyOn(client, 'invalidateQueries')
    const consumerKey = ['managed-club', SAMPLE_CLUB_ID, 'matches']
    const { result } = renderHook(() => useCommitImport(SAMPLE_CLUB_ID, SAMPLE_BATCH_ID, [consumerKey]), { wrapper })
    await act(async () => {
      await result.current.mutateAsync({ revision: 4, confirmationToken: 'token-1', confirmedCreationsDigest: 'digest-1' })
    })
    expect(client.getQueryData<{ status: string }>(importKeys.batch(SAMPLE_CLUB_ID, SAMPLE_BATCH_ID))?.status).toBe('COMMITTED')
    const keys = spy.mock.calls.map((call) => call[0]?.queryKey)
    expect(keys).toContainEqual(importKeys.all(SAMPLE_CLUB_ID))
    expect(keys).toContainEqual(consumerKey)
  })

  it('a delete refreshes the import keys and the consumer keys', async () => {
    server = installFakeImportApi({ batch: committedBatch() })
    const { client, wrapper } = setup()
    const spy = vi.spyOn(client, 'invalidateQueries')
    const consumerKey = ['managed-club', SAMPLE_CLUB_ID, 'leagues']
    const { result } = renderHook(() => useDeleteImport(SAMPLE_CLUB_ID, [consumerKey]), { wrapper })
    await act(async () => {
      await result.current.mutateAsync(SAMPLE_BATCH_ID)
    })
    const keys = spy.mock.calls.map((call) => call[0]?.queryKey)
    expect(keys).toContainEqual(importKeys.all(SAMPLE_CLUB_ID))
    expect(keys).toContainEqual(consumerKey)
  })

  it('a failed decisions save re-reads the batch instead of keeping a stale revision', async () => {
    server = installFakeImportApi({ batch: confirmableBatch() })
    const { client, wrapper } = setup()
    const spy = vi.spyOn(client, 'invalidateQueries')
    server.restore()
    // Every call now fails, as a revision conflict would.
    const api = (await import('./axiosConfig')).default
    const previous = api.defaults.adapter
    api.defaults.adapter = () => Promise.reject(new Error('conflict'))
    server = { calls: [], restore: () => { api.defaults.adapter = previous } }
    const { result } = renderHook(() => useSaveImportDecisions(SAMPLE_CLUB_ID, SAMPLE_BATCH_ID), { wrapper })
    await act(async () => {
      await result.current.mutateAsync({ revision: 1, decisions: emptyImportDecisions() }).catch(() => undefined)
    })
    await waitFor(() => expect(spy).toHaveBeenCalledWith({ queryKey: importKeys.batch(SAMPLE_CLUB_ID, SAMPLE_BATCH_ID), exact: true }))
  })
})
