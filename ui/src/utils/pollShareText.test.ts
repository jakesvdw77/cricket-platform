import { describe, expect, it } from 'vitest'
import { closeTimeLine, formatShareCloseTime } from './pollShareText'

describe('pollShareText', () => {
  it('formats a local date and 24-hour time', () => {
    expect(formatShareCloseTime(new Date(2026, 9, 2, 20, 0))).toBe('Fri 2 Oct, 20:00')
    expect(formatShareCloseTime(new Date(2026, 9, 3, 9, 5))).toBe('Sat 3 Oct, 09:05')
  })

  it('builds a bold WhatsApp deadline line only for an automatic close time', () => {
    const iso = new Date(2026, 9, 2, 20, 0).toISOString()
    expect(closeTimeLine(true, iso)).toBe('⏰ *Please reply by Fri 2 Oct, 20:00*')
    expect(closeTimeLine(false, iso)).toBeNull()
    expect(closeTimeLine(true, null)).toBeNull()
    expect(closeTimeLine(undefined, undefined)).toBeNull()
    expect(closeTimeLine(true, 'not a date')).toBeNull()
  })
})
