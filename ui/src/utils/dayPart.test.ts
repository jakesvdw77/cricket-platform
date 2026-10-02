import { describe, expect, it } from 'vitest'
import { dayPartForDate, formatBracketLabel } from './dayPart'

describe('formatBracketLabel', () => {
  it('joins the date and day-part with " - " by default', () => {
    const label = formatBracketLabel('2026-10-03', 'MORNING')
    expect(label.endsWith(' - Morning')).toBe(true)
    expect(label).not.toContain('·')
  })

  it('uses the given separator', () => {
    const label = formatBracketLabel('2026-10-03', 'AFTERNOON', ' · ')
    expect(label.endsWith(' · Afternoon')).toBe(true)
    expect(label).not.toContain(' - ')
  })
})

describe('dayPartForDate', () => {
  it('treats anything before local noon as MORNING', () => {
    expect(dayPartForDate(new Date(2026, 9, 3, 0, 0))).toBe('MORNING')
    expect(dayPartForDate(new Date(2026, 9, 3, 11, 59))).toBe('MORNING')
  })

  it('treats local noon and later as AFTERNOON, matching the backend resolver', () => {
    expect(dayPartForDate(new Date(2026, 9, 3, 12, 0))).toBe('AFTERNOON')
    expect(dayPartForDate(new Date(2026, 9, 3, 23, 59))).toBe('AFTERNOON')
  })
})
