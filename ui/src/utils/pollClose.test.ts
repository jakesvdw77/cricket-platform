import { describe, expect, it } from 'vitest'
import { canReopen, closePollDescription } from './pollClose'

const NOW = new Date('2026-06-01T12:00:00Z')

describe('canReopen', () => {
  it('is always true when Autoclose is off, even with a past close time', () => {
    expect(canReopen({ autoClose: false, scheduledCloseAt: '2026-05-01T00:00:00Z' }, NOW)).toBe(true)
  })

  it('is true when there is no scheduled close time', () => {
    expect(canReopen({ autoClose: true, scheduledCloseAt: null }, NOW)).toBe(true)
  })

  it('is true strictly before the automatic close time', () => {
    expect(canReopen({ autoClose: true, scheduledCloseAt: '2026-06-01T12:00:01Z' }, NOW)).toBe(true)
  })

  it('is false at or after the automatic close time', () => {
    expect(canReopen({ autoClose: true, scheduledCloseAt: '2026-06-01T12:00:00Z' }, NOW)).toBe(false)
    expect(canReopen({ autoClose: true, scheduledCloseAt: '2026-05-31T12:00:00Z' }, NOW)).toBe(false)
  })
})

describe('closePollDescription', () => {
  it('words the reopen window per Autoclose', () => {
    expect(closePollDescription(true)).toMatch(/until its automatic close time/)
    expect(closePollDescription(false)).toMatch(/at any time/)
  })
})
