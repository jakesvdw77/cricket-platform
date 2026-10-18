import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { useShareSettings } from './useShareSettings'

const getShareSettings = vi.fn()
const updateShareSettings = vi.fn()
vi.mock('../api/shareSettingsApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/shareSettingsApi')>()),
  getShareSettings: (clubId: string) => getShareSettings(clubId),
  updateShareSettings: (clubId: string, settings: unknown) => updateShareSettings(clubId, settings),
}))

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>
)

describe('useShareSettings', () => {
  it('reads the club default and updates the cached value after a save', async () => {
    getShareSettings.mockResolvedValue({ initialsOnlyDefault: false })
    updateShareSettings.mockResolvedValue({ initialsOnlyDefault: true })
    const { result } = renderHook(() => useShareSettings('club-1'), { wrapper })
    await waitFor(() => expect(result.current.settings).toEqual({ initialsOnlyDefault: false }))

    act(() => result.current.setInitialsOnlyDefault(true))

    await waitFor(() => expect(result.current.settings).toEqual({ initialsOnlyDefault: true }))
    expect(updateShareSettings).toHaveBeenCalledWith('club-1', { initialsOnlyDefault: true })
  })

  it('does not read while disabled', () => {
    getShareSettings.mockClear()
    renderHook(() => useShareSettings('club-1', false), { wrapper })
    expect(getShareSettings).not.toHaveBeenCalled()
  })
})
