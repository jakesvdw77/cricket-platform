import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCopyToClipboard } from './useCopyToClipboard'

describe('useCopyToClipboard', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('flags the copied key then clears it after about two seconds', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockResolvedValue(undefined) }, configurable: true })
    const { result } = renderHook(() => useCopyToClipboard())

    await act(async () => {
      await result.current.copy('text', 'message')
    })
    expect(result.current.copiedKey).toBe('message')

    act(() => {
      vi.advanceTimersByTime(2100)
    })
    expect(result.current.copiedKey).toBeNull()
  })

  it('reports failure when the clipboard and the fallback both fail', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockRejectedValue(new Error('no')) }, configurable: true })
    document.execCommand = vi.fn().mockReturnValue(false)
    const { result } = renderHook(() => useCopyToClipboard())

    await act(async () => {
      await result.current.copy('text')
    })
    expect(result.current.failed).toBe(true)
    expect(result.current.copiedKey).toBeNull()
  })
})
