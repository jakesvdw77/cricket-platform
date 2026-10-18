import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useCopyImage } from './useCopyImage'

const file = new File(['png'], 'result.png', { type: 'image/png' })

class FakeClipboardItem {
  constructor(public items: Record<string, Blob>) {}
}

afterEach(() => {
  vi.unstubAllGlobals()
  Reflect.deleteProperty(navigator, 'clipboard')
})

describe('useCopyImage', () => {
  it('reports no support without ClipboardItem', () => {
    const { result } = renderHook(() => useCopyImage())
    expect(result.current.canCopyImage).toBe(false)
  })

  it('writes the PNG as an image item and reports it', async () => {
    const write = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('ClipboardItem', FakeClipboardItem)
    Object.defineProperty(navigator, 'clipboard', { value: { write }, configurable: true })
    const { result } = renderHook(() => useCopyImage())

    expect(result.current.canCopyImage).toBe(true)
    await act(async () => {
      await result.current.copyImage(file)
    })

    expect((write.mock.calls[0][0][0] as FakeClipboardItem).items['image/png']).toBe(file)
    expect(result.current.message).toBe('Image copied.')
  })

  it('reports a failed write', async () => {
    vi.stubGlobal('ClipboardItem', FakeClipboardItem)
    Object.defineProperty(navigator, 'clipboard', { value: { write: vi.fn().mockRejectedValue(new Error('no')) }, configurable: true })
    const { result } = renderHook(() => useCopyImage())

    await act(async () => {
      await result.current.copyImage(file)
    })

    expect(result.current.message).toBe("Couldn't copy the image. Download it instead.")
  })
})
