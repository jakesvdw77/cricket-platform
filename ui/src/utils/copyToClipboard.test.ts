import { afterEach, describe, expect, it, vi } from 'vitest'
import { copyToClipboard } from './copyToClipboard'

function mockClipboard(writeText: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
}

describe('copyToClipboard', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('uses navigator.clipboard.writeText when it works', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    mockClipboard(writeText)
    await expect(copyToClipboard('hello')).resolves.toBe(true)
    expect(writeText).toHaveBeenCalledWith('hello')
  })

  it('falls back to execCommand("copy") when the clipboard API rejects', async () => {
    mockClipboard(vi.fn().mockRejectedValue(new Error('denied')))
    const execCommand = vi.fn().mockReturnValue(true)
    document.execCommand = execCommand
    await expect(copyToClipboard('hello')).resolves.toBe(true)
    expect(execCommand).toHaveBeenCalledWith('copy')
    expect(document.querySelector('textarea')).toBeNull()
  })

  it('resolves false when both routes fail', async () => {
    mockClipboard(vi.fn().mockRejectedValue(new Error('denied')))
    document.execCommand = vi.fn().mockReturnValue(false)
    await expect(copyToClipboard('hello')).resolves.toBe(false)
  })
})
