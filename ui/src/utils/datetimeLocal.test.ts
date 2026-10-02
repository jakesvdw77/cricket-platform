import { describe, expect, it } from 'vitest'
import { fromDatetimeLocal, toDatetimeLocal } from './datetimeLocal'

describe('datetimeLocal', () => {
  it('formats an ISO instant as the browser-local datetime-local value', () => {
    const local = new Date(2026, 9, 3, 9, 5)
    expect(toDatetimeLocal(local.toISOString())).toBe('2026-10-03T09:05')
  })

  it('returns an empty string for an unparseable value', () => {
    expect(toDatetimeLocal('not a date')).toBe('')
  })

  it('round-trips through fromDatetimeLocal as an ISO instant', () => {
    const local = new Date(2026, 9, 3, 14, 30)
    expect(fromDatetimeLocal('2026-10-03T14:30')).toBe(local.toISOString())
  })
})
