import { afterEach, describe, expect, it, vi } from 'vitest'
import { copyText } from './copyText'

const setClipboard = (value: unknown) => Object.defineProperty(navigator, 'clipboard', { value, configurable: true })

afterEach(() => {
  setClipboard(undefined)
  vi.restoreAllMocks()
})

describe('copyText', () => {
  it('uses the async clipboard when it exists', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    setClipboard({ writeText })
    expect(await copyText('hello')).toBe(true)
    expect(writeText).toHaveBeenCalledWith('hello')
  })

  it('falls back to a hidden textarea and execCommand when there is no clipboard, and cleans up', async () => {
    setClipboard(undefined)
    const exec = vi.fn().mockReturnValue(true)
    Object.defineProperty(document, 'execCommand', { value: exec, configurable: true })
    expect(await copyText('fallback')).toBe(true)
    expect(exec).toHaveBeenCalledWith('copy')
    expect(document.querySelector('textarea')).toBeNull()
  })

  it('falls back when the async clipboard rejects', async () => {
    setClipboard({ writeText: vi.fn().mockRejectedValue(new Error('denied')) })
    const exec = vi.fn().mockReturnValue(true)
    Object.defineProperty(document, 'execCommand', { value: exec, configurable: true })
    expect(await copyText('x')).toBe(true)
    expect(exec).toHaveBeenCalled()
  })

  it('answers false when the fallback fails too', async () => {
    setClipboard(undefined)
    Object.defineProperty(document, 'execCommand', { value: vi.fn().mockReturnValue(false), configurable: true })
    expect(await copyText('x')).toBe(false)
    Object.defineProperty(document, 'execCommand', { value: vi.fn(() => { throw new Error('nope') }), configurable: true })
    expect(await copyText('x')).toBe(false)
  })
})
