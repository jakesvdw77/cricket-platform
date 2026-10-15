import { describe, expect, it } from 'vitest'
import { formatBytes } from './formatBytes'

describe('formatBytes', () => {
  it('words a size in binary units, one decimal only where it matters', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(2048)).toBe('2 KB')
    expect(formatBytes(1)).toBe('1 B')
    expect(formatBytes(1024 * 1024)).toBe('1 MB')
    expect(formatBytes(1.5 * 1024 * 1024)).toBe('1.5 MB')
    expect(formatBytes(5 * 1024 * 1024)).toBe('5 MB')
  })

  it('never shows a kilobyte value as zero', () => {
    expect(formatBytes(1100)).toBe('1 KB')
  })
})
