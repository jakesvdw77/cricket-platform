import { describe, expect, it } from 'vitest'
import { formatBracketLabel } from './dayPart'

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
