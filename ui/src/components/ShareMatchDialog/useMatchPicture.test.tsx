import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_PICTURE_SETTINGS } from '../../utils/share/matchImage'
import { useMatchPicture } from './useMatchPicture'

// docs/specs/131: the picture is local only, rejected when it is not an image or too big, and released when the dialog closes.
let created: string[]
let revoked: string[]

class FakeImage {
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  naturalWidth = 400
  naturalHeight = 300
  set src(_value: string) {
    queueMicrotask(() => this.onload?.())
  }
}

beforeEach(() => {
  created = []
  revoked = []
  vi.stubGlobal('Image', FakeImage)
  URL.createObjectURL = vi.fn(() => {
    const url = `blob:picture-${created.length}`
    created.push(url)
    return url
  })
  URL.revokeObjectURL = vi.fn((url: string) => void revoked.push(url))
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('useMatchPicture', () => {
  it('rejects a file that is not an image', () => {
    const { result } = renderHook(() => useMatchPicture(true))
    act(() => result.current.choose(new File(['x'], 'notes.txt', { type: 'text/plain' })))
    expect(result.current.error).toBe('Choose an image file.')
    expect(result.current.image).toBeNull()
    expect(created).toHaveLength(0)
  })

  it('rejects a picture that is too large', () => {
    const { result } = renderHook(() => useMatchPicture(true))
    const big = new File(['x'], 'big.jpg', { type: 'image/jpeg' })
    Object.defineProperty(big, 'size', { value: 16 * 1024 * 1024 })
    act(() => result.current.choose(big))
    expect(result.current.error).toMatch(/too large/)
  })

  it('reads a picture through an object URL, keeps its name and releases it on Remove', async () => {
    const { result } = renderHook(() => useMatchPicture(true))
    await act(async () => {
      result.current.choose(new File(['x'], 'squad.jpg', { type: 'image/jpeg' }))
      await Promise.resolve()
    })
    expect(result.current.image).not.toBeNull()
    expect(result.current.name).toBe('squad.jpg')
    act(() => result.current.remove())
    expect(result.current.image).toBeNull()
    expect(revoked).toEqual(created)
  })

  it('changes settings key by key and resets everything when the dialog closes', async () => {
    const { result, rerender } = renderHook(({ active }) => useMatchPicture(active), { initialProps: { active: true } })
    act(() => result.current.setSettings({ zoom: 2 }))
    act(() => result.current.setSettings({ filter: 'SEPIA' }))
    expect(result.current.settings).toEqual({ ...DEFAULT_PICTURE_SETTINGS, zoom: 2, filter: 'SEPIA' })
    await act(async () => {
      result.current.choose(new File(['x'], 'a.png', { type: 'image/png' }))
      await Promise.resolve()
    })
    rerender({ active: false })
    expect(result.current.image).toBeNull()
    expect(result.current.settings).toEqual(DEFAULT_PICTURE_SETTINGS)
    expect(revoked.length).toBeGreaterThan(0)
  })
})
