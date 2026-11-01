import { describe, expect, it } from 'vitest'
import { LIVE_WINDOW_HOURS, matchStatusFor, resultActionFor, resultBadgeFor, resultStateOf } from './matchResultHelpers'

describe('resultStateOf', () => {
  it('maps the server status and treats NONE or missing as none', () => {
    expect(resultStateOf({ resultStatus: 'DRAFT' })).toBe('draft')
    expect(resultStateOf({ resultStatus: 'PUBLISHED' })).toBe('published')
    expect(resultStateOf({ resultStatus: 'NONE' })).toBe('none')
    expect(resultStateOf({})).toBe('none')
  })
})

describe('resultActionFor', () => {
  it('captures when there is no result', () => {
    expect(resultActionFor({ id: 'm1', active: true, resultStatus: 'NONE' })).toEqual({
      caption: 'Capture',
      label: 'Capture result',
      to: '/manage/results/m1/capture',
    })
  })

  it('continues a draft', () => {
    expect(resultActionFor({ id: 'm1', active: true, resultStatus: 'DRAFT' })).toMatchObject({ caption: 'Continue', label: 'Continue result', to: '/manage/results/m1/capture' })
  })

  it('views a published result, even for an inactive match', () => {
    expect(resultActionFor({ id: 'm1', active: false, resultStatus: 'PUBLISHED' })).toMatchObject({ caption: 'Result', label: 'View result', to: '/manage/results/m1' })
  })

  it('offers nothing for an inactive match without a published result', () => {
    expect(resultActionFor({ id: 'm1', active: false, resultStatus: 'NONE' })).toBeNull()
    expect(resultActionFor({ id: 'm1', active: false, resultStatus: 'DRAFT' })).toBeNull()
  })
})

describe('resultBadgeFor', () => {
  it('is amber for a draft, green Completed when published, and absent otherwise', () => {
    expect(resultBadgeFor({ resultStatus: 'DRAFT' })).toEqual({ label: 'Result draft', tone: 'warning' })
    expect(resultBadgeFor({ resultStatus: 'PUBLISHED' })).toEqual({ label: 'Completed', tone: 'active' })
    expect(resultBadgeFor({ resultStatus: 'NONE' })).toBeNull()
    expect(resultBadgeFor({})).toBeNull()
  })
})

describe('matchStatusFor live window', () => {
  const start = new Date('2026-11-01T09:00:00').getTime()
  const match = { id: 'm1', active: true, resultStatus: 'NONE' as const, matchDate: '2026-11-01T09:00:00' }
  const hours = (n: number) => start + n * 3_600_000

  it('is one number: eight hours (owner, 2026-11-01)', () => {
    expect(LIVE_WINDOW_HOURS).toBe(8)
  })

  it('is Live just before the window ends and Awaiting Result at it', () => {
    expect(matchStatusFor(match, 'A v B', hours(7.9)).kind).toBe('live')
    expect(matchStatusFor(match, 'A v B', hours(8)).kind).toBe('awaiting')
  })

  it('is Live at the start and Upcoming before it', () => {
    expect(matchStatusFor(match, 'A v B', start).kind).toBe('live')
    expect(matchStatusFor(match, 'A v B', start - 60_000).kind).toBe('upcoming')
  })
})
