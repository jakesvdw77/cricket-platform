import { describe, expect, it } from 'vitest'
import { bornText, countText, dobDiffers, dobDiffersText, waitingText } from './linkRequestFormat'

const NOW = new Date('2026-10-23T12:00:00Z')

describe('waitingText', () => {
  it.each([
    ['2026-10-23T11:30:00Z', 'Less than an hour'],
    ['2026-10-23T11:00:00Z', '1 hour'],
    ['2026-10-23T05:00:00Z', '7 hours'],
    ['2026-10-22T12:00:00Z', '1 day'],
    ['2026-10-20T12:00:00Z', '3 days'],
  ])('%s reads %s', (created, expected) => {
    expect(waitingText(created, NOW)).toBe(expected)
  })

  it('never goes negative for a clock-skewed future date, and shows a dash for a bad one', () => {
    expect(waitingText('2026-10-24T12:00:00Z', NOW)).toBe('Less than an hour')
    expect(waitingText('not a date', NOW)).toBe('Not recorded')
  })
})

describe('request wording', () => {
  it('bornText adds the age when known', () => {
    expect(bornText('2012-03-04', 14)).toMatch(/2012 \(age 14\)$/)
    expect(bornText('2012-03-04', null)).not.toMatch(/age/)
  })

  it('countText pluralises', () => {
    expect(countText(1, 'link request', 'link requests')).toBe('1 link request')
    expect(countText(0, 'link request', 'link requests')).toBe('0 link requests')
  })

  it('dobDiffers is true only for an explicit exactMatch of false', () => {
    expect(dobDiffers({ typedDateOfBirth: '2012-03-04', suggestedPlayer: { exactMatch: false } })).toBe(true)
    expect(dobDiffers({ typedDateOfBirth: '2012-03-04', suggestedPlayer: { exactMatch: true } })).toBe(false)
    expect(dobDiffers({ typedDateOfBirth: '2012-03-04', suggestedPlayer: {} })).toBe(false)
    expect(dobDiffers({ typedDateOfBirth: '2012-03-04', suggestedPlayer: null })).toBe(false)
    expect(dobDiffersText('2012-03-04')).toMatch(/^Date of birth differs from the request \(.*2012\)\. Check before approving\.$/)
  })
})
